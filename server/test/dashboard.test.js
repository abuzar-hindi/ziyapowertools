import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { clearTestDatabase, connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { AdminUser, Business, Customer, CustomerReward, LoyaltyProgram, Reward, StampEvent, Visit } from '../src/models/index.js'
import { default as app } from '../src/app.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

let business
let otherBusiness
let admin
let password

before(async () => {
  await connectDatabase()
})
beforeEach(async () => {
  await connectDatabase()
  await clearTestDatabase()
  business = await Business.create({ name: 'Brew & Bean', settings: { timezone: 'UTC' } })
  otherBusiness = await Business.create({ name: 'Other Business', settings: { timezone: 'UTC' } })
  password = 'correct horse battery staple'
  admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
  const program = await LoyaltyProgram.create({ businessId: business._id, stampsRequired: 6, active: true })
  await Reward.create({ businessId: business._id, loyaltyProgramId: program._id, description: 'Free coffee', status: 'active' })
})
after(async () => disconnectDatabase())

async function agent() {
  const result = request.agent(app)
  await result.post('/api/auth/login').send({ email: admin.email, password })
  return result
}

test('dashboard is protected and business scoped', async () => {
  assert.equal((await request(app).get('/api/dashboard')).status, 401)
  const customer = await Customer.create({ businessId: otherBusiness._id, name: 'Other', normalizedPhone: '+15551234567', displayPhone: '+15551234567' })
  await Visit.create({ businessId: otherBusiness._id, customerId: customer._id, occurredAt: new Date(), stampDay: '2026-08-27' })
  const dashboard = await (await agent()).get(`/api/dashboard?businessId=${otherBusiness._id}`)
  assert.equal(dashboard.status, 403)
  const own = await (await agent()).get('/api/dashboard?period=today')
  assert.equal(own.status, 200)
  assert.equal(own.body.data.metrics.totalCustomers, 0)
  assert.equal(own.body.data.metrics.visits, 0)
})

test('dashboard returns metrics, activity, top customers, and paginated close-reward customers', async () => {
  const customer = await Customer.create({ businessId: business._id, name: 'Regular', normalizedPhone: '+15551234567', displayPhone: '+15551234567', activitySummary: { totalVisits: 2, totalStamps: 5, lastVisitAt: new Date() } })
  const visit = await Visit.create({ businessId: business._id, customerId: customer._id, occurredAt: new Date(), stampDay: '2026-08-27' })
  await StampEvent.create({ businessId: business._id, customerId: customer._id, visitId: visit._id, quantity: 1, source: 'qr' })
  const response = await (await agent()).get('/api/dashboard?period=7d&segment=almost-reward&page=1&limit=1')
  assert.equal(response.status, 200)
  assert.equal(response.body.data.period, '7d')
  assert.equal(response.body.data.metrics.totalCustomers, 1)
  assert.equal(response.body.data.metrics.visits, 1)
  assert.equal(response.body.data.metrics.stampsToday, 1)
  assert.equal(response.body.data.topCustomers[0].name, 'Regular')
  assert.equal(response.body.data.segments.almostReward[0].name, 'Regular')
  assert.equal(response.body.data.pagination.limit, 1)
  assert.equal(response.body.data.recentActivity.length > 0, true)
})