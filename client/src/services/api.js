const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '')

export function apiFetch(path, options = {}) {
  let normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (normalizedPath.startsWith('/api/') || normalizedPath === '/api') {
    normalizedPath = normalizedPath.substring(4)
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath
    }
  }

  return fetch(`${apiBaseUrl}${normalizedPath}`, {
    credentials: 'include',
    ...options,
  })
}
