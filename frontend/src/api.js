// api.js — shared helpers for authenticated calls to the backend REST API
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
let refreshInFlight = null

export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem('authUser')) || null
  } catch {
    return null
  }
}

export async function apiRequest(path, options = {}) {
  const token = await getFreshToken()
  const send = currentToken => fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}), ...options.headers },
  })
  let response = await send(token)
  const latestToken = localStorage.getItem('authToken')
  if (response.status === 401 && latestToken && latestToken !== token) response = await send(latestToken)
  // An expired or revoked session sends the user back to the login page.
  if (response.status === 401) {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    window.location.hash = '#/login'
  }
  return response
}

async function getFreshToken() {
  const token = localStorage.getItem('authToken')
  if (!token) return null
  try {
    const payloadPart = token.split('.')[1]
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    if (!Number.isFinite(payload.exp) || payload.exp - Date.now() / 1000 > 15 * 60) return token
  } catch {
    return token
  }

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then(async response => {
      const data = await readJson(response)
      if (response.ok && data.token) {
        localStorage.setItem('authToken', data.token)
        if (data.user) localStorage.setItem('authUser', JSON.stringify(data.user))
        return data.token
      }
      return token
    }).catch(() => token).finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export function readJson(response) {
  return response.json().catch(() => ({}))
}
