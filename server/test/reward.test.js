import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import request from 'supertest'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { Business, Customer, CustomerReward, CustomerSession, LoyaltyProgram, QrSession, Reward } from '../src/models/index.js'
import { createQrToken, hashToken } from '../src/services/qrService.js'
import { createCustomerSessionToken } from '../src/config/customerSession.js'
import { calendarDay } from '../src/services/calendarService.js'

process.env.JWT_SECRET = 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN = 'http://localhost:5173'

const { default: app } = await import('../src/app.js')

let business
let otherBusiness
let customer
let secondCustomer
let qrToken
let customerAgent

before(async () => await connectDatabase(process.env.MONGODB_URI))

beforeEach(async () => {
  await mongoose.connection.dropDatabase()
  business = await Business.create({ name: 'Brew & Bean', settings: { timezone: 'UTC' } })
  otherBusiness = await Business.create({ name: 'Second Business', settings: { timezone: 'UTC' } })
  customer = await Customer.create({ businessId: business._id, name: 'Abuzar', normalizedPhone: '+15551234567', displayPhone: '+1 555 1234567' })
  secondCustomer = await Customer.create({ businessId: business._id, name: 'Second', normalizedPhone: '+15550000001', displayPhone: '+1 555 0000001' })
  const admin = await (await import('../src/models/index.js')).AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword('correct horse battery staple') })
  qrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: admin._id, tokenHash: hashToken(qrToken), expiresAt: new Date(Date.now() + 60_000) })
  await LoyaltyProgram.create({ businessId: business._id, stampsRequired: 2, active: true })
  await LoyaltyProgram.create({ businessId: otherBusiness._id, stampsRequired: 2, active: true })
  await Reward.create({ businessId: business._id, loyaltyProgramId: (await LoyaltyProgram.findOne({ businessId: business._id }))._id, description: 'Free Medium Coffee', status: 'active' })
  await Reward.create({ businessId: otherBusiness._id, loyaltyProgramId: (await LoyaltyProgram.findOne({ businessId: otherBusiness._id }))._id, description: 'Free Tea', status: 'active' })
  customerAgent = request.agent(app)
  const sessionToken = createCustomerSessionToken()
  await CustomerSession.create({ businessId: business._id, customerId: customer._id, tokenHash: (await import('../src/config/customerSession.js')).hashToken(sessionToken), expiresAt: new Date(Date.now() + 60_000) })
  customerAgent.jar.setCookie(`loyaltyos_customer=${sessionToken}; Path=/`)
})

after(async () => await disconnectDatabase())

test('reward unlocks at the exact threshold and is not duplicated', async () => {
  const secondQrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: (await (await import('../src/models/index.js')).AdminUser.findOne({ businessId: business._id }))._id, tokenHash: hashToken(secondQrToken), expiresAt: new Date(Date.now() + 60_000) })

  const first = await customerAgent.post('/api/stamps').send({ qrToken })
  assert.equal(first.status, 201)
  assert.equal(await CustomerReward.countDocuments({ businessId: business._id, customerId: customer._id }), 0)

  const previousDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await (await import('../src/models/index.js')).Visit.updateOne({ businessId: business._id, customerId: customer._id }, {
    $set: { occurredAt: previousDay, stampDay: calendarDay(previousDay, business.toObject()) },
  })

  const second = await customerAgent.post('/api/stamps').send({ qrToken: secondQrToken })
  assert.equal(second.status, 201)
  const rewards = await CustomerReward.find({ businessId: business._id, customerId: customer._id }).lean()
  assert.equal(rewards.length, 1)
  assert.equal(rewards[0].status, 'unlocked')

  const third = await customerAgent.post('/api/stamps').send({ qrToken: secondQrToken })
  assert.equal(third.status, 409)
  assert.equal(await CustomerReward.countDocuments({ businessId: business._id, customerId: customer._id }), 1)
})

test('reward does not unlock too early and respects inactive reward configuration', async () => {
  const first = await customerAgent.post('/api/stamps').send({ qrToken })
  assert.equal(first.status, 201)
  assert.equal(await CustomerReward.countDocuments({ businessId: business._id, customerId: customer._id }), 0)

  const reward = await Reward.findOne({ businessId: business._id })
  reward.status = 'inactive'
  await reward.save()

  const second = await customerAgent.post('/api/stamps').send({ qrToken })
  assert.equal(second.status, 201)
  assert.equal(await CustomerReward.countDocuments({ businessId: business._id, customerId: customer._id }), 0)
})

