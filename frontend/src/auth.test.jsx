import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import LoginPage from './LoginPage'
import RegistrationPage from './RegistrationPage'
import { jsonBody, mockApi } from './test/helpers'

describe('LoginPage (TC-Auth-02)', () => {
  async function logIn(email, password) {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText('Email address'), email)
    await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: 'Log in' }))
  }

  test('stores the session and opens the home page on success', async () => {
    const { calls } = mockApi({
      'POST /api/auth/login': { message: 'Login successful', token: 'token-123', user: { id: 'u1', name: 'Sam', role: 'student' } },
    })
    await logIn('sam@example.com', 'abcdef12')
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(jsonBody(calls[0])).toEqual({ email: 'sam@example.com', password: 'abcdef12' })
    expect(localStorage.getItem('authToken')).toBe('token-123')
    expect(JSON.parse(localStorage.getItem('authUser')).role).toBe('student')
  })

  test('shows "Invalid email or password" and creates no session', async () => {
    mockApi({ 'POST /api/auth/login': { status: 401, body: { message: 'Invalid email or password' } } })
    await logIn('sam@example.com', 'wrong-password1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(localStorage.getItem('authToken')).toBeNull()
  })

  test('explains when the server cannot be reached', async () => {
    mockApi({ 'POST /api/auth/login': () => { throw new TypeError('Failed to fetch') } })
    await logIn('sam@example.com', 'abcdef12')
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })
})

describe('RegistrationPage (TC-Auth-01, TC-Auth-05)', () => {
  async function register({ name = 'Alex Student', email = 'alex@example.com', password = 'abcdef12', role } = {}) {
    const user = userEvent.setup()
    render(<RegistrationPage />)
    await user.type(screen.getByLabelText('Full name'), name)
    await user.type(screen.getByLabelText('Email address'), email)
    await user.type(screen.getByLabelText('Password'), password)
    if (role) await user.click(screen.getByRole('radio', { name: new RegExp(role, 'i') }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  test('offers only Student and Contributor accounts', () => {
    render(<RegistrationPage />)
    const roles = screen.getAllByRole('radio').map(radio => radio.value)
    expect(roles).toEqual(['student', 'contributor'])
  })

  test('creates a contributor account', async () => {
    const { calls } = mockApi({ 'POST /api/auth/register': { status: 201, body: { user: { name: 'Alex Student' } } } })
    await register({ role: 'Contributor' })
    expect(await screen.findByRole('status')).toHaveTextContent('Welcome, Alex Student!')
    expect(jsonBody(calls[0])).toMatchObject({ name: 'Alex Student', email: 'alex@example.com', role: 'contributor' })
  })

  test.each(['abc12', 'abcdefgh', '12345678'])('rejects the weak password %s with "Password too weak" before calling the API', async (password) => {
    const { calls } = mockApi()
    await register({ password })
    expect(await screen.findByRole('alert')).toHaveTextContent('Password too weak')
    expect(calls).toHaveLength(0)
  })

  test('rejects a one-character name', async () => {
    const { calls } = mockApi()
    await register({ name: 'A' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Name must be between 2 and 50 characters')
    expect(calls).toHaveLength(0)
  })

  test('shows "Email already registered" from the server', async () => {
    mockApi({ 'POST /api/auth/register': { status: 409, body: { message: 'Email already registered' } } })
    await register()
    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered')
  })

  test('explains when the server cannot be reached', async () => {
    mockApi({ 'POST /api/auth/register': () => { throw new TypeError('Failed to fetch') } })
    await register()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })
})
