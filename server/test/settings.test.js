import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { clearTestDatabase, connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { AdminUser, Business, LoyaltyProgram, Reward } from '../src/models/index.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')

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
  business = await Business.create({ name: 'Brew & Bean' })
  otherBusiness = await Business.create({ name: 'Second Business' })
  password = 'correct horse battery staple'
  admin = await AdminUser.create({
    businessId: business._id,
    email: 'owner@example.com',
    passwordHash: await hashPassword(password),
  })
})

after(async () => {
  await disconnectDatabase()
})

async function authenticatedAgent() {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: admin.email, password })
  return agent
}

test('gets and updates the authenticated business profile', async () => {
  const agent = await authenticatedAgent()
  const initial = await agent.get('/api/business')
  assert.equal(initial.status, 200)
  assert.equal(initial.body.data.business.name, 'Brew & Bean')

  const response = await agent.patch('/api/business').send({
    name: 'Brew & Bean Coffee',
    logo: 'https://example.com/logo.png',
    address: { line1: '1 Main Street', city: 'Lahore' },
    phone: '+92 300 1234567',
    whatsappNumber: '+92 300 7654321',
    instagramUrl: 'https://instagram.com/brewandbean',
    facebookUrl: 'https://facebook.com/brewandbean',
    googleReviewUrl: 'https://g.page/r/example/review',
  })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.business.name, 'Brew & Bean Coffee')
  assert.equal(response.body.data.business.socialLinks.instagram, 'https://instagram.com/brewandbean')
  assert.equal(response.body.data.business.socialLinks.facebook, 'https://facebook.com/brewandbean')
  assert.equal(response.body.data.business.phone, '+92 300 1234567')
})

test('rejects unauthenticated business access and cross-business reads/updates', async () => {
  assert.equal((await request(app).get('/api/business')).status, 401)
  const agent = await authenticatedAgent()

  const readOther = await agent.get(`/api/business?businessId=${otherBusiness._id}`)
  assert.equal(readOther.status, 403)
  const updateOther = await agent.patch('/api/business').send({ businessId: otherBusiness._id.toString(), name: 'No access' })
  assert.equal(updateOther.status, 403)
  assert.equal((await Business.findById(otherBusiness._id)).name, 'Second Business')
})

test('updates valid loyalty settings and rejects invalid values', async () => {
  const agent = await authenticatedAgent()
  const response = await agent.patch('/api/loyalty-program').send({ active: true, stampsRequired: 6 })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.program.stampsRequired, 6)
  assert.equal((await agent.get('/api/loyalty-program')).body.data.program.active, true)

  for (const payload of [{ active: true, stampsRequired: 0 }, { active: 'yes', stampsRequired: 6 }, { active: false, stampsRequired: 101 }]) {
    assert.equal((await agent.patch('/api/loyalty-program').send(payload)).status, 400)
  }
})

test('updates valid reward settings and rejects invalid values', async () => {
  const agent = await authenticatedAgent()
  await agent.patch('/api/loyalty-program').send({ active: true, stampsRequired: 6 })
  const response = await agent.patch('/api/reward-settings').send({ description: 'Free Medium Coffee', status: 'active' })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.reward.description, 'Free Medium Coffee')
  assert.equal((await agent.get('/api/reward-settings')).body.data.reward.status, 'active')

  for (const payload of [{ description: '', status: 'active' }, { description: 'Reward', status: 'unknown' }, { description: 'a'.repeat(241), status: 'inactive' }]) {
    assert.equal((await agent.patch('/api/reward-settings').send(payload)).status, 400)
  }
})

test('validates URLs and phone numbers', async () => {
  const agent = await authenticatedAgent()
  const invalid = await agent.patch('/api/business').send({
    logo: 'javascript:alert(1)',
    googleReviewUrl: 'not-a-url',
    phone: 'not a phone',
  })
  assert.equal(invalid.status, 400)
  assert.equal((await Business.findById(business._id)).name, 'Brew & Bean')
})

test('keeps settings scoped to the authenticated admin business', async () => {
  const agent = await authenticatedAgent()
  await LoyaltyProgram.create({ businessId: otherBusiness._id, stampsRequired: 4 })
  await Reward.create({ businessId: otherBusiness._id, loyaltyProgramId: new mongoose.Types.ObjectId(), description: 'Other reward' })

  const program = await agent.get('/api/loyalty-program')
  const reward = await agent.get('/api/reward-settings')
  assert.equal(program.body.data.program, null)
  assert.equal(reward.body.data.reward, null)
})
