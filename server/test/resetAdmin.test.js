import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { comparePassword, hashPassword } from '../src/config/auth.js'
import { clearTestDatabase, connectDatabase, disconnectDatabase, resolveDatabaseUri } from '../src/config/database.js'
import { AdminUser, Business } from '../src/models/index.js'
import { resetAdminPassword, validateResetInput } from '../src/cli/resetAdmin.js'

process.env.NODE_ENV = 'test'

const databaseUri = resolveDatabaseUri()
const databaseTestsEnabled = Boolean(databaseUri)

before(async () => {
  if (databaseTestsEnabled) await connectDatabase(databaseUri)
})

beforeEach(async () => {
  if (databaseTestsEnabled) {
    await clearTestDatabase()
  }
})

after(async () => {
  if (databaseTestsEnabled) await disconnectDatabase()
})

test('validates reset fields without exposing password material', () => {
  assert.equal(validateResetInput({ email: 'owner@example.com', password: 'new correct horse battery staple', passwordConfirmation: 'new correct horse battery staple' }), null)
  assert.match(validateResetInput({ email: 'invalid-email', password: 'new correct horse battery staple', passwordConfirmation: 'new correct horse battery staple' }), /email/)
  assert.match(validateResetInput({ email: 'owner@example.com', password: 'short', passwordConfirmation: 'short' }), /12 characters/)
  assert.match(validateResetInput({ email: 'owner@example.com', password: 'new correct horse battery staple', passwordConfirmation: 'different password' }), /match/)
})

test('resets single existing admin account even if inputted email does not match exact email', { skip: !databaseTestsEnabled }, async () => {
  const business = await Business.create({ name: 'Brew & Bean' })
  const oldPassword = 'old password that is long'
  const newPassword = 'new password that is long'
  await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(oldPassword) })

  const result = await resetAdminPassword({ email: 'different@example.com', password: newPassword })

  assert.equal(result.email, 'owner@example.com')
  const updated = await AdminUser.findOne({ email: 'owner@example.com' }).select('+passwordHash').lean()
  assert.equal(await comparePassword(newPassword, updated.passwordHash), true)
})

test('fails safely if multiple admin accounts exist and entered email does not match', { skip: !databaseTestsEnabled }, async () => {
  const business = await Business.create({ name: 'Brew & Bean' })
  const otherBusiness = await Business.create({ name: 'Other Business' })
  await AdminUser.create({ businessId: business._id, email: 'owner1@example.com', passwordHash: await hashPassword('old password 1') })
  await AdminUser.create({ businessId: otherBusiness._id, email: 'owner2@example.com', passwordHash: await hashPassword('old password 2') })

  await assert.rejects(
    () => resetAdminPassword({ email: 'nonexistent@example.com', password: 'new password that is long' }),
    (error) => error.code === 'ADMIN_NOT_FOUND' && error.message.includes('owner1@example.com'),
  )
})

test('resets admin password and updates passwordResetAt metadata', { skip: !databaseTestsEnabled }, async () => {
  const business = await Business.create({ name: 'Brew & Bean' })
  const oldPassword = 'old password that is long'
  const newPassword = 'new password that is long'
  const admin = await AdminUser.create({ businessId: business._id, email: 'owner@example.com', passwordHash: await hashPassword(oldPassword) })

  const result = await resetAdminPassword({ email: 'Owner@Example.com', password: newPassword })

  assert.equal(result.email, 'owner@example.com')
  assert.equal(result.businessId, business._id.toString())
  assert.equal(result.password, undefined)
  assert.equal(result.passwordHash, undefined)

  const updatedAdmin = await AdminUser.findById(admin._id).select('+passwordHash').lean()
  assert.equal(updatedAdmin.businessId.toString(), business._id.toString())
  assert.equal(await comparePassword(oldPassword, updatedAdmin.passwordHash), false)
  assert.equal(await comparePassword(newPassword, updatedAdmin.passwordHash), true)
  assert.ok(updatedAdmin.authMetadata?.passwordResetAt)
})
