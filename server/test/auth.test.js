import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase, clearTestDatabase } from '../src/config/database.js'
import { hashPassword } from '../src/config/auth.js'
import { AdminUser, Business } from '../src/models/index.js'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ||= 'test-secret-that-is-longer-than-32-characters'
process.env.FRONTEND_ORIGIN ||= 'http://localhost:5173'

const { default: app } = await import('../src/app.js')
const { createAccessToken, ACCESS_TOKEN_COOKIE } = await import('../src/config/auth.js')

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

async function loginAgent() {
  const agent = request.agent(app)
  await agent.post('/api/auth/login').send({ email: admin.email, password })
  return agent
}

test('logs in successfully and returns only the public admin identity', async () => {
  const response = await request(app).post('/api/auth/login').send({ email: admin.email, password })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.admin.email, admin.email)
  assert.equal(response.body.data.admin.businessId, business._id.toString())
  assert.equal(response.body.data.admin.passwordHash, undefined)
  assert.match(response.headers['set-cookie'][0], new RegExp(`${ACCESS_TOKEN_COOKIE}=`))
  assert.match(response.headers['set-cookie'][0], /HttpOnly/)
})

test('rejects wrong passwords, unknown admins, missing, and malformed credentials safely', async () => {
  const cases = [
    { email: admin.email, password: 'wrong password' },
    { email: 'unknown@example.com', password },
    {},
    { email: 42, password: true },
  ]
  for (const credentials of cases) {
    const response = await request(app).post('/api/auth/login').send(credentials)
    assert.ok([400, 401].includes(response.status))
    assert.ok(response.body.error)
    assert.equal(response.body.data, undefined)
    assert.equal(JSON.stringify(response.body).includes('passwordHash'), false)
  }
})

test('validates current session and rejects missing, invalid, and expired JWTs', async () => {
  const agent = await loginAgent()
  assert.equal((await agent.get('/api/auth/me')).status, 200)
  assert.equal((await request(app).get('/api/auth/me')).status, 401)
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', `${ACCESS_TOKEN_COOKIE}=malformed`)).status, 401)

  const expired = jwt.sign({ sub: admin._id.toString(), businessId: business._id.toString(), type: 'admin' }, process.env.JWT_SECRET, { expiresIn: -1 })
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expired}`)).status, 401)
})

test('JWT contains only minimal non-sensitive claims', () => {
  const token = createAccessToken(admin)
  const payload = jwt.decode(token)
  assert.deepEqual(payload.type, 'admin')
  assert.equal(payload.sub, admin._id.toString())
  assert.equal(payload.businessId, business._id.toString())
  assert.equal(payload.password, undefined)
  assert.equal(payload.passwordHash, undefined)
})

test('enforces the authenticated business scope over a client-supplied businessId', async () => {
  const agent = await loginAgent()
  const own = await agent.get(`/api/auth/admin-shell?businessId=${business._id}`)
  assert.equal(own.status, 200)
  assert.equal(own.body.data.businessId, business._id.toString())

  const other = await agent.get(`/api/auth/admin-shell?businessId=${otherBusiness._id}`)
  assert.equal(other.status, 403)
  assert.equal(other.body.error.message, 'Access denied')
})

test('clears the session on logout', async () => {
  const agent = await loginAgent()
  const response = await agent.post('/api/auth/logout')
  assert.equal(response.status, 200)
  assert.equal(response.body.data.loggedOut, true)
  assert.match(response.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
  assert.equal((await agent.get('/api/auth/me')).status, 401)
})

test('includes security headers and allows only the configured CORS origin', async () => {
  const allowed = await request(app).get('/api/health').set('Origin', process.env.FRONTEND_ORIGIN)
  assert.equal(allowed.headers['access-control-allow-origin'], process.env.FRONTEND_ORIGIN)
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true')
  assert.ok(allowed.headers['x-content-type-options'])
  assert.ok(allowed.headers['content-security-policy'])

  const rejected = await request(app).get('/api/health').set('Origin', 'https://untrusted.example')
  assert.equal(rejected.headers['access-control-allow-origin'], undefined)
})

test('rejects request bodies over the configured limit', async () => {
  const response = await request(app).post('/api/auth/login').send({ email: 'a'.repeat(11_000), password })
  assert.equal(response.status, 413)
})

test('activates the login rate limit after ten attempts', async () => {
  const responses = []
  for (let attempt = 0; attempt < 20; attempt += 1) {
    responses.push(await request(app).post('/api/auth/login').send({ email: 'unknown@example.com', password: 'wrong' }))
  }
  assert.equal(responses.some((response) => response.status === 401), true)
  assert.equal(responses.some((response) => response.status === 429), true)
  assert.equal(responses.at(-1).status, 429)
})
