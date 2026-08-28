import { createPermanentQr, createQrSession, validateQrToken } from '../services/qrService.js'

export async function createSession(request, response, next) {
  try {
    const session = await createQrSession({ businessId: request.businessId, createdBy: request.admin.id })
    return response.status(201).json({ data: { session } })
  } catch (error) {
    return next(error)
  }
}

export async function validateSession(request, response, next) {
  const { token } = request.body || {}
  if (typeof token !== 'string') return response.status(400).json({ error: { code: 'INVALID_QR', message: 'This QR code is invalid or expired' } })
  try {
    const result = await validateQrToken(token)
    if (!result) return response.status(404).json({ error: { code: 'INVALID_QR', message: 'This QR code is invalid or expired' } })
    return response.json({ data: { business: { name: result.business.name, logo: result.business.logo || '', address: result.business.address || {}, phone: result.business.phone || '', whatsappNumber: result.business.whatsappNumber || '', googleReviewUrl: result.business.googleReviewUrl || '', socialLinks: result.business.socialLinks || {}, settings: result.business.settings || {} }, permanent: Boolean(result.permanent), expiresAt: result.session?.expiresAt || null } })
  } catch (error) {
    return next(error)
  }
}

export async function getPermanentQr(request, response, next) {
  try { return response.json({ data: { qr: await createPermanentQr({ businessId: request.admin.businessId }) } }) } catch (error) { return next(error) }
}

export async function validatePermanent(request, response, next) {
  try {
    const result = await validateQrToken(request.body?.token)
    if (!result || !result.permanent) return response.status(404).json({ error: { code: 'INVALID_QR', message: 'This QR code is invalid or expired' } })
    return response.json({ data: { business: { name: result.business.name, logo: result.business.logo || '', address: result.business.address || {}, phone: result.business.phone || '', whatsappNumber: result.business.whatsappNumber || '', googleReviewUrl: result.business.googleReviewUrl || '', socialLinks: result.business.socialLinks || {}, settings: result.business.settings || {} } } })
  } catch (error) { return next(error) }
}
