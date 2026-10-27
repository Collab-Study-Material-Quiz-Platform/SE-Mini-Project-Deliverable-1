import { useState } from 'react'
import './RegistrationPage.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function RegistrationPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (status.message) setStatus({ type: '', message: '' })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ type: '', message: '' })

    const normalizedName = form.name.trim()
    if (normalizedName.length < 2 || normalizedName.length > 50) {
      setStatus({
        type: 'error',
        message: 'Name must be between 2 and 50 characters.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: normalizedName }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setStatus({
          type: 'error',
          message: data.message || 'Registration failed. Please check your details.',
        })
        return
      }

      setStatus({
        type: 'success',
        message: `Welcome, ${data.user?.name || normalizedName}! Your account has been created.`,
      })
      setForm({ name: '', email: '', password: '', role: 'student' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not reach the server. Make sure the backend is running and try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="registration-layout" aria-labelledby="page-title">
      <div className="intro-panel">
        <p className="eyebrow">YOUR LEARNING COMMUNITY</p>
        <h1 id="page-title">Make learning a team effort.</h1>
        <p className="intro-copy">
          Join a community to share study materials, explore questions, and learn together.
        </p>
        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon" aria-hidden="true">01</span>
            <div>
              <h2>Share knowledge</h2>
              <p>Build a useful library of study resources.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon" aria-hidden="true">02</span>
            <div>
              <h2>Practice together</h2>
              <p>Use questions and quizzes to reinforce learning.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="form-heading">
          <p className="eyebrow">GET STARTED</p>
          <h2>Create your account</h2>
          <p>Enter your details to join the platform.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Alex Student"
              value={form.name}
              onChange={handleChange}
              minLength={2}
              maxLength={50}
              required
            />
            <span className="field-hint">2–50 characters</span>
          </div>

          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
            />
            <span className="field-hint">Use a password you do not use elsewhere.</span>
          </div>

          <fieldset className="role-field">
            <legend>Account type</legend>
            <label className={form.role === 'student' ? 'role-option selected' : 'role-option'}>
              <input
                type="radio"
                name="role"
                value="student"
                checked={form.role === 'student'}
                onChange={handleChange}
              />
              <span>
                <strong>Student</strong>
                <small>Access learning materials and quizzes</small>
              </span>
            </label>
            <label className={form.role === 'contributor' ? 'role-option selected' : 'role-option'}>
              <input
                type="radio"
                name="role"
                value="contributor"
                checked={form.role === 'contributor'}
                onChange={handleChange}
              />
              <span>
                <strong>Contributor</strong>
                <small>Help grow the learning library</small>
              </span>
            </label>
          </fieldset>

          {status.message && (
            <div className={`status-message ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
              {status.message}
            </div>
          )}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
          <p className="form-footnote">
            Administrator accounts cannot be created through public registration.
          </p>
        </form>
      </div>
    </section>

  )
}

export default RegistrationPage
