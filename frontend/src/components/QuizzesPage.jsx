import { useEffect, useRef, useState } from 'react'
import { apiRequest, getAuthUser, readJson } from '../api'
import './Quizzes.css'

const OPTIONS = ['A', 'B', 'C', 'D']

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function useAttempt(attemptId) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)
  const [answers, setAnswers] = useState({})
  const [savingQuestion, setSavingQuestion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const deadlineRef = useRef(null)
  const submittingRef = useRef(false)
  const autoSubmitAttemptedRef = useRef(false)
  const pendingSavesRef = useRef(new Map())
  const submitAttemptRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function loadAttempt() {
      const requestStartedAt = performance.now()
      try {
        const response = await apiRequest(`/api/quizzes/attempts/${attemptId}`)
        const responseReceivedAt = performance.now()
        const result = await readJson(response)
        if (!response.ok) throw new Error(result.message || 'The quiz attempt could not be loaded.')
        if (cancelled) return
        setData(result)
        setAnswers(result.attempt.answers || {})
        const rtt = responseReceivedAt - requestStartedAt
        const outboundLatency = Math.max(0, (rtt - (result.attempt.serverProcessingMs || 0)) / 2)
        const serverTimeAtResponse = new Date(result.attempt.serverTime).getTime() + outboundLatency
        deadlineRef.current = responseReceivedAt + Math.max(0, new Date(result.attempt.expiresAt).getTime() - serverTimeAtResponse)
        setRemaining(Math.max(0, Math.ceil((deadlineRef.current - performance.now()) / 1000)))
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not reach the server.')
      }
    }
    loadAttempt()
    return () => { cancelled = true }
  }, [attemptId])

  async function submitAttempt(timedOut = false) {
    if (submittingRef.current) return
    submittingRef.current = true
    if (timedOut) autoSubmitAttemptedRef.current = true
    setIsSubmitting(true)
    setNotice(timedOut ? 'Time is up. Submitting your answers…' : 'Submitting your answers…')
    try {
      await Promise.all([...pendingSavesRef.current.values()])
      const response = await apiRequest(`/api/quizzes/attempts/${attemptId}/submit`, { method: 'POST' })
      const result = await readJson(response)
      if (!response.ok) throw new Error(result.message || 'Your attempt could not be submitted.')
      setData(current => current ? { ...current, attempt: result.attempt } : current)
      setNotice(result.attempt.status === 'timed_out' ? 'Time is up. Your answers have been submitted.' : 'Your answers have been submitted.')
    } catch (submitError) {
      setNotice(submitError.message || 'Could not submit your attempt. Check your connection and retry.')
      submittingRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }
  submitAttemptRef.current = submitAttempt

  useEffect(() => {
    if (!data || data.attempt.status !== 'in_progress' || deadlineRef.current === null) return undefined
    const sessionHeartbeat = window.setInterval(() => {
      apiRequest('/api/auth/me').catch(() => {})
    }, 60 * 1000)
    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((deadlineRef.current - performance.now()) / 1000))
      setRemaining(nextRemaining)
      if (nextRemaining === 0 && !autoSubmitAttemptedRef.current) submitAttemptRef.current(true)
    }
    tick()
    const timer = window.setInterval(tick, 100)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(sessionHeartbeat)
    }
  }, [data?.attempt.status, attemptId])

  async function saveAnswer(questionId, selectedIndex) {
    if (isSubmitting || savingQuestion) return
    const previousAnswer = answers[questionId]
    setSavingQuestion(questionId)
    setAnswers(current => ({ ...current, [questionId]: selectedIndex }))
    setNotice('')
    const savePromise = (async () => {
      try {
        const response = await apiRequest(`/api/quizzes/attempts/${attemptId}/answers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, selectedIndex }),
        })
        const result = await readJson(response)
        if (!response.ok) {
          if (result.attempt) setData(current => current ? { ...current, attempt: result.attempt } : current)
          throw new Error(result.message || 'Your answer could not be saved.')
        }
        setAnswers(result.attempt.answers || {})
      } catch (saveError) {
        setAnswers(current => ({ ...current, [questionId]: previousAnswer }))
        setNotice(saveError.message || 'Could not save your answer. Please try again.')
      } finally {
        setSavingQuestion('')
        pendingSavesRef.current.delete(questionId)
      }
    })()
    pendingSavesRef.current.set(questionId, savePromise)
    await savePromise
  }

  return { data, error, remaining, answers, savingQuestion, isSubmitting, notice, submitAttempt, saveAnswer }
}

function QuizList() {
  const student = getAuthUser()
  const [quizzes, setQuizzes] = useState(null)
  const [error, setError] = useState('')
  const [startingId, setStartingId] = useState('')

  useEffect(() => {
    if (student?.role !== 'student') return undefined
    let cancelled = false
    async function loadQuizzes() {
      try {
        const response = await apiRequest('/api/quizzes/published')
        const result = await readJson(response)
        if (!response.ok) throw new Error(result.message || 'Published quizzes could not be loaded.')
        if (!cancelled) setQuizzes(result.quizzes || [])
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Could not reach the server.')
      }
    }
    loadQuizzes()
    return () => { cancelled = true }
  }, [student?.role])

  if (student?.role !== 'student') return <section className="quizzes-page"><div className="status-message error" role="alert">Access denied. Only Students can view published quizzes.</div></section>

  async function startQuiz(quizId) {
    setStartingId(quizId)
    setError('')
    try {
      const response = await apiRequest(`/api/quizzes/${quizId}/attempts`, { method: 'POST' })
      const result = await readJson(response)
      if (!response.ok) throw new Error(result.message || 'The quiz could not be started.')
      window.location.hash = `#/quizzes/attempt/${result.attempt.id}`
    } catch (startError) {
      setError(startError.message || 'Could not reach the server.')
    } finally {
      setStartingId('')
    }
  }

  return <section className="quizzes-page" aria-labelledby="quizzes-title">
    <header className="quizzes-header"><p className="eyebrow">STUDENT QUIZZES</p><h1 id="quizzes-title">Published quizzes</h1><p>Choose a quiz to begin a timed attempt. Your answers are saved as you go.</p></header>
    {error && <div className="status-message error" role="alert">{error}</div>}
    {quizzes === null && !error && <p className="quiz-empty" role="status">Loading published quizzes…</p>}
    {quizzes?.length === 0 && <p className="quiz-empty">There are no published quizzes yet.</p>}
    <div className="quiz-list">
      {quizzes?.map(quiz => <article className="quiz-card" key={quiz.id}>
        <div><h2>{quiz.title}</h2><p>{quiz.questionCount} questions · {quiz.timeLimitMinutes} minutes</p></div>
        <button className="quiz-button" type="button" onClick={() => startQuiz(quiz.id)} disabled={Boolean(startingId)}>
          {startingId === quiz.id ? 'Starting…' : 'Start quiz'}
        </button>
      </article>)}
    </div>
  </section>
}

function QuizAttempt({ attemptId }) {
  const { data, error, remaining, answers, savingQuestion, isSubmitting, notice, submitAttempt, saveAnswer } = useAttempt(attemptId)
  const student = getAuthUser()

  if (student?.role !== 'student') return <section className="quizzes-page"><div className="status-message error" role="alert">Access denied. Only Students can attempt quizzes.</div></section>
  if (error) return <section className="quizzes-page"><div className="status-message error" role="alert">{error}</div><a href="#/quizzes">Back to quizzes</a></section>
  if (!data) return <section className="quizzes-page"><p role="status">Loading quiz…</p></section>

  const isActive = data.attempt.status === 'in_progress'
  const timeText = remaining === null ? '--:--' : formatTime(remaining)

  return <section className="quizzes-page attempt-page" aria-labelledby="attempt-title">
    <header className="attempt-header">
      <div><p className="eyebrow">TIMED ATTEMPT</p><h1 id="attempt-title">{data.quiz.title}</h1><p>{data.questions.length} questions</p></div>
      <div className={`attempt-timer${remaining !== null && remaining <= 60 ? ' urgent' : ''}`} role="timer" aria-live="off" aria-label={`Time remaining ${timeText}`}>
        <span>Time remaining</span><strong>{timeText}</strong>
      </div>
    </header>

    {notice && <div className={`status-message ${isActive && isSubmitting ? '' : 'success'}`} role="status">{notice}</div>}
    {!isActive && <div className="status-message success" role="status">{data.attempt.status === 'timed_out' ? 'This attempt timed out.' : 'This attempt has been submitted.'}</div>}

    <ol className="attempt-question-list">
      {data.questions.map((question, questionNumber) => (
        <li className="attempt-question" key={question.id}>
          <fieldset disabled={!isActive || isSubmitting || Boolean(savingQuestion)}>
            <legend><span>Question {questionNumber + 1}</span>{question.text}</legend>
            <div className="attempt-options">
              {question.options.map((option, index) => (
                <label className={`attempt-option${answers[question.id] === index ? ' selected' : ''}`} key={`${question.id}-${index}`}>
                  <input type="radio" name={`answer-${question.id}`} checked={answers[question.id] === index} onChange={() => saveAnswer(question.id, index)} />
                  <span className="attempt-option-letter">{OPTIONS[index]}</span><span>{option}</span>
                </label>
              ))}
            </div>
            {savingQuestion === question.id && <span className="answer-saving" role="status">Saving answer…</span>}
          </fieldset>
        </li>
      ))}
    </ol>

    {isActive && <div className="attempt-submit-row"><p>Your selected answers are saved automatically.</p><button className="quiz-button" type="button" onClick={() => submitAttempt(false)} disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit attempt'}</button></div>}
    <a href="#/quizzes">Back to published quizzes</a>
  </section>
}

export default function QuizzesPage({ currentHash }) {
  const attemptMatch = currentHash.match(/^#\/quizzes\/attempt\/([a-f\d]{24})$/i)
  return attemptMatch ? <QuizAttempt attemptId={attemptMatch[1]} /> : <QuizList />
}
