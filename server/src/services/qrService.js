import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import QRCode from 'qrcode'
import { Business, QrSession } from '../models/index.js'

const tokenPattern = /^[A-Za-z0-9_-]{43}$/
const permanentTokenPattern = /^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/

export function createQrToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function isValidQrToken(token) {
  return typeof token === 'string' && tokenPattern.test(token)
}

function permanentSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return secret
}

export function permanentQrToken(businessId) {
  const id = businessId.toString()
  const signature = createHmac('sha256', permanentSecret()).update(`digistamp:${id}`).digest('base64url')
  return `${id}.${signature.slice(0, 43)}`
}

export async function createPermanentQr({ businessId }) {
  const token = permanentQrToken(businessId)
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
  const customerUrl = `${origin}/customer?qr=${encodeURIComponent(token)}`
  return { token, customerUrl, qrImage: await QRCode.toDataURL(customerUrl), permanent: true }
}

export function isValidPermanentQrToken(token) {
  return typeof token === 'string' && permanentTokenPattern.test(token)
}

export function permanentQrBusinessId(token) {
  if (!isValidPermanentQrToken(token)) return null
  const [businessId, signature] = token.split('.')
  const expected = permanentQrToken(businessId).split('.')[1]
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? businessId : null
}

function ttlMinutes() {
  const value = Number(process.env.QR_SESSION_TTL_MINUTES)
  return Number.isFinite(value) && value >= 1 && value <= 60 ? value : 15
}

export async function createQrSession({ businessId, createdBy }) {
  const token = createQrToken()
  const expiresAt = new Date(Date.now() + ttlMinutes() * 60 * 1000)
  const session = await QrSession.create({ businessId, createdBy, tokenHash: hashToken(token), expiresAt, status: 'active' })
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
  const customerUrl = `${origin}/customer?qr=${encodeURIComponent(token)}`
  return { id: session._id.toString(), customerUrl, qrImage: await QRCode.toDataURL(customerUrl), expiresAt }
}

export async function validateQrToken(token) {
  const permanentBusinessId = permanentQrBusinessId(token)
  if (permanentBusinessId) {
    const business = await Business.findById(permanentBusinessId).select('_id name logo address phone whatsappNumber googleReviewUrl socialLinks settings').lean()
    return business ? { business, permanent: true, tokenHash: hashToken(token) } : null
  }
  if (!isValidQrToken(token)) return null
  const session = await QrSession.findOne({ tokenHash: hashToken(token), status: 'active', expiresAt: { $gt: new Date() } }).lean()
  if (!session) return null
  const business = await Business.findById(session.businessId).select('_id name logo address phone whatsappNumber googleReviewUrl socialLinks settings').lean()
  if (!business) return null
  return { session, business }
}
