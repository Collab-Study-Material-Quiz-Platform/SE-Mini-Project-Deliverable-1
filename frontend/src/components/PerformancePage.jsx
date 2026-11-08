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
    if (user?.role !== 'student' && user?.role !== 'contributor') return
    let cancelled = false

    async function load() {
      try {
        const endpoint = user.role === 'contributor'
          ? '/api/reports/contributor/quizzes'
          : '/api/reports/student/me'
        const response = await apiRequest(endpoint)
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

  if (user?.role !== 'student' && user?.role !== 'contributor') {
    return (
      <section className="perf-page">
        <div className="status-message error" role="alert">
          Access denied. Only Students and Contributors can view performance reports.
        </div>
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

  // ── Contributor Performance View (CSQ-F-041) ──────────────────────────────
  if (user.role === 'contributor') {
    const quizzes = data.quizzes || []
    return (
      <section className="perf-page" aria-labelledby="perf-contrib-title">
        <header className="perf-header">
          <p className="eyebrow">CONTRIBUTOR ANALYTICS</p>
          <h1 id="perf-contrib-title">Quiz Statistics</h1>
          <p>Performance metrics, attempt scores, and hardest questions for your authored quizzes.</p>
        </header>

        {quizzes.length === 0 ? (
          <div className="perf-empty">
            <p>You have not created any quizzes yet.</p>
          </div>
        ) : (
          <div className="contrib-quizzes-grid">
            {quizzes.map((quiz) => (
              <article key={quiz.quizId} className="contrib-quiz-card" aria-label={`Statistics for ${quiz.quizTitle}`}>
                <div className="contrib-quiz-card-header">
                  <h2 className="contrib-quiz-title">{quiz.quizTitle}</h2>
                  <span className="contrib-quiz-badge">
                    {quiz.attemptCount} {quiz.attemptCount === 1 ? 'attempt' : 'attempts'}
                  </span>
                </div>

                <div className="contrib-metrics-row">
                  <div className="contrib-metric-box">
                    <span className="contrib-metric-num">{quiz.attemptCount}</span>
                    <span className="contrib-metric-label">Attempts</span>
                  </div>
                  <div className="contrib-metric-box">
                    <span className="contrib-metric-num">{quiz.averageScore}</span>
                    <span className="contrib-metric-label">Average Score</span>
                  </div>
                  <div className="contrib-metric-box">
                    <span className="contrib-metric-num">{quiz.highestScore}</span>
                    <span className="contrib-metric-label">Highest Score</span>
                  </div>
                  <div className="contrib-metric-box">
                    <span className="contrib-metric-num">{quiz.lowestScore}</span>
                    <span className="contrib-metric-label">Lowest Score</span>
                  </div>
                </div>

                <div className="contrib-hardest-section">
                  <h3 className="contrib-hardest-heading">3 Hardest Questions</h3>
                  {quiz.attemptCount === 0 || quiz.hardestQuestions.length === 0 ? (
                    <p className="contrib-no-data">No attempts submitted yet.</p>
                  ) : (
                    <div className="contrib-hardest-list">
                      {quiz.hardestQuestions.map((q, idx) => (
                        <div key={q.questionId || idx} className="contrib-hardest-item">
                          <div className="contrib-hardest-rank">#{idx + 1}</div>
                          <div className="contrib-hardest-body">
                            <p className="contrib-hardest-text">{q.text}</p>
                            <div className="contrib-hardest-meta">
                              <div
                                className="perf-bar-track contrib-bar"
                                role="progressbar"
                                aria-valuenow={q.correctPercentage}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Correct percentage: ${q.correctPercentage}%`}
                              >
                                <div
                                  className="perf-bar-fill contrib-bar-fill"
                                  style={{ width: `${q.correctPercentage}%` }}
                                />
                              </div>
                              <span className="contrib-hardest-stat">
                                {q.correctCount}/{q.totalAttempts} correct ({q.correctPercentage}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  // ── Student Performance View (CSQ-F-040) ──────────────────────────────────
  const isEmpty = data.attempts.length === 0

  return (
    <section className="perf-page" aria-labelledby="perf-title">
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
