import { useEffect, useState } from 'react'
import { apiRequest, getAuthUser, readJson } from '../api'

export default function AdminPage() {
  const admin = getAuthUser()
  const [materials, setMaterials] = useState(null)
  const [quizzes, setQuizzes] = useState(null)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    if (admin?.role !== 'admin') return
    let cancelled = false

    async function loadAll() {
      try {
        const [matRes, quizRes] = await Promise.all([
          apiRequest('/api/materials'),
          apiRequest('/api/quizzes/all'),
        ])
        const matBody = await readJson(matRes)
        if (!matRes.ok) throw new Error(matBody.message || 'Could not load materials.')
        const quizBody = await readJson(quizRes)
        if (!quizRes.ok) throw new Error(quizBody.message || 'Could not load quizzes.')
        if (!cancelled) {
          setMaterials(matBody.materials || [])
          setQuizzes(quizBody.quizzes || [])
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not reach the server.')
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [admin?.role])

  if (admin?.role !== 'admin') {
    return <section className="quizzes-page"><div className="status-message error" role="alert">Access denied. Only Admins can view this page.</div></section>
  }

  async function handleDelete(type, id) {
    if (!window.confirm('Are you sure you want to delete this item? This cannot be undone.')) return
    setDeletingId(id)
    setError('')
    try {
      const endpoint = type === 'material' ? `/api/materials/${id}` : `/api/quizzes/${id}`
      const response = await apiRequest(endpoint, { method: 'DELETE' })
      const result = await readJson(response)
      if (!response.ok) throw new Error(result.message || 'Deletion failed.')
      // Remove the item from the local list.
      if (type === 'material') {
        setMaterials(prev => (prev || []).filter(m => m.id !== id))
      } else {
        setQuizzes(prev => (prev || []).filter(q => q.id !== id))
      }
    } catch (deleteError) {
      setError(deleteError.message || 'Could not reach the server.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="quizzes-page" aria-labelledby="admin-title">
      <header className="quizzes-header">
        <p className="eyebrow">ADMIN MODERATION</p>
        <h1 id="admin-title">Content moderation</h1>
        <p>Remove any material or quiz. Deleted materials are permanently removed; deleted quizzes are hidden from students.</p>
      </header>

      {error && <div className="status-message error" role="alert">{error}</div>}

      <h2 className="eyebrow" style={{ marginTop: '1rem' }}>MATERIALS</h2>
      {materials === null && !error && <p className="quiz-empty" role="status">Loading materials…</p>}
      {materials?.length === 0 && <p className="quiz-empty">No materials found.</p>}
      <div className="quiz-list">
        {materials?.map(m => (
          <article className="quiz-card" key={m.id}>
            <div>
              <h2>{m.title}</h2>
              <p>{m.subject} · {m.topic} · {m.originalName}</p>
            </div>
            <button
              className="quiz-button"
              type="button"
              onClick={() => handleDelete('material', m.id)}
              disabled={deletingId === m.id}
              style={{ background: '#dc3545' }}
            >
              {deletingId === m.id ? 'Deleting…' : 'Delete'}
            </button>
          </article>
        ))}
      </div>

      <h2 className="eyebrow" style={{ marginTop: '1.5rem' }}>QUIZZES</h2>
      {quizzes === null && !error && <p className="quiz-empty" role="status">Loading quizzes…</p>}
      {quizzes?.length === 0 && <p className="quiz-empty">No quizzes found.</p>}
      <div className="quiz-list">
        {quizzes?.map(q => (
          <article className="quiz-card" key={q.id}>
            <div>
              <h2>{q.title}</h2>
              <p>{q.questionCount} questions · {q.timeLimitMinutes} min · status: {q.status}</p>
            </div>
            <button
              className="quiz-button"
              type="button"
              onClick={() => handleDelete('quiz', q.id)}
              disabled={deletingId === q.id}
              style={{ background: '#dc3545' }}
            >
              {deletingId === q.id ? 'Deleting…' : 'Delete'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
