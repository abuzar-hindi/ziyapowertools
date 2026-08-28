export function errorHandler(error, _request, response, _next) {
  const status = error.status || error.statusCode || 500
  if (status >= 500) console.error(`Request failed: ${error.message}`)
  return response.status(status).json({
    error: {
      code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
      message: status === 413 ? 'Request body is too large' : 'Something went wrong',
    },
  })
}
