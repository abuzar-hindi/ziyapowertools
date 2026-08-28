import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { AdminUser, Business, Customer, QrSession } from '../src/models/index.js'
import { hashPassword } from '../src/config/auth.js'
import { createQrToken, hashToken } from '../src/services/qrService.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')

let business
let otherBusiness
let admin
let qrToken
const password = 'correct horse battery staple'

before(async () => {
  await connectDatabase(process.env.MONGODB_URI)
})

beforeEach(async () => {
  await mongoose.connection.dropDatabase()
  business = await Business.create({ name: 'Brew & Bean' })
  otherBusiness = await Business.create({ name: 'Second Business' })
  qrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: new mongoose.Types.ObjectId(), tokenHash: hashToken(qrToken), expiresAt: new Date(Date.now() + 60_000) })
  admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
  await Customer.init()
})

after(async () => {
  await disconnectDatabase()
})

async function adminAgent() {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: admin.email, password })
  return agent
}

test('registers a customer and returns only a safe basic profile', async () => {
  const response = await request(app).post('/api/customers/identify').send({ qrToken, name: ' Abuzar ', phone: ' +1 (555) 123-4567 ' })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.customer.name, 'Abuzar')
  assert.equal(response.body.data.customer.phone, '+1 (555) 123-4567')
  assert.equal(response.body.data.customer.businessId, undefined)
  assert.equal(response.body.data.customer.normalizedPhone, undefined)
  assert.equal(response.body.data.customer.passwordHash, undefined)
  assert.equal(await Customer.countDocuments({ businessId: business._id }), 1)
})

test('returns configured public engagement links and omits missing links', async () => {
  await Business.updateOne({ _id: business._id }, {
    $set: {
      phone: '+15551234567',
      whatsappNumber: '+15557654321',
      googleReviewUrl: 'https://g.page/r/example/review',
      socialLinks: { instagram: 'https://instagram.com/example', facebook: 'https://facebook.com/example' },
    },
  })
  const response = await request(app).post('/api/customers/identify').send({ qrToken, name: 'Abuzar', phone: '+15551234567' })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.business.phone, '+15551234567')
  assert.equal(response.body.data.business.whatsappNumber, '+15557654321')
  assert.equal(response.body.data.business.googleReviewUrl, 'https://g.page/r/example/review')
  assert.equal(response.body.data.business.socialLinks.instagram, 'https://instagram.com/example')
  assert.equal(response.body.data.business.socialLinks.facebook, 'https://facebook.com/example')
  assert.equal(response.body.data.business.businessId, undefined)
  assert.equal(response.body.data.business.admins, undefined)
})

test('returns empty public engagement fields when links are not configured', async () => {
  const response = await request(app).post('/api/customers/identify').send({ qrToken, name: 'Abuzar', phone: '+15551234567' })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.business.phone, '')
  assert.equal(response.body.data.business.whatsappNumber, '')
  assert.equal(response.body.data.business.googleReviewUrl, '')
  assert.deepEqual(response.body.data.business.socialLinks, {})
})

test('rejects missing and invalid name or phone', async () => {
  const cases = [{ phone: '+15551234567' }, { name: '', phone: '+15551234567' }, { name: 'A'.repeat(121), phone: '+15551234567' }, { name: 'Abuzar' }, { name: 'Abuzar', phone: 'not-a-phone' }]
  for (const payload of cases) {
    const response = await request(app).post('/api/customers/identify').send({ qrToken, ...payload })
    assert.equal(response.status, 400)
    assert.equal(response.body.data, undefined)
    assert.ok(response.body.error.message)
  }
})

test('normalizes phone numbers and returns the existing customer on repeat identification', async () => {
  const first = await request(app).post('/api/customers/identify').send({ qrToken, name: 'Abuzar', phone: '+1 (555) 123-4567' })
  const second = await request(app).post('/api/customers/identify').send({ qrToken, name: 'Abuzar Khan', phone: '+15551234567' })
  assert.equal(first.body.data.customer.id, second.body.data.customer.id)
  assert.equal(await Customer.countDocuments({ businessId: business._id }), 1)
  assert.equal((await Customer.findOne({ businessId: business._id })).name, 'Abuzar Khan')
})

test('allows the same phone in another business but never accepts client business scope', async () => {
  const first = await request(app).post('/api/customers/identify').send({ qrToken, name: 'Local Customer', phone: '+15550000001', businessId: otherBusiness._id.toString() })
  assert.equal(first.status, 200)
  assert.equal((await Customer.findOne({ businessId: business._id })).name, 'Local Customer')
  assert.equal(await Customer.countDocuments({ businessId: otherBusiness._id }), 0)
  await Customer.create({ businessId: otherBusiness._id, name: 'Other Customer', normalizedPhone: '+15550000001', displayPhone: '+15550000001' })
  assert.equal(await Customer.countDocuments({ normalizedPhone: '+15550000001' }), 2)
})

test('requires valid QR context and protects profile reads', async () => {
  assert.equal((await request(app).post('/api/customers/identify').send({ name: 'Abuzar', phone: '+15551234567' })).status, 404)
  const agent = await adminAgent()
  const customer = await Customer.create({ businessId: otherBusiness._id, name: 'Other Customer', normalizedPhone: '+15550000002', displayPhone: '+15550000002' })
  assert.equal((await agent.get(`/api/customers/${customer._id}`)).status, 404)
})

test('customer identification is rate limited', async () => {
  const responses = []
  for (let attempt = 0; attempt < 25; attempt += 1) {
    responses.push(await request(app).post('/api/customers/identify').send({ qrToken, name: 'Abuzar', phone: `+1555123${String(attempt).padStart(4, '0')}` }))
  }
  assert.ok(responses.some((response) => response.status === 200))
  assert.ok(responses.some((response) => response.status === 429))
})
