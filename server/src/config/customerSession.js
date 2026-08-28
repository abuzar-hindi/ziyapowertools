import { createHash, randomBytes } from 'node:crypto'

export const ACCESS_TOKEN_COOKIE = 'loyaltyos_customer'

export function createCustomerSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function customerSessionCookieOptions() {
  const value = Number(process.env.CUSTOMER_SESSION_TTL_MINUTES)
  const minutes = Number.isFinite(value) && value >= 5 && value <= 1440 ? value : 30
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: minutes * 60 * 1000,
    path: '/',
  }
}
