import { describe, expect, test } from 'vitest'
import { apiRequest, getAuthUser, readJson } from './api'
import { fakeToken, jsonResponse, logInAs, mockApi } from './test/helpers'

describe('getAuthUser', () => {
  test('returns the stored user', () => {
    logInAs('student')
    expect(getAuthUser()).toMatchObject({ role: 'student' })
  })

  test('returns null when nothing or invalid JSON is stored', () => {
    expect(getAuthUser()).toBeNull()
    localStorage.setItem('authUser', '{not json')
    expect(getAuthUser()).toBeNull()
  })
})

describe('apiRequest', () => {
  test('sends the stored token as a bearer header', async () => {
    const token = logInAs('student')
    const { calls } = mockApi({ 'GET /api/materials': { materials: [] } })
    const response = await apiRequest('/api/materials')
    expect(response.status).toBe(200)
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${token}`)
  })

  test('sends no authorization header when logged out', async () => {
    const { calls } = mockApi({ 'GET /api/health': { status: 'OK' } })
    await apiRequest('/api/health')
    expect(calls[0].init.headers.Authorization).toBeUndefined()
  })

  test('a 401 response clears the session and opens the login page (TC-Auth-04)', async () => {
    logInAs('student')
    mockApi({ 'GET /api/auth/me': { status: 401, body: { message: 'Unauthorized' } } })
    await apiRequest('/api/auth/me')
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(localStorage.getItem('authUser')).toBeNull()
    expect(window.location.hash).toBe('#/login')
  })

  test('refreshes a token that expires within 15 minutes before calling the API', async () => {
    localStorage.setItem('authToken', fakeToken(5 * 60))
    const fresh = fakeToken(30 * 60)
    const { calls } = mockApi({
      'POST /api/auth/refresh': { token: fresh, user: { id: 'u1', role: 'student' } },
      'GET /api/materials': { materials: [] },
    })
    await apiRequest('/api/materials')
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(['POST /api/auth/refresh', 'GET /api/materials'])
    expect(calls[1].init.headers.Authorization).toBe(`Bearer ${fresh}`)
    expect(localStorage.getItem('authToken')).toBe(fresh)
  })

  test('keeps the old token when the refresh fails', async () => {
    const old = fakeToken(60)
    localStorage.setItem('authToken', old)
    const { calls } = mockApi({
      'POST /api/auth/refresh': { status: 503, body: { message: 'Unable to refresh session' } },
      'GET /api/materials': { materials: [] },
    })
    await apiRequest('/api/materials')
    expect(calls[1].init.headers.Authorization).toBe(`Bearer ${old}`)
  })

  test('uses a token that cannot be decoded as it is', async () => {
    localStorage.setItem('authToken', 'not-a-jwt')
    const { calls } = mockApi({ 'GET /api/materials': { materials: [] } })
    await apiRequest('/api/materials')
    expect(calls).toHaveLength(1)
    expect(calls[0].init.headers.Authorization).toBe('Bearer not-a-jwt')
  })
})

describe('readJson', () => {
  test('parses JSON and falls back to an empty object', async () => {
    expect(await readJson(jsonResponse({ ok: true }))).toEqual({ ok: true })
    expect(await readJson(new Response('not json'))).toEqual({})
  })
})
