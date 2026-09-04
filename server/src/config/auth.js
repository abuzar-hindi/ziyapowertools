import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const PASSWORD_ROUNDS = 12
const ACCESS_TOKEN_COOKIE = 'loyaltyos_admin'

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    const error = new Error('JWT_SECRET must be configured with at least 32 characters')
    error.code = 'JWT_SECRET_INVALID'
    throw error
  }
  return secret
}

export function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_ROUNDS)
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

export function createAccessToken(admin) {
  return jwt.sign(
    { sub: admin._id.toString(), businessId: admin.businessId.toString(), type: 'admin' },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret())
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  }
}

export { ACCESS_TOKEN_COOKIE }
