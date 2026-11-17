import { vi } from 'vitest'

// A token whose payload decodes like a real one; it expires in an hour, so the client never refreshes it.
export function fakeToken(expiresInSeconds = 3600) {
  const encode = value => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = { sub: 'user-1', role: 'student', exp: Math.floor(Date.now() / 1000) + expiresInSeconds }
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

export function logInAs(role, user = {}) {
  const token = fakeToken()
  localStorage.setItem('authToken', token)
  localStorage.setItem('authUser', JSON.stringify({ id: `${role}-1`, name: `Test ${role}`, email: `${role}@example.com`, role, ...user }))
  return token
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Replaces fetch with a fake API. `routes` maps "METHOD /path" (query string ignored) to a response body,
// { status, body } or a function (request) => one of those. Every call is recorded in `calls`.
export function mockApi(routes = {}) {
  const calls = []
  const fetchMock = vi.fn(async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://localhost')
    const method = (init.method || 'GET').toUpperCase()
    const request = { method, path: url.pathname, query: Object.fromEntries(url.searchParams), init, url: url.toString() }
    calls.push(request)

    const handler = routes[`${method} ${url.pathname}`]
    if (handler === undefined) return jsonResponse({ message: `No mock for ${method} ${url.pathname}` }, 404)
    const result = typeof handler === 'function' ? await handler(request) : handler
    if (result instanceof Response) return result
    if (result && typeof result === 'object' && 'status' in result && 'body' in result) return jsonResponse(result.body, result.status)
    return jsonResponse(result)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

export function jsonBody(call) {
  return JSON.parse(call.init.body)
}
