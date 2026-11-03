import { useEffect, useState } from 'react'
import { apiRequest, getAuthUser, readJson } from '../api'
import './Performance.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function PerformancePage() {
  const user = getAuthUser()
  const [data, setData] = useState(null)   // null = loading
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.role !== 'student') return
    let cancelled = false

    async function load() {
      try {
        const response = await apiRequest('/api/reports/student/me')
        const result = await readJson(response)
        if (!response.ok) throw new Error(result.message || 'Could not load performance data.')
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not reach the server.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.role])

  if (user?.role !== 'student') {
    return (
      <section className="perf-page">
        <div className="status-message error" role="alert">Access denied. Only Students can view this page.</div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="perf-page">
        <div className="status-message error" role="alert">{error}</div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="perf-page">
        <p role="status" style={{ color: 'var(--color-text-muted, #6c757d)' }}>Loading performance data…</p>
      </section>
    )
  }

  const isEmpty = data.attempts.length === 0

  return (
    <section className="perf-page" aria-labelledby="perf-title">

      {/* ── Header ── */}
      <header className="perf-header">
        <p className="eyebrow">MY PROGRESS</p>
        <h1 id="perf-title">Performance</h1>
        <p>Your quiz results and topic scores across all submitted attempts.</p>
      </header>

      {/* ── Overall average card ── */}
      <div className="perf-avg-card" aria-label="Overall average percentage">
        <div className="perf-avg-value" aria-hidden="true">
          {data.overallAveragePercentage}%
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-primary, #1a1a2e)' }}>Overall average</div>
          <div className="perf-avg-label">
            {isEmpty ? 'No attempts yet' : `Across ${data.attempts.length > 20 ? '20+' : data.attempts.length} attempt${data.attempts.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* ── Topics ── */}
      <div className="perf-topics-card">
        <h2 className="perf-section-title">Score by topic</h2>
        {isEmpty || data.topics.length === 0 ? (
          <p className="perf-empty">No attempts yet.</p>
        ) : (
          <table className="perf-topics-table" aria-label="Score by topic">
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Score</th>
                <th scope="col">Answered</th>
                <th scope="col" aria-label="Percentage bar"></th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map(t => (
                <tr key={t.topic}>
                  <td>{t.topic}</td>
                  <td className="perf-score-cell">{t.correct}/{t.answered} ({t.percentage}%)</td>
                  <td>{t.answered}</td>
                  <td className="perf-bar-cell">
                    <div className="perf-bar-track" role="progressbar" aria-valuenow={t.percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.topic}: ${t.percentage}%`}>
                      <div className="perf-bar-fill" style={{ width: `${t.percentage}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Attempts ── */}
      <div className="perf-attempts-card">
        <h2 className="perf-section-title">Last {data.attempts.length > 0 ? Math.min(data.attempts.length, 20) : 0} attempts</h2>
        {isEmpty ? (
          <p className="perf-empty">No attempts yet.</p>
        ) : (
          <table className="perf-attempts-table" aria-label="Recent quiz attempts">
            <thead>
              <tr>
                <th scope="col">Quiz</th>
                <th scope="col">Date</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map(a => (
                <tr key={a.attemptId}>
                  <td>{a.quizTitle}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.submittedAt)}</td>
                  <td className="perf-score-cell">{a.score}/{a.total} ({a.percentage}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </section>
  )
}
