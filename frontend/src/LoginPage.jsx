import { useState } from 'react'
import './RegistrationPage.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setStatus({ type: 'error', message: data.message || 'Login failed.' })
        return
      }
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('authUser', JSON.stringify(data.user))
      window.location.hash = '#/'
    } catch {
      setStatus({ type: 'error', message: 'Could not reach the server. Make sure the backend is running and try again.' })
    } finally { setIsSubmitting(false) }
  }

  return <section className="registration-layout" aria-labelledby="login-title">
    <div className="intro-panel"><p className="eyebrow">WELCOME BACK</p><h1 id="login-title">Keep learning together.</h1><p className="intro-copy">Sign in to access your study materials, quizzes, and progress.</p></div>
    <div className="form-card"><div className="form-heading"><p className="eyebrow">SIGN IN</p><h2>Log in to your account</h2><p>Use the email and password associated with your account.</p></div>
      <form onSubmit={handleSubmit}>
        <div className="form-field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="form-field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
        {status.message && <div className="status-message error" role="alert">{status.message}</div>}
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Log in'}</button>
      </form>
    </div>
  </section>
}
