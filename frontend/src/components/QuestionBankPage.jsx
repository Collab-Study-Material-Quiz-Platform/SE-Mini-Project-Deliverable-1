// QuestionBankPage.jsx — Contributors add multiple-choice questions to the shared question bank (CSQ-F-020)
import { useEffect, useState } from 'react'
import { apiRequest, getAuthUser, readJson } from '../api'
import './QuestionBank.css'

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
const OPTION_LABELS = ['A', 'B', 'C', 'D']
const EMPTY_QUESTION = { text: '', options: ['', '', '', ''], correctIndex: 0, topic: '', difficulty: 'Easy' }
const PAGE_SIZE = 20

function QuestionForm({ onSaved }) {
  const [form, setForm] = useState(EMPTY_QUESTION)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  function update(changes) {
    setForm((current) => ({ ...current, ...changes }))
    if (status.message) setStatus({ type: '', message: '' })
  }

  function updateOption(index, value) {
    update({ options: form.options.map((option, i) => (i === index ? value : option)) })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus({ type: '', message: '' })
    try {
      const response = await apiRequest('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await readJson(response)
      if (!response.ok) {
        setStatus({ type: 'error', message: data.message || 'The question could not be saved.' })
        return
      }
      setForm(EMPTY_QUESTION)
      setStatus({ type: 'success', message: 'Question saved to the question bank.' })
      onSaved()
    } catch {
      setStatus({ type: 'error', message: 'Could not reach the server. Make sure the backend is running and try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="qb-card qb-form" onSubmit={handleSubmit} aria-labelledby="qb-form-title">
      <h2 id="qb-form-title">Add a question</h2>
      <div className="form-field">
        <label htmlFor="qb-text">Question text</label>
        <textarea id="qb-text" rows={3} maxLength={500} value={form.text} onChange={(e) => update({ text: e.target.value })} required />
        <span className="field-hint">{form.text.length}/500 characters</span>
      </div>

      <fieldset className="qb-options">
        <legend>Options — select the one correct answer</legend>
        {form.options.map((option, index) => (
          <div className="qb-option" key={OPTION_LABELS[index]}>
            <input
              type="radio"
              name="qb-correct"
              id={`qb-correct-${index}`}
              checked={form.correctIndex === index}
              onChange={() => update({ correctIndex: index })}
              aria-label={`Option ${OPTION_LABELS[index]} is correct`}
            />
            <label className="qb-option-label" htmlFor={`qb-option-${index}`}>{OPTION_LABELS[index]}</label>
            <input
              id={`qb-option-${index}`}
              type="text"
              maxLength={200}
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              required
            />
          </div>
        ))}
      </fieldset>

      <div className="qb-form-row">
        <div className="form-field">
          <label htmlFor="qb-topic">Topic</label>
          <input id="qb-topic" type="text" maxLength={100} placeholder="e.g. Algebra" value={form.topic} onChange={(e) => update({ topic: e.target.value })} required />
        </div>
        <div className="form-field">
          <label htmlFor="qb-difficulty">Difficulty</label>
          <select id="qb-difficulty" value={form.difficulty} onChange={(e) => update({ difficulty: e.target.value })} required>
            {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
          </select>
        </div>
      </div>

      {status.message && (
        <div className={`status-message ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.message}</div>
      )}

      <button className="qb-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save question'}</button>
    </form>
  )
}

export default function QuestionBankPage() {
  const user = getAuthUser()
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const isContributor = user?.role === 'contributor'

  useEffect(() => {
    if (!isContributor) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const response = await apiRequest(`/api/questions?page=${page}&limit=${PAGE_SIZE}`)
        const data = await readJson(response)
        if (cancelled) return
        if (response.ok) {
          setResults(data)
          setError('')
        } else {
          setError(data.message || 'The question bank could not be loaded.')
        }
      } catch {
        if (!cancelled) setError('Could not reach the server. Make sure the backend is running and try again.')
      }
    })()
    return () => { cancelled = true }
  }, [isContributor, page, reloadKey])

  if (!isContributor) {
    return (
      <section className="qb-page">
        <div className="status-message error" role="alert">Access denied. Only Contributors can use the question bank.</div>
      </section>
    )
  }

  function handleSaved() {
    setPage(1)
    setReloadKey((key) => key + 1)
  }

  return (
    <section className="qb-page" aria-labelledby="qb-title">
      <header className="qb-header">
        <h1 id="qb-title">Question bank</h1>
        <p>Build a shared bank of multiple-choice questions with four options and one correct answer.</p>
      </header>

      <QuestionForm onSaved={handleSaved} />

      {error && <div className="status-message error" role="alert">{error}</div>}

      <section aria-labelledby="qb-list-title">
        <h2 id="qb-list-title" className="qb-list-title">
          Questions {results ? <span className="qb-count">({results.total})</span> : null}
        </h2>
        {results && results.total === 0 && <p className="qb-empty">No questions found</p>}
        <ol className="qb-list">
          {results?.questions.map((question) => (
            <li className="qb-card qb-item" key={question.id}>
              <p className="qb-item-text">{question.text}</p>
              <ul className="qb-item-options">
                {question.options.map((option, index) => (
                  <li key={OPTION_LABELS[index]} className={index === question.correctIndex ? 'correct' : ''}>
                    <span className="qb-option-label">{OPTION_LABELS[index]}</span> {option}
                    {index === question.correctIndex && <span className="visually-hidden"> (correct answer)</span>}
                  </li>
                ))}
              </ul>
              <p className="qb-item-tags">
                <span className="qb-tag">{question.topic}</span>
                <span className={`qb-tag difficulty-${question.difficulty.toLowerCase()}`}>{question.difficulty}</span>
                {question.ownerId === user.id && <span className="qb-tag own">Yours</span>}
              </p>
            </li>
          ))}
        </ol>
        {results && results.totalPages > 1 && (
          <nav className="qb-pagination" aria-label="Question bank pages">
            <button className="qb-button secondary" type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</button>
            <span>Page {results.page} of {results.totalPages}</span>
            <button className="qb-button secondary" type="button" onClick={() => setPage(page + 1)} disabled={page >= results.totalPages}>Next</button>
          </nav>
        )}
      </section>
    </section>
  )
}
