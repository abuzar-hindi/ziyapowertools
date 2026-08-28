import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import {
  AdminUser,
  Business,
  Customer,
  CustomerReward,
  LoyaltyProgram,
  QrSession,
  Reward,
  StampEvent,
  Visit,
} from '../src/models/index.js'
import { normalizePhone } from '../src/models/Customer.js'

let business
let otherBusiness
const databaseUri = process.env.MONGODB_URI
const databaseTestsEnabled = Boolean(databaseUri)

before(async () => {
  if (databaseTestsEnabled) {
    await connectDatabase(databaseUri)
  }
})

beforeEach(async () => {
  if (!databaseTestsEnabled) return
  await mongoose.connection.dropDatabase()
  await Customer.init()
  business = await Business.create({ name: 'Brew & Bean' })
  otherBusiness = await Business.create({ name: 'Second Business' })
})

after(async () => {
  if (databaseTestsEnabled) await disconnectDatabase()
})

test('requires MONGODB_URI when no connection string is provided', async () => {
  const originalUri = process.env.MONGODB_URI
  delete process.env.MONGODB_URI
  await disconnectDatabase()
  try {
    await assert.rejects(
      () => connectDatabase(),
      (error) => error.code === 'MONGODB_URI_MISSING',
    )
  } finally {
    process.env.MONGODB_URI = originalUri
    if (databaseTestsEnabled) await connectDatabase(databaseUri)
  }
})

test('rejects an invalid MongoDB connection safely', async () => {
  await disconnectDatabase()
  await assert.rejects(
    () => connectDatabase('mongodb://127.0.0.1:1/invalid', { serverSelectionTimeoutMS: 50 }),
    /ECONNREFUSED|Server selection timed out|connect/i,
  )
  if (databaseTestsEnabled) await connectDatabase(databaseUri)
})

test('normalizes supported phone formatting', () => {
  assert.equal(normalizePhone(' +1 (555) 123-4567 '), '+15551234567')
})

test('enforces required fields, enums, URLs, and positive stamps', async () => {
  const businessId = new mongoose.Types.ObjectId()
  await assert.rejects(() => new Business({}).validate(), /Path `name` is required/)
  await assert.rejects(() => new Business({ name: 'Shop', googleReviewUrl: 'not-a-url' }).validate(), /valid HTTP or HTTPS URL/)
  await assert.rejects(() => new AdminUser({ businessId, email: 'owner@example.com', passwordHash: 'short' }).validate(), /shorter than the minimum allowed length/)
  await assert.rejects(() => new LoyaltyProgram({ businessId, stampsRequired: 0 }).validate(), /less than minimum allowed value/)
  await assert.rejects(() => new Reward({ businessId, loyaltyProgramId: new mongoose.Types.ObjectId(), description: 'Reward', status: 'unknown' }).validate(), /is not a valid enum value/)
  await assert.rejects(() => new StampEvent({ businessId, customerId: new mongoose.Types.ObjectId(), visitId: new mongoose.Types.ObjectId(), quantity: 0, source: 'qr' }).validate(), /less than minimum allowed value/)
})

test('prevents duplicate customer phones within one business but allows another business', { skip: !databaseTestsEnabled }, async () => {
  await Customer.create({ businessId: business._id, name: 'Abuzar', normalizedPhone: ' +1 555 123 4567 ', displayPhone: '+1 555 123 4567' })
  await assert.rejects(
    () => Customer.create({ businessId: business._id, name: 'Another Name', normalizedPhone: '+15551234567', displayPhone: '+15551234567' }),
    (error) => error.code === 11000,
  )
  const otherCustomer = await Customer.create({ businessId: otherBusiness._id, name: 'Another Name', normalizedPhone: '+15551234567', displayPhone: '+15551234567' })
  assert.equal(otherCustomer.businessId.toString(), otherBusiness._id.toString())
})

test('stores the documented ObjectId references', { skip: !databaseTestsEnabled }, async () => {
  const admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: 'a'.repeat(60) })
  const customer = await Customer.create({ businessId: business._id, name: 'Abuzar', normalizedPhone: '+15551234567', displayPhone: '+1 555 123 4567' })
  const program = await LoyaltyProgram.create({ businessId: business._id, stampsRequired: 6 })
  const reward = await Reward.create({ businessId: business._id, loyaltyProgramId: program._id, description: 'Free Medium Coffee' })
  const session = await QrSession.create({ businessId: business._id, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 60_000), createdBy: admin._id })
  const visit = await Visit.create({ businessId: business._id, customerId: customer._id, qrSessionId: session._id, idempotencyKey: 'visit-1' })
  const stamp = await StampEvent.create({ businessId: business._id, customerId: customer._id, visitId: visit._id, quantity: 1, source: 'qr' })
  const customerReward = await CustomerReward.create({ businessId: business._id, customerId: customer._id, rewardId: reward._id })

  assert.equal(visit.customerId.toString(), customer._id.toString())
  assert.equal(stamp.visitId.toString(), visit._id.toString())
  assert.equal(customerReward.rewardId.toString(), reward._id.toString())
})

test('defines required ownership and query indexes', () => {
  const customerIndexes = Customer.schema.indexes()
  const visitIndexes = Visit.schema.indexes()
  const qrIndexes = QrSession.schema.indexes()
  const rewardIndexes = CustomerReward.schema.indexes()

  assert.ok(customerIndexes.some(([fields, options]) => fields.businessId === 1 && fields.normalizedPhone === 1 && options.unique))
  assert.ok(customerIndexes.some(([fields]) => fields.businessId === 1 && fields['activitySummary.lastVisitAt'] === -1))
  assert.ok(visitIndexes.some(([fields]) => fields.businessId === 1 && fields.customerId === 1 && fields.occurredAt === -1))
  assert.ok(qrIndexes.some(([fields]) => fields.businessId === 1 && fields.tokenHash === 1 && fields.expiresAt === undefined))
  assert.ok(rewardIndexes.some(([fields]) => fields.businessId === 1 && fields.customerId === 1 && fields.status === 1))
})

test('supports business-scoped queries', { skip: !databaseTestsEnabled }, async () => {
  await Customer.create({ businessId: business._id, name: 'Local Customer', normalizedPhone: '+15550000001', displayPhone: '+1 555 000 0001' })
  await Customer.create({ businessId: otherBusiness._id, name: 'Other Customer', normalizedPhone: '+15550000001', displayPhone: '+1 555 000 0001' })

  const customers = await Customer.find({ businessId: business._id }).lean()
  assert.equal(customers.length, 1)
  assert.equal(customers[0].name, 'Local Customer')
})
