import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import App from './App'
import Home from './components/Home'
import Layout from './components/Layout'
import StatusPage from './components/StatusPage'
import { logInAs, mockApi } from './test/helpers'

function navLinks() {
  return within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link').map(link => link.textContent)
}

describe('App routing (TC-Auth-04)', () => {
  test.each(['#/materials', '#/questions', '#/quizzes', '#/performance', '#/admin'])('%s shows the login page when logged out', (hash) => {
    mockApi({ 'GET /api/health': { status: 'OK' } })
    window.location.hash = hash
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Log in to your account' })).toBeInTheDocument()
  })

  test('opens the matching page for a logged-in user and follows hash changes', async () => {
    logInAs('student')
    mockApi({ 'GET /api/materials': { materials: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }, 'GET /api/health': { status: 'OK' } })
    window.location.hash = '#/materials'
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Study material' })).toBeInTheDocument()

    act(() => {
      window.location.hash = '#/register'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  test('shows the home page for unknown routes', () => {
    mockApi({ 'GET /api/health': { status: 'OK' } })
    window.location.hash = '#/does-not-exist'
    render(<App />)
    expect(screen.getByRole('heading', { name: /Collaborative Study Material/ })).toBeInTheDocument()
  })
})

describe('Layout navigation (TC-Auth-03)', () => {
  test('logged-out visitors see only public links and no logout button', () => {
    render(<Layout currentHash="#/">content</Layout>)
    expect(navLinks()).toEqual(['Home', 'Create account', 'Log in', 'System Status'])
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  test.each([
    ['student', ['Materials', 'Quizzes', 'Performance']],
    ['contributor', ['Materials', 'Upload material', 'Question bank', 'Performance']],
    ['admin', ['Materials', 'Admin']],
  ])('a %s sees only the links for that role', (role, expected) => {
    logInAs(role)
    render(<Layout currentHash="#/">content</Layout>)
    expect(navLinks().slice(4)).toEqual(expected)
  })

  test('marks the current page link', () => {
    render(<Layout currentHash="#/status">content</Layout>)
    expect(screen.getByRole('link', { name: 'System Status' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  test('logout revokes the token on the server and clears the session (TC-Auth-04)', async () => {
    const token = logInAs('student')
    const { calls } = mockApi({ 'POST /api/auth/logout': { message: 'Logout successful' } })
    render(<Layout currentHash="#/">content</Layout>)
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(window.location.hash).toBe('#/login'))
    expect(calls[0].init.headers.Authorization).toBe(`Bearer ${token}`)
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(localStorage.getItem('authUser')).toBeNull()
  })

  test('logout still clears the session when the server is unreachable', async () => {
    logInAs('student')
    mockApi({ 'POST /api/auth/logout': () => { throw new TypeError('Failed to fetch') } })
    render(<Layout currentHash="#/">content</Layout>)
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(localStorage.getItem('authToken')).toBeNull())
  })
})

describe('Home page status badge (CSQ-NF-003)', () => {
  test('reports when all systems are operational', async () => {
    mockApi({ 'GET /api/health': { status: 'OK' } })
    render(<Home />)
    expect(await screen.findByText('All systems operational')).toBeInTheDocument()
  })

  test('reports when the service is unavailable', async () => {
    mockApi({ 'GET /api/health': { status: 503, body: { status: 'DOWN' } } })
    render(<Home />)
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
  })

  test('reports unavailable when the request fails', async () => {
    mockApi({ 'GET /api/health': () => { throw new TypeError('Failed to fetch') } })
    render(<Home />)
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
  })
})

describe('System status page (CSQ-NF-003)', () => {
  const healthy = { status: 'OK', uptimeSeconds: 3725, database: 'connected', startedAt: '2026-11-01T00:00:00Z', time: '2026-11-01T01:02:05Z' }

  test('shows uptime, database state and session availability', async () => {
    mockApi({ 'GET /api/health': healthy })
    render(<StatusPage />)
    expect(await screen.findByText('Operational')).toBeInTheDocument()
    expect(screen.getByText('1h 2m')).toBeInTheDocument()
    expect(screen.getByText('connected')).toBeInTheDocument()
    expect(screen.getByText('1 / 1 checks successful (100.00%)')).toBeInTheDocument()
  })

  test('records a failed check and "Check now" runs another', async () => {
    let healthyNow = false
    mockApi({ 'GET /api/health': () => (healthyNow ? healthy : { status: 503, body: { status: 'DOWN' } }) })
    render(<StatusPage />)
    expect(await screen.findByText('Service unavailable')).toBeInTheDocument()
    expect(screen.getByText('0 / 1 checks successful (0.00%)')).toBeInTheDocument()

    healthyNow = true
    await userEvent.click(screen.getByRole('button', { name: 'Check health now' }))
    expect(await screen.findByText('1 / 2 checks successful (50.00%)')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  test.each([
    [42, '42s'],
    [125, '2m 5s'],
    [90061, '1d 1h 1m'],
  ])('formats %i seconds of uptime as %s', async (uptimeSeconds, text) => {
    mockApi({ 'GET /api/health': { ...healthy, uptimeSeconds } })
    render(<StatusPage />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
