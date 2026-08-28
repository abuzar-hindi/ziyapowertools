export function requireBusinessScope(request, response, next) {
  const requestedBusinessId = request.params.businessId || request.query.businessId || request.body?.businessId

  if (requestedBusinessId && requestedBusinessId !== request.admin.businessId) {
    return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } })
  }

  request.businessId = request.admin.businessId
  return next()
}
