import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { comparePassword } from '../src/config/auth.js'
import { clearTestDatabase, connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { AdminUser, Business } from '../src/models/index.js'
import { createInitialAdmin, runSetup, validateSetupInput } from '../src/cli/setupAdmin.js'

const databaseUri = process.env.MONGODB_URI
const databaseTestsEnabled = Boolean(databaseUri)

before(async () => {
  if (databaseTestsEnabled) await connectDatabase()
})

beforeEach(async () => {
  if (databaseTestsEnabled) {
    await connectDatabase()
    await clearTestDatabase()
  }
})

after(async () => {
  if (databaseTestsEnabled) await disconnectDatabase()
})

test('validates setup fields without exposing password material', () => {
  assert.equal(validateSetupInput({ businessName: 'Brew & Bean', email: 'owner@example.com', password: 'correct horse battery staple', passwordConfirmation: 'correct horse battery staple' }), null)
  assert.match(validateSetupInput({ businessName: 'B', email: 'owner@example.com', password: 'correct horse battery staple', passwordConfirmation: 'correct horse battery staple' }), /Business name/)
  assert.match(validateSetupInput({ businessName: 'Brew & Bean', email: 'invalid', password: 'correct horse battery staple', passwordConfirmation: 'correct horse battery staple' }), /email/)
  assert.match(validateSetupInput({ businessName: 'Brew & Bean', email: 'owner@example.com', password: 'short', passwordConfirmation: 'short' }), /12 characters/)
  assert.match(validateSetupInput({ businessName: 'Brew & Bean', email: 'owner@example.com', password: 'correct horse battery staple', passwordConfirmation: 'different password' }), /match/)
})

test('asks for setup values in the required order', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const outputChunks = []
  output.on('data', (chunk) => outputChunks.push(chunk.toString()))
  const answers = {
    'Business name: ': 'Brew & Bean\n',
    'Admin email: ': 'owner@example.com\n',
    'Admin password: ': 'valid password one\n',
    'Confirm password: ': 'valid password two\n',
  }
  let seenPrompts = ''
  output.on('data', (chunk) => {
    seenPrompts += chunk.toString()
    for (const [prompt, answer] of Object.entries(answers)) {
      if (seenPrompts.includes(prompt) && !seenPrompts.includes(`${prompt}[answered]`)) {
        seenPrompts += `${prompt}[answered]`
        input.write(answer)
        break
      }
    }
  })

  await assert.rejects(
    () => runSetup({ input, output }),
    /Passwords do not match/,
  )

  const prompts = outputChunks.join('')
  assert.ok(prompts.indexOf('Business name: ') < prompts.indexOf('Admin email: '))
  assert.ok(prompts.indexOf('Admin email: ') < prompts.indexOf('Admin password: '))
  assert.ok(prompts.indexOf('Admin password: ') < prompts.indexOf('Confirm password: '))
})

test('creates one business and an active hashed admin', { skip: !databaseTestsEnabled }, async () => {
  const password = 'correct horse battery staple'
  const result = await createInitialAdmin({ businessName: 'Brew & Bean', email: 'Owner@Example.com', password })

  assert.equal(result.email, 'owner@example.com')
  assert.equal(result.password, undefined)
  assert.equal(result.passwordHash, undefined)
  assert.equal(await Business.countDocuments(), 1)
  const admin = await AdminUser.findById(result.adminId).select('+passwordHash').lean()
  assert.equal(admin.status, 'active')
  assert.equal(admin.email, 'owner@example.com')
  assert.notEqual(admin.passwordHash, password)
  assert.equal(await comparePassword(password, admin.passwordHash), true)
})

test('prevents accidental duplicate initial setup', { skip: !databaseTestsEnabled }, async () => {
  await createInitialAdmin({ businessName: 'Brew & Bean', email: 'owner@example.com', password: 'correct horse battery staple' })
  await assert.rejects(
    () => createInitialAdmin({ businessName: 'Second Business', email: 'other@example.com', password: 'another correct password' }),
    (error) => error.code === 'ADMIN_ALREADY_EXISTS',
  )
  assert.equal(await Business.countDocuments(), 1)
  assert.equal(await AdminUser.countDocuments(), 1)
})
