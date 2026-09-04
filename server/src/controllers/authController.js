import {
  ACCESS_TOKEN_COOKIE,
  authCookieOptions,
  comparePassword,
  createAccessToken,
} from '../config/auth.js'
import { AdminUser } from '../models/index.js'

const invalidCredentials = () => ({
  error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
})

function publicAdmin(admin) {
  return {
    id: admin._id.toString(),
    email: admin.email,
    businessId: admin.businessId.toString(),
  }
}

export async function login(request, response, next) {
  const { email, password } = request.body || {}

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Email and password are required' } })
  }

  try {
    const admin = await AdminUser.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
    if (!admin || admin.status !== 'active' || !(await comparePassword(password, admin.passwordHash))) {
      return response.status(401).json(invalidCredentials())
    }

    response.cookie(ACCESS_TOKEN_COOKIE, createAccessToken(admin), authCookieOptions())
    return response.json({ data: { admin: publicAdmin(admin) } })
  } catch (error) {
    return next(error)
  }
}

export function currentAdmin(request, response) {
  return response.json({ data: { admin: request.admin } })
}

export function logout(_request, response) {
  return response.clearCookie(ACCESS_TOKEN_COOKIE, authCookieOptions())
    .json({ data: { loggedOut: true } })
}

export function protectedAdminShell(request, response) {
  return response.json({ data: { ready: true, businessId: request.businessId, adminId: request.admin.id } })
}
