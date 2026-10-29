// api.js — shared helpers for authenticated calls to the backend REST API
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem('authUser')) || null
  } catch {
    return null
  }
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('authToken')
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  // An expired or revoked session sends the user back to the login page.
  if (response.status === 401) {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    window.location.hash = '#/login'
  }
  return response
}

export function readJson(response) {
  return response.json().catch(() => ({}))
}
