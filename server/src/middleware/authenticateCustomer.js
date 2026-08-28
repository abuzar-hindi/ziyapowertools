import { ACCESS_TOKEN_COOKIE, hashToken } from '../config/customerSession.js'
import { CustomerSession } from '../models/index.js'

export async function authenticateCustomer(request, response, next) {
  const token = request.cookies?.[ACCESS_TOKEN_COOKIE]
  if (!token) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Customer session required' } })

  try {
    const session = await CustomerSession.findOne({ tokenHash: hashToken(token), status: 'active', expiresAt: { $gt: new Date() } }).lean()
    if (!session) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Customer session required' } })
    request.customer = { id: session.customerId.toString(), businessId: session.businessId.toString() }
    request.businessId = session.businessId.toString()
    return next()
  } catch {
    return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Customer session required' } })
  }
}
