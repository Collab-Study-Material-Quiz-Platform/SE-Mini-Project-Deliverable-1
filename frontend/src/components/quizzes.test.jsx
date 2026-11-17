import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import QuizzesPage from './QuizzesPage'
import { jsonBody, logInAs, mockApi } from '../test/helpers'

const ATTEMPT_ID = 'a'.repeat(24)
const attemptHash = `#/quizzes/attempt/${ATTEMPT_ID}`

const questions = [
  { id: 'q1', text: 'What is 2 + 2?', options: ['3', '4', '5', '22'], topic: 'Arithmetic', difficulty: 'Easy' },
  { id: 'q2', text: 'What is 3 x 3?', options: ['6', '9', '12', '33'], topic: 'Arithmetic', difficulty: 'Easy' },
]

function attemptData(attempt = {}) {
  const now = Date.now()
  return {
    quiz: { id: 'quiz1', title: 'Arithmetic check', timeLimitMinutes: 10 },
    questions,
    attempt: {
      id: ATTEMPT_ID, status: 'in_progress', answers: {}, serverProcessingMs: 0,
      serverTime: new Date(now).toISOString(), expiresAt: new Date(now + 10 * 60 * 1000).toISOString(), ...attempt,
    },
  }
}

const result = {
  score: 1, total: 2, percentage: 50, gradedAt: '2026-11-02T10:00:00Z',
  questions: [
    { questionId: 'q1', text: 'What is 2 + 2?', options: ['3', '4', '5', '22'], selectedIndex: 1, correctIndex: 1, correct: true, topic: 'Arithmetic' },
    { questionId: 'q2', text: 'What is 3 x 3?', options: ['6', '9', '12', '33'], selectedIndex: null, correctIndex: 1, correct: false, topic: 'Arithmetic' },
  ],
}

