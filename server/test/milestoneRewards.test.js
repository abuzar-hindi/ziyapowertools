import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { clearTestDatabase, connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { AdminUser, Business, Customer, CustomerSession, LoyaltyProgram, Reward } from '../src/models/index.js'
import { createCustomerSessionToken, hashToken } from '../src/config/customerSession.js'
import { createPermanentQr } from '../src/services/qrService.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
const { default: app } = await import('../src/app.js')
let business, admin, customer, customerAgent, password
before(async () => {
  await connectDatabase()
})
beforeEach(async () => {
  await connectDatabase()
  await clearTestDatabase(); password = 'correct horse battery staple'
  business = await Business.create({ name: 'Brew & Bean' }); admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) }); customer = await Customer.create({ businessId: business._id, name: 'A', normalizedPhone: '+15551234567', displayPhone: '+15551234567' }); await LoyaltyProgram.create({ businessId: business._id, stampsRequired: 6, active: true })
  customerAgent = request.agent(app); const token = createCustomerSessionToken(); await CustomerSession.create({ businessId: business._id, customerId: customer._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60000) }); customerAgent.jar.setCookie(`loyaltyos_customer=${token}; Path=/`)
})
after(async () => disconnectDatabase())
async function adminAgent() { const agent = request.agent(app); await agent.post('/api/auth/login').send({ email: admin.email, password }); return agent }
test('manages multiple milestone rewards within one business', async () => { const agent = await adminAgent(); const first = await agent.post('/api/rewards/manage').send({ description: 'Free coffee', milestoneStamps: 6, status: 'active' }); assert.equal(first.status, 201); const second = await agent.post('/api/rewards/manage').send({ description: 'Special gift', milestoneStamps: 12, status: 'active' }); assert.equal(second.status, 201); const list = await agent.get('/api/rewards/manage'); assert.deepEqual(list.body.data.rewards.map((reward) => reward.milestoneStamps), [6, 12]); assert.equal((await agent.post('/api/rewards/manage').send({ description: 'Duplicate', milestoneStamps: 6, status: 'active' })).status, 409); const permanent = (await createPermanentQr({ businessId: business._id })).token; assert.equal((await customerAgent.post('/api/stamp-requests').send({ qrToken: permanent })).status, 202) })
