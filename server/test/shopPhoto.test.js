import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { AdminUser, Business, Customer, CustomerSession, FeaturedPhoto } from '../src/models/index.js'
import { createCustomerSessionToken, hashToken } from '../src/config/customerSession.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
const { default: app } = await import('../src/app.js')
let business, otherBusiness, admin, customer, password
before(async () => connectDatabase(process.env.MONGODB_URI))
beforeEach(async () => {
  await mongoose.connection.dropDatabase(); password = 'correct horse battery staple'
  business = await Business.create({ name: 'Brew & Bean', settings: { timezone: 'UTC' } }); otherBusiness = await Business.create({ name: 'Other' })
  admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(password) })
  customer = await Customer.create({ businessId: business._id, name: 'A', normalizedPhone: '+15551234567', displayPhone: '+15551234567' })
  await CustomerSession.init(); await FeaturedPhoto.init()
})
after(async () => disconnectDatabase())
async function adminAgent() { const agent = request.agent(app); await agent.post('/api/auth/login').send({ email: admin.email, password }); return agent }
async function customerAgent() { const agent = request.agent(app); const token = createCustomerSessionToken(); await CustomerSession.create({ businessId: business._id, customerId: customer._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) }); agent.jar.setCookie(`loyaltyos_customer=${token}; Path=/`); return agent }
test('saves timezone-aware shop settings and manual override', async () => { const agent = await adminAgent(); const saved = await agent.patch('/api/shop').send({ manualStatus: 'closed', days: [1, 2], openTime: '09:00', closeTime: '21:00' }); assert.equal(saved.status, 200); assert.equal(saved.body.data.status.status, 'closed'); const customer = await (await customerAgent()).get('/api/customers/me'); assert.equal(customer.body.data.business.shopStatus.status, 'closed') })
test('protects featured photo ownership and rejects malformed uploads', async () => { const agent = await adminAgent(); const first = await agent.post('/api/featured-photo').attach('photo', Buffer.from('not-an-image'), { filename: 'photo.png', contentType: 'image/png' }); assert.equal(first.status, 400); const photo = await FeaturedPhoto.findOne({ businessId: business._id }); assert.equal(photo, null); const foreign = await request(app).get('/api/featured-photo').set('Cookie', 'invalid'); assert.equal(foreign.status, 401); assert.equal(otherBusiness._id.equals(business._id), false) })