test('customer can redeem their own reward and cannot redeem it twice', async () => {
  const secondQrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: (await (await import('../src/models/index.js')).AdminUser.findOne({ businessId: business._id }))._id, tokenHash: hashToken(secondQrToken), expiresAt: new Date(Date.now() + 60_000) })

  const previousDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await customerAgent.post('/api/stamps').send({ qrToken })
  await (await import('../src/models/index.js')).Visit.updateOne({ businessId: business._id, customerId: customer._id }, {
    $set: { occurredAt: previousDay, stampDay: calendarDay(previousDay, business.toObject()) },
  })
  await customerAgent.post('/api/stamps').send({ qrToken: secondQrToken })

  const unlocked = await CustomerReward.findOne({ businessId: business._id, customerId: customer._id, status: 'unlocked' }).lean()
  assert.ok(unlocked)

  const redeem = await customerAgent.post(`/api/rewards/${unlocked._id}/redeem`)
  assert.equal(redeem.status, 200)
  assert.equal(redeem.body.data.reward.status, 'redeemed')

  const secondRedeem = await customerAgent.post(`/api/rewards/${unlocked._id}/redeem`)
  assert.equal(secondRedeem.status, 409)
})

test('customer cannot redeem another customer or another business reward', async () => {
  const otherSession = request.agent(app)
  const token = createCustomerSessionToken()
  await CustomerSession.create({ businessId: business._id, customerId: secondCustomer._id, tokenHash: (await import('../src/config/customerSession.js')).hashToken(token), expiresAt: new Date(Date.now() + 60_000) })
  otherSession.jar.setCookie(`loyaltyos_customer=${token}; Path=/`)

  const secondQrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: (await (await import('../src/models/index.js')).AdminUser.findOne({ businessId: business._id }))._id, tokenHash: hashToken(secondQrToken), expiresAt: new Date(Date.now() + 60_000) })
  const previousDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await customerAgent.post('/api/stamps').send({ qrToken })
  await (await import('../src/models/index.js')).Visit.updateOne({ businessId: business._id, customerId: customer._id }, {
    $set: { occurredAt: previousDay, stampDay: calendarDay(previousDay, business.toObject()) },
  })
  await customerAgent.post('/api/stamps').send({ qrToken: secondQrToken })

  const unlocked = await CustomerReward.findOne({ businessId: business._id, customerId: customer._id, status: 'unlocked' }).lean()
  const otherCustomerReward = await CustomerReward.create({ businessId: business._id, customerId: secondCustomer._id, rewardId: unlocked.rewardId, unlockedAt: new Date(), status: 'unlocked' })

  const unauthorized = await otherSession.post(`/api/rewards/${unlocked._id}/redeem`)
  assert.equal(unauthorized.status, 403)

  const otherBusinessCustomer = await Customer.create({ businessId: otherBusiness._id, name: 'Other', normalizedPhone: '+15550000002', displayPhone: '+1 555 0000002' })
  const businessTwoToken = createCustomerSessionToken()
  await CustomerSession.create({ businessId: otherBusiness._id, customerId: otherBusinessCustomer._id, tokenHash: (await import('../src/config/customerSession.js')).hashToken(businessTwoToken), expiresAt: new Date(Date.now() + 60_000) })
  const otherBusinessAgent = request.agent(app)
  otherBusinessAgent.jar.setCookie(`loyaltyos_customer=${businessTwoToken}; Path=/`)

  const foreignReward = await CustomerReward.create({ businessId: otherBusiness._id, customerId: otherBusinessCustomer._id, rewardId: (await Reward.findOne({ businessId: otherBusiness._id }))._id, unlockedAt: new Date(), status: 'unlocked' })
  const crossBusiness = await otherBusinessAgent.post(`/api/rewards/${foreignReward._id}/redeem`)
  assert.equal(crossBusiness.status, 200)
  assert.equal(await CustomerReward.findById(foreignReward._id).then((doc) => doc.status), 'redeemed')

  const crossBusinessAttempt = await otherBusinessAgent.post(`/api/rewards/${unlocked._id}/redeem`)
  assert.equal(crossBusinessAttempt.status, 404)
  const ownRewardByOwner = await otherSession.post(`/api/rewards/${otherCustomerReward._id}/redeem`)
  assert.equal(ownRewardByOwner.status, 200)
  assert.equal((await CustomerReward.findById(otherCustomerReward._id)).status, 'redeemed')
})

test('concurrent redemption requests result in one successful redemption', async () => {
  const secondQrToken = createQrToken()
  await QrSession.create({ businessId: business._id, createdBy: (await (await import('../src/models/index.js')).AdminUser.findOne({ businessId: business._id }))._id, tokenHash: hashToken(secondQrToken), expiresAt: new Date(Date.now() + 60_000) })
  const previousDay = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await customerAgent.post('/api/stamps').send({ qrToken })
  await (await import('../src/models/index.js')).Visit.updateOne({ businessId: business._id, customerId: customer._id }, {
    $set: { occurredAt: previousDay, stampDay: calendarDay(previousDay, business.toObject()) },
  })
  await customerAgent.post('/api/stamps').send({ qrToken: secondQrToken })

  const unlocked = await CustomerReward.findOne({ businessId: business._id, customerId: customer._id, status: 'unlocked' }).lean()
  const responses = await Promise.all(Array.from({ length: 2 }, () => customerAgent.post(`/api/rewards/${unlocked._id}/redeem`)))
  const successCount = responses.filter((response) => response.status === 200).length
  assert.equal(successCount, 1)
  const finalReward = await CustomerReward.findById(unlocked._id)
  assert.equal(finalReward.status, 'redeemed')
})
