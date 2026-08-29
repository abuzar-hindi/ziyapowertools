import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { clearTestDatabase, connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { AdminUser, Business, Customer, CustomerRegistration, QrSession } from '../src/models/index.js'
import { hashPassword } from '../src/config/auth.js'
import { createQrToken, hashToken } from '../src/services/qrService.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')

let business
let admin
let qrToken
const password = 'correct horse battery staple'

before(async () => {
  await connectDatabase()
})

beforeEach(async () => {
  await connectDatabase()
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({})
  }
  business = await Business.create({ name: 'Brew & Bean' })
  qrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: new mongoose.Types.ObjectId(), tokenHash: hashToken(qrToken), status: 'active', expiresAt: new Date(Date.now() + 60_000) })
  admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
})

after(async () => {
  await disconnectDatabase()
})

async function adminAgent() {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: admin.email, password })
  return agent
}

test('genuinely NEW customer registration requires admin approval', async () => {
  const response = await request(app).post('/api/customers/identify').send({ qrToken, name: 'Abuzar Hindi', phone: '7525899794' })
  assert.equal(response.status, 202)
  assert.equal(response.body.data.registrationPending, true)
  assert.equal(response.body.data.message, 'Your registration is waiting for approval.')

  // No active customer record created yet
  assert.equal(await Customer.countDocuments({ businessId: business._id }), 0)

  // Registration request created
  const pendingReg = await CustomerRegistration.findOne({ businessId: business._id })
  assert.ok(pendingReg)
  assert.equal(pendingReg.name, 'Abuzar Hindi')
  assert.equal(pendingReg.status, 'pending')

  // Admin sees pending registration
  const agent = await adminAgent()
  const listRes = await agent.get('/api/customer-registrations/pending')
  assert.equal(listRes.status, 200)
  assert.equal(listRes.body.data.registrations.length, 1)

  // Admin approves registration
  const reviewRes = await agent.post(`/api/customer-registrations/${pendingReg._id}/review`).send({ action: 'approve' })
  assert.equal(reviewRes.status, 200)

  // Active customer record now exists
  assert.equal(await Customer.countDocuments({ businessId: business._id }), 1)
  const customer = await Customer.findOne({ businessId: business._id })
  assert.equal(customer.name, 'Abuzar Hindi')

  // Existing customer re-entry with phone matches approved customer directly (even with different capitalization/spacing)
  const reEntryRes = await request(app).post('/api/customers/identify').send({ qrToken, name: 'abuzar hindi', phone: '7525899794' })
  assert.equal(reEntryRes.status, 200)
  assert.equal(reEntryRes.body.data.customer.name, 'Abuzar Hindi')
})