describe('Published quiz list (TC-Quiz-04)', () => {
  test('is denied to anyone who is not a student', () => {
    logInAs('contributor')
    render(<QuizzesPage currentHash="#/quizzes" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only Students can view published quizzes')
  })

  test('lists each published quiz with its title, question count and time limit', async () => {
    logInAs('student')
    mockApi({
      'GET /api/quizzes/published': { quizzes: [
        { id: 'quiz1', title: 'Algebra basics', questionCount: 5, timeLimitMinutes: 15 },
        { id: 'quiz2', title: 'Geometry final', questionCount: 12, timeLimitMinutes: 90 },
      ] },
    })
    render(<QuizzesPage currentHash="#/quizzes" />)
    const algebra = (await screen.findByRole('heading', { name: 'Algebra basics' })).closest('article')
    expect(within(algebra).getByText('5 questions · 15 minutes')).toBeInTheDocument()
    const geometry = screen.getByRole('heading', { name: 'Geometry final' }).closest('article')
    expect(within(geometry).getByText('12 questions · 90 minutes')).toBeInTheDocument()
  })

  test('says when there are no published quizzes', async () => {
    logInAs('student')
    mockApi({ 'GET /api/quizzes/published': { quizzes: [] } })
    render(<QuizzesPage currentHash="#/quizzes" />)
    expect(await screen.findByText('There are no published quizzes yet.')).toBeInTheDocument()
  })

  test('shows an error when the list cannot be loaded', async () => {
    logInAs('student')
    mockApi({ 'GET /api/quizzes/published': { status: 500, body: { message: 'Unable to list published quizzes' } } })
    render(<QuizzesPage currentHash="#/quizzes" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to list published quizzes')
  })

  test('starting a quiz opens the new attempt', async () => {
    logInAs('student')
    mockApi({
      'GET /api/quizzes/published': { quizzes: [{ id: 'quiz1', title: 'Algebra basics', questionCount: 5, timeLimitMinutes: 15 }] },
      'POST /api/quizzes/quiz1/attempts': { status: 201, body: { attempt: { id: ATTEMPT_ID } } },
    })
    render(<QuizzesPage currentHash="#/quizzes" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Start quiz' }))
    await waitFor(() => expect(window.location.hash).toBe(attemptHash))
  })

  test('shows why a quiz could not be started', async () => {
    logInAs('student')
    mockApi({
      'GET /api/quizzes/published': { quizzes: [{ id: 'quiz1', title: 'Algebra basics', questionCount: 5, timeLimitMinutes: 15 }] },
      'POST /api/quizzes/quiz1/attempts': { status: 404, body: { message: 'Quiz not found' } },
    })
    render(<QuizzesPage currentHash="#/quizzes" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Start quiz' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Quiz not found')
  })
})

describe('Quiz attempt (TC-Quiz-02)', () => {
  test('is denied to anyone who is not a student', () => {
    logInAs('admin')
    mockApi({ [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData() })
    render(<QuizzesPage currentHash={attemptHash} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only Students can attempt quizzes')
  })

  test('shows the questions and a countdown timer from the server time', async () => {
    logInAs('student')
    mockApi({ [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData() })
    render(<QuizzesPage currentHash={attemptHash} />)
    expect(await screen.findByRole('heading', { name: 'Arithmetic check' })).toBeInTheDocument()
    const timer = screen.getByRole('timer')
    expect(timer).toHaveTextContent(/Time remaining(10:00|09:5\d)/)
    expect(screen.getByRole('group', { name: /Question 1/ })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(8)
  })

  test('saves each answer as soon as it is chosen', async () => {
    logInAs('student')
    const { calls } = mockApi({
      [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData(),
      [`PUT /api/quizzes/attempts/${ATTEMPT_ID}/answers`]: ({ init }) => ({ attempt: { ...attemptData().attempt, answers: { [JSON.parse(init.body).questionId]: JSON.parse(init.body).selectedIndex } } }),
    })
    render(<QuizzesPage currentHash={attemptHash} />)
    const firstQuestion = await screen.findByRole('group', { name: /What is 2 \+ 2\?/ })
    await userEvent.click(within(firstQuestion).getByRole('radio', { name: /4/ }))
    await waitFor(() => expect(within(firstQuestion).getByRole('radio', { name: /4/ })).toBeChecked())
    expect(jsonBody(calls.find(call => call.method === 'PUT'))).toEqual({ questionId: 'q1', selectedIndex: 1 })
  })

  test('puts an answer back when it cannot be saved', async () => {
    logInAs('student')
    mockApi({
      [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData(),
      [`PUT /api/quizzes/attempts/${ATTEMPT_ID}/answers`]: { status: 409, body: { message: 'Quiz attempt is already submitted' } },
    })
    render(<QuizzesPage currentHash={attemptHash} />)
    const firstQuestion = await screen.findByRole('group', { name: /What is 2 \+ 2\?/ })
    await userEvent.click(within(firstQuestion).getByRole('radio', { name: /4/ }))
    expect(await screen.findByText('Quiz attempt is already submitted')).toBeInTheDocument()
    expect(within(firstQuestion).getByRole('radio', { name: /4/ })).not.toBeChecked()
  })

  test('TC-Quiz-03: submitting shows the score, percentage and correct answer to each question', async () => {
    logInAs('student')
    mockApi({
      [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData(),
      [`POST /api/quizzes/attempts/${ATTEMPT_ID}/submit`]: { attempt: { ...attemptData().attempt, status: 'submitted', result } },
    })
    render(<QuizzesPage currentHash={attemptHash} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Submit attempt' }))

    expect(await screen.findByRole('heading', { name: 'Arithmetic check' })).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    const [first, second] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('Correct')
    expect(first).toHaveTextContent('Your answer: B. 4')
    expect(first).toHaveTextContent('Correct answer: B. 4')
    expect(second).toHaveTextContent('Not answered')
    expect(second).toHaveTextContent('Correct answer: B. 9')
  })

  test('a repeated submit that returns 409 with the stored result still shows the result', async () => {
    logInAs('student')
    mockApi({
      [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData(),
      [`POST /api/quizzes/attempts/${ATTEMPT_ID}/submit`]: { status: 409, body: { message: 'Quiz attempt is already submitted', attempt: { status: 'submitted', result } } },
    })
    render(<QuizzesPage currentHash={attemptHash} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Submit attempt' }))
    expect(await screen.findByText('1/2')).toBeInTheDocument()
  })

  test('a failed submit keeps the attempt open and explains the error', async () => {
    logInAs('student')
    mockApi({
      [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData(),
      [`POST /api/quizzes/attempts/${ATTEMPT_ID}/submit`]: { status: 500, body: { message: 'Unable to submit quiz attempt' } },
    })
    render(<QuizzesPage currentHash={attemptHash} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Submit attempt' }))
    expect(await screen.findByText('Unable to submit quiz attempt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit attempt' })).toBeEnabled()
  })

  test('auto-submits when the time is already up (TC-Quiz-02)', async () => {
    logInAs('student')
    const now = Date.now()
    const { calls } = mockApi({
      [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData({ serverTime: new Date(now).toISOString(), expiresAt: new Date(now - 1000).toISOString() }),
      [`POST /api/quizzes/attempts/${ATTEMPT_ID}/submit`]: { attempt: { ...attemptData().attempt, status: 'timed_out', result } },
    })
    render(<QuizzesPage currentHash={attemptHash} />)
    expect(await screen.findByText('Time ran out, so the answers you had given were submitted automatically.')).toBeInTheDocument()
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(1)
  })

  test('opening a finished attempt shows its result', async () => {
    logInAs('student')
    mockApi({ [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: attemptData({ status: 'submitted', result }) })
    render(<QuizzesPage currentHash={attemptHash} />)
    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  test('shows an error when the attempt cannot be loaded', async () => {
    logInAs('student')
    mockApi({ [`GET /api/quizzes/attempts/${ATTEMPT_ID}`]: { status: 404, body: { message: 'Quiz attempt not found' } } })
    render(<QuizzesPage currentHash={attemptHash} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Quiz attempt not found')
    expect(screen.getByRole('link', { name: 'Back to quizzes' })).toHaveAttribute('href', '#/quizzes')
  })
})
