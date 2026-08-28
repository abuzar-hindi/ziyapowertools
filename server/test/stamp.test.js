import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { Business, Customer, CustomerSession, LoyaltyProgram, QrSession, StampEvent, Visit } from '../src/models/index.js'
import { createQrToken, hashToken } from '../src/services/qrService.js'
import { createCustomerSessionToken } from '../src/config/customerSession.js'
import { calendarDay } from '../src/services/calendarService.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')

let business
let otherBusiness
let customer
let otherCustomer
let qrToken
let password

before(async () => await connectDatabase(process.env.MONGODB_URI))
beforeEach(async () => {
  await mongoose.connection.dropDatabase()
  business = await Business.create({ name: 'Brew & Bean', settings: { timezone: 'UTC' } })
  otherBusiness = await Business.create({ name: 'Second Business' })
  customer = await Customer.create({ businessId: business._id, name: 'Abuzar', normalizedPhone: '+15551234567', displayPhone: '+1 555 1234567' })
  otherCustomer = await Customer.create({ businessId: otherBusiness._id, name: 'Other', normalizedPhone: '+15551234567', displayPhone: '+1 555 1234567' })
  password = 'correct horse battery staple'
  const admin = await (await import('../src/models/index.js')).AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
  qrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: admin._id, tokenHash: hashToken(qrToken), expiresAt: new Date(Date.now() + 60_000) })
  await LoyaltyProgram.create({ businessId: business._id, stampsRequired: 6 })
  await LoyaltyProgram.create({ businessId: otherBusiness._id, stampsRequired: 4 })
  await QrSession.init(); await Visit.init(); await StampEvent.init(); await CustomerSession.init()
})
after(async () => await disconnectDatabase())

async function customerAgent(customerId = customer._id, businessId = business._id) {
  const agent = request.agent(app)
  const token = createCustomerSessionToken()
  await CustomerSession.create({ businessId, customerId, tokenHash: (await import('../src/config/customerSession.js')).hashToken(token), expiresAt: new Date(Date.now() + 60_000) })
  agent.jar.setCookie(`loyaltyos_customer=${token}; Path=/`)
  return agent
}

test('valid customer receives exactly one backend-controlled stamp', async () => {
  const response = await (await customerAgent()).post('/api/stamps').send({ qrToken, quantity: 10, customerId: otherCustomer._id.toString(), businessId: otherBusiness._id.toString() })
  assert.equal(response.status, 201)
  assert.equal(response.body.data.stamp.quantity, 1)
  assert.equal(response.body.data.progress.current, 1)
  assert.equal(await Visit.countDocuments({ businessId: business._id, customerId: customer._id }), 1)
  assert.equal(await StampEvent.countDocuments({ businessId: business._id, customerId: customer._id }), 1)
})

test('rejects missing/invalid customer session and QR context', async () => {
  assert.equal((await request(app).post('/api/stamps').send({ qrToken })).status, 401)
  const agent = await customerAgent()
  assert.equal((await agent.post('/api/stamps').send({ qrToken: 'invalid' })).status, 404)
  const expired = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: new mongoose.Types.ObjectId(), tokenHash: hashToken(expired), expiresAt: new Date(Date.now() - 1) })
  assert.equal((await agent.post('/api/stamps').send({ qrToken: expired })).status, 404)
})

test('rejects the second and later stamp on the same calendar day', async () => {
  const agent = await customerAgent()
  const nextDayResponse = await agent.post('/api/stamps').send({ qrToken })
  assert.equal(nextDayResponse.status, 201, JSON.stringify(nextDayResponse.body))
  const second = await agent.post('/api/stamps').send({ qrToken })
  assert.equal(second.status, 409)
  assert.equal(second.body.error.message, "Today's stamp has already been collected")
  assert.equal((await agent.post('/api/stamps').send({ qrToken })).status, 409)
  assert.equal(await Visit.countDocuments(), 1)
  assert.equal(await StampEvent.countDocuments(), 1)
})

test('allows the same customer on the next calendar day and another customer today', async () => {
  const agent = await customerAgent()
  await agent.post('/api/stamps').send({ qrToken })
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await Visit.updateOne({}, { $set: { stampDay: calendarDay(yesterday, business.toObject()), occurredAt: yesterday } })
  assert.equal((await agent.post('/api/stamps').send({ qrToken })).status, 201)
  const secondCustomer = await Customer.create({ businessId: business._id, name: 'Second', normalizedPhone: '+15550000001', displayPhone: '+15550000001' })
  const secondAgent = await customerAgent(secondCustomer._id)
  assert.equal((await secondAgent.post('/api/stamps').send({ qrToken })).status, 201)
})

test('keeps customer and business scope server-authoritative', async () => {
  const agent = await customerAgent(customer._id, business._id)
  const response = await agent.post('/api/stamps').send({ qrToken, customerId: otherCustomer._id.toString(), businessId: otherBusiness._id.toString() })
  assert.equal(response.status, 201)
  assert.equal(await StampEvent.countDocuments({ customerId: otherCustomer._id }), 0)
  const otherToken = createQrToken()
  await QrSession.create({ businessId: otherBusiness._id, createdBy: new mongoose.Types.ObjectId(), tokenHash: hashToken(otherToken), expiresAt: new Date(Date.now() + 60_000) })
  assert.equal((await agent.post('/api/stamps').send({ qrToken: otherToken })).status, 404)
})

test('calculates progress from stored stamp events', async () => {
  const agent = await customerAgent()
  await agent.post('/api/stamps').send({ qrToken })
  assert.deepEqual((await agent.get('/api/stamps/progress')).body.data.progress, { current: 1, required: 6 })
})

test('concurrent duplicate requests produce one visit and one stamp event', async () => {
  const agent = await customerAgent()
  const responses = await Promise.all(Array.from({ length: 2 }, () => agent.post('/api/stamps').send({ qrToken })))
  assert.equal(responses.filter((response) => response.status === 201).length, 1)
  assert.equal(responses.filter((response) => response.status === 409).length, 1)
  assert.equal(await Visit.countDocuments({ businessId: business._id, customerId: customer._id }), 1)
  assert.equal(await StampEvent.countDocuments({ businessId: business._id, customerId: customer._id }), 1)
})

test('defines daily visit and event uniqueness indexes and rate limits stamps', async () => {
  assert.ok(Visit.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.customerId === 1 && fields.stampDay === 1 && options.unique))
  assert.ok(StampEvent.schema.indexes().some(([fields, options]) => fields.visitId === 1 && options.unique))
  const agent = await customerAgent()
  const responses = await Promise.all(Array.from({ length: 25 }, () => agent.post('/api/stamps').send({ qrToken })))
  assert.ok(responses.some((response) => response.status === 429))
})
