import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { clearTestDatabase, connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { createCustomerSessionToken, hashToken as hashCustomerToken } from '../src/config/customerSession.js'
import { createPermanentQr } from '../src/services/qrService.js'
import { AdminUser, Business, Customer, CustomerSession, LoyaltyProgram, Reward, StampRequest, StampEvent, Visit } from '../src/models/index.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')
let business
let otherBusiness
let customer
let permanentToken
let admin
const password = 'correct horse battery staple'

before(async () => await connectDatabase())
beforeEach(async () => {
  await connectDatabase()
  await clearTestDatabase()
  business = await Business.create({ name: 'Brew & Bean', settings: { timezone: 'UTC' } })
  otherBusiness = await Business.create({ name: 'Other Business' })
  customer = await Customer.create({ businessId: business._id, name: 'Abuzar', normalizedPhone: '+15551234567', displayPhone: '+15551234567' })
  admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
  await LoyaltyProgram.create({ businessId: business._id, stampsRequired: 6, active: true })
  await Reward.create({ businessId: business._id, description: 'Free coffee', status: 'active', loyaltyProgramId: (await LoyaltyProgram.findOne({ businessId: business._id }))._id })
  permanentToken = (await createPermanentQr({ businessId: business._id })).token
  await CustomerSession.init(); await StampRequest.init(); await Visit.init(); await StampEvent.init()
})
after(async () => disconnectDatabase())

async function customerAgent() {
  const agent = request.agent(app)
  const token = createCustomerSessionToken()
  await CustomerSession.create({ businessId: business._id, customerId: customer._id, tokenHash: hashCustomerToken(token), expiresAt: new Date(Date.now() + 60_000) })
  agent.jar.setCookie(`loyaltyos_customer=${token}; Path=/`)
  return agent
}

async function adminAgent() {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: admin.email, password })
  return agent
}

test('creates one pending request without changing official progress', async () => {
  const response = await (await customerAgent()).post('/api/stamp-requests').send({ qrToken: permanentToken })
  assert.equal(response.status, 202)
  assert.equal(response.body.data.request.status, 'pending')
  assert.equal((await Customer.findById(customer._id)).activitySummary.totalStamps, 0)
  assert.equal(await Visit.countDocuments(), 0)
  assert.equal(await StampEvent.countDocuments(), 0)
})

test('prevents a second pending request for the same business day', async () => {
  const agent = await customerAgent()
  assert.equal((await agent.post('/api/stamp-requests').send({ qrToken: permanentToken })).status, 202)
  const duplicate = await agent.post('/api/stamp-requests').send({ qrToken: permanentToken })
  assert.equal(duplicate.status, 409)
  assert.equal(duplicate.body.error.code, 'STAMP_REQUEST_PENDING')
})

test('admin can reject or approve only its own pending requests', async () => {
  const customerSession = await customerAgent()
  await customerSession.post('/api/stamp-requests').send({ qrToken: permanentToken })
  const adminSession = await adminAgent()
  const pending = await adminSession.get('/api/stamp-requests/pending')
  assert.equal(pending.status, 200)
  assert.equal(pending.body.data.requests.length, 1)
  const requestId = pending.body.data.requests[0].id
  const approved = await adminSession.post(`/api/stamp-requests/${requestId}/review`).send({ action: 'approve' })
  assert.equal(approved.status, 200)
  assert.equal(approved.body.data.progress.current, 1)
  assert.equal(await Visit.countDocuments({ businessId: business._id, customerId: customer._id }), 1)
  assert.equal((await customerSession.get('/api/stamp-requests/current')).body.data.request.status, 'approved')
  assert.equal((await adminSession.post(`/api/stamp-requests/${requestId}/review`).send({ action: 'approve' })).status, 409)
  assert.equal((await adminSession.get(`/api/stamp-requests/pending?businessId=${otherBusiness._id}`)).status, 403)
})

test('rejection does not change progress and concurrent approval creates one stamp', async () => {
  const firstAgent = await customerAgent()
  await firstAgent.post('/api/stamp-requests').send({ qrToken: permanentToken })
  const record = await StampRequest.findOne({ businessId: business._id }).lean()
  const adminSession = await adminAgent()
  assert.equal((await adminSession.post(`/api/stamp-requests/${record._id}/review`).send({ action: 'reject' })).status, 200)
  assert.equal((await firstAgent.get('/api/stamp-requests/current')).body.data.request.status, 'rejected')
  assert.equal((await Customer.findById(customer._id)).activitySummary.totalStamps, 0)
  assert.equal(await Visit.countDocuments(), 0)
})
