import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '../config/auth.js'
import { AdminUser } from '../models/index.js'

export async function authenticateAdmin(request, response, next) {
  const token = request.cookies?.[ACCESS_TOKEN_COOKIE]

  if (!token) {
    return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } })
  }

  try {
    const payload = verifyAccessToken(token)
    if (payload.type !== 'admin' || !payload.sub || !payload.businessId) throw new Error('Invalid token claims')

    const admin = await AdminUser.findOne({ _id: payload.sub, status: 'active' }).select('+passwordHash').lean()
    if (!admin || admin.businessId.toString() !== payload.businessId) {
      return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } })
    }

    request.admin = {
      id: admin._id.toString(),
      businessId: admin.businessId.toString(),
      email: admin.email,
    }
    return next()
  } catch {
    return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } })
  }
}
