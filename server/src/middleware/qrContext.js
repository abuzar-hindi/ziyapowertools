import { validateQrToken } from '../services/qrService.js'

export async function establishQrContext(request, response, next) {
  const token = request.body?.qrToken
  try {
    const result = await validateQrToken(token)
    if (!result) return response.status(404).json({ error: { code: 'INVALID_QR', message: 'This QR code is invalid or expired' } })
    request.qrSession = result.session
    request.businessId = result.business._id.toString()
    request.qrBusiness = result.business
    return next()
  } catch (error) {
    return next(error)
  }
}
