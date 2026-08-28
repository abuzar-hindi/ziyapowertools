import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { createAccessToken } from '../src/config/auth.js'
import { Business, AdminUser, QrSession, Customer, CustomerSession } from '../src/models/index.js'
import { hashPassword } from '../src/config/auth.js'
import { createQrToken, hashToken } from '../src/services/qrService.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')

let business
let otherBusiness
let admin
let password

before(async () => await connectDatabase(process.env.MONGODB_URI))
beforeEach(async () => {
  await mongoose.connection.dropDatabase()
  business = await Business.create({ name: 'Brew & Bean' })
  otherBusiness = await Business.create({ name: 'Second Business' })
  password = 'correct horse battery staple'
  admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
  await QrSession.init()
  await CustomerSession.init()
})
after(async () => await disconnectDatabase())

async function adminAgent() {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: admin.email, password })
  return agent
}

async function makeQr(overrides = {}) {
  const token = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: admin._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000), ...overrides })
  return token
}

test('authenticated admin creates a QR without accepting another business', async () => {
  const response = await (await adminAgent()).post('/api/qr/sessions').send({ businessId: otherBusiness._id.toString() })
  assert.equal(response.status, 403)
  const valid = await (await adminAgent()).post('/api/qr/sessions').send({})
  assert.equal(valid.status, 201)
  assert.match(valid.body.data.session.customerUrl, /\/customer\?qr=/)
  assert.match(valid.body.data.session.qrImage, /^data:image\/png;base64,/) 
  assert.ok(valid.body.data.session.expiresAt)
})

test('rejects unauthenticated QR generation and validates valid, invalid, expired, revoked tokens', async () => {
  assert.equal((await request(app).post('/api/qr/sessions')).status, 401)
  const validToken = await makeQr()
  const valid = await request(app).post('/api/qr/sessions/validate').send({ token: validToken })
  assert.equal(valid.status, 200)
  assert.equal(valid.body.data.business.name, 'Brew & Bean')
  assert.equal(valid.body.data.business.id, undefined)
  assert.equal((await request(app).post('/api/qr/sessions/validate').send({ token: 'invalid' })).status, 404)
  const expired = await makeQr({ expiresAt: new Date(Date.now() - 1000) })
  assert.equal((await request(app).post('/api/qr/sessions/validate').send({ token: expired })).status, 404)
  const revoked = await makeQr({ status: 'revoked' })
  assert.equal((await request(app).post('/api/qr/sessions/validate').send({ token: revoked })).status, 404)
})

test('QR token is opaque and stored only as a hash', async () => {
  const token = createQrToken()
  assert.equal(token.length, 43)
  assert.notEqual(token, business._id.toString())
  await QrSession.create({ businessId: business._id, createdBy: admin._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) })
  const stored = await QrSession.findOne({}).select('+tokenHash').lean()
  assert.equal(stored.tokenHash, hashToken(token))
  assert.notEqual(stored.tokenHash, token)
})

test('customer identification requires valid QR context and creates a scoped customer session', async () => {
  const token = await makeQr()
  const response = await request(app).post('/api/customers/identify').send({ qrToken: token, name: 'Abuzar', phone: '+1 (555) 123-4567' })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.business.name, 'Brew & Bean')
  assert.equal(response.body.data.customer.id, undefined)
  assert.match(response.headers['set-cookie'][0], /loyaltyos_customer=/)
  assert.match(response.headers['set-cookie'][0], /HttpOnly/)
  assert.equal(await Customer.countDocuments({ businessId: business._id }), 1)
  assert.equal(await CustomerSession.countDocuments({ businessId: business._id }), 1)
  assert.equal((await request(app).post('/api/customers/identify').send({ name: 'Abuzar', phone: '+1 (555) 123-4567' })).status, 404)
})

test('customer session is scoped, short-lived, and cannot access another customer', async () => {
  const token = await makeQr()
  const agent = request.agent(app)
  await agent.post('/api/customers/identify').send({ qrToken: token, name: 'Abuzar', phone: '+15551234567' })
  assert.equal((await agent.get('/api/customers/me')).status, 200)
  const other = await Customer.create({ businessId: business._id, name: 'Other', normalizedPhone: '+15550000002', displayPhone: '+15550000002' })
  assert.equal((await agent.get(`/api/customers/${other._id}`)).status, 401)
  await CustomerSession.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  assert.equal((await agent.get('/api/customers/me')).status, 401)
})

test('QR validation is rate limited', async () => {
  const responses = []
  for (let i = 0; i < 65; i += 1) responses.push(await request(app).post('/api/qr/sessions/validate').send({ token: 'invalid' }))
  assert.ok(responses.some((response) => response.status === 404))
  assert.ok(responses.some((response) => response.status === 429))
})
