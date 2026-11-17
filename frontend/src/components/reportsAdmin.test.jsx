import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import AdminPage from './AdminPage'
import PerformancePage from './PerformancePage'
import { logInAs, mockApi } from '../test/helpers'

describe('Student performance page (TC-Rep-01)', () => {
  test('shows the overall average, the score per topic and the attempts', async () => {
    logInAs('student')
    const { calls } = mockApi({
      'GET /api/reports/student/me': {
        overallAveragePercentage: 66.7,
        topics: [
          { topic: 'Algebra', correct: 3, answered: 4, percentage: 75 },
          { topic: 'Geometry', correct: 1, answered: 2, percentage: 50 },
        ],
        attempts: [
          { attemptId: 'a1', quizTitle: 'Algebra basics', submittedAt: '2026-11-01T10:00:00Z', score: 3, total: 4, percentage: 75 },
          { attemptId: 'a2', quizTitle: 'Geometry final', submittedAt: '2026-11-02T10:00:00Z', score: 1, total: 2, percentage: 50 },
        ],
      },
    })
    render(<PerformancePage />)
    expect(await screen.findByText('66.7%')).toBeInTheDocument()
    expect(screen.getByText('Across 2 attempts')).toBeInTheDocument()
    const topics = screen.getByRole('table', { name: 'Score by topic' })
    expect(within(topics).getByText('3/4 (75%)')).toBeInTheDocument()
    expect(within(topics).getByRole('progressbar', { name: 'Geometry: 50%' })).toBeInTheDocument()
    const attempts = screen.getByRole('table', { name: 'Recent quiz attempts' })
    expect(within(attempts).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'Last 2 attempts' })).toBeInTheDocument()
    expect(calls[0].path).toBe('/api/reports/student/me')
  })

  test('says when there are no attempts yet', async () => {
    logInAs('student')
    mockApi({ 'GET /api/reports/student/me': { overallAveragePercentage: 0, topics: [], attempts: [] } })
    render(<PerformancePage />)
    expect(await screen.findByText('No attempts yet', { selector: '.perf-avg-label' })).toBeInTheDocument()
    expect(screen.getAllByText('No attempts yet.')).toHaveLength(2)
  })

  test('shows an error when the report cannot be loaded', async () => {
    logInAs('student')
    mockApi({ 'GET /api/reports/student/me': { status: 500, body: { message: 'Unable to load performance' } } })
    render(<PerformancePage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load performance')
  })

  test('is denied to admins', () => {
    logInAs('admin')
    render(<PerformancePage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only Students and Contributors can view performance reports')
  })
})

describe('Contributor quiz statistics (TC-Rep-02)', () => {
  test('shows attempts, average, highest, lowest and the hardest questions for each own quiz', async () => {
    logInAs('contributor')
    const { calls } = mockApi({
      'GET /api/reports/contributor/quizzes': { quizzes: [
        {
          quizId: 'quiz1', quizTitle: 'Algebra basics', attemptCount: 5, averageScore: 3.2, highestScore: 5, lowestScore: 1,
          hardestQuestions: [
            { questionId: 'q1', text: 'Solve x^2 = 9', correctCount: 1, totalAttempts: 5, correctPercentage: 20 },
            { questionId: 'q2', text: 'Factor x^2 - 1', correctCount: 2, totalAttempts: 5, correctPercentage: 40 },
            { questionId: 'q3', text: 'Expand (x + 1)^2', correctCount: 3, totalAttempts: 5, correctPercentage: 60 },
          ],
        },
        { quizId: 'quiz2', quizTitle: 'Unattempted quiz', attemptCount: 0, averageScore: 0, highestScore: 0, lowestScore: 0, hardestQuestions: [] },
      ] },
    })
    render(<PerformancePage />)
    const card = await screen.findByRole('article', { name: 'Statistics for Algebra basics' })
    expect(within(card).getByText('5 attempts')).toBeInTheDocument()
    expect(within(card).getByText('3.2')).toBeInTheDocument()
    expect(within(card).getByText('1/5 correct (20%)')).toBeInTheDocument()
    expect(within(card).getAllByRole('progressbar')).toHaveLength(3)

    const empty = screen.getByRole('article', { name: 'Statistics for Unattempted quiz' })
    expect(within(empty).getByText('No attempts submitted yet.')).toBeInTheDocument()
    expect(calls[0].path).toBe('/api/reports/contributor/quizzes')
  })

  test('says when the contributor has no quizzes', async () => {
    logInAs('contributor')
    mockApi({ 'GET /api/reports/contributor/quizzes': { quizzes: [] } })
    render(<PerformancePage />)
    expect(await screen.findByText('You have not created any quizzes yet.')).toBeInTheDocument()
  })
})

describe('Admin moderation page (TC-Adm-01)', () => {
  const materials = { materials: [{ id: 'm1', title: 'Optics notes', subject: 'Physics', topic: 'Optics', originalName: 'optics.pdf' }] }
  const quizzes = { quizzes: [{ id: 'quiz1', title: 'Algebra basics', questionCount: 5, timeLimitMinutes: 15, status: 'published' }] }

  test('is denied to anyone who is not an admin', () => {
    logInAs('contributor')
    render(<AdminPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only Admins can view this page')
  })

  test('lists materials and quizzes and removes each after confirmation', async () => {
    logInAs('admin')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = mockApi({
      'GET /api/materials': materials,
      'GET /api/quizzes/all': quizzes,
      'DELETE /api/materials/m1': { message: 'Material deleted' },
      'DELETE /api/quizzes/quiz1': { message: 'Quiz deleted' },
    })
    const user = userEvent.setup()
    render(<AdminPage />)

    const material = (await screen.findByRole('heading', { name: 'Optics notes' })).closest('article')
    expect(within(material).getByText('Physics · Optics · optics.pdf')).toBeInTheDocument()
    const quiz = screen.getByRole('heading', { name: 'Algebra basics' }).closest('article')
    expect(within(quiz).getByText('5 questions · 15 min · status: published')).toBeInTheDocument()

    await user.click(within(material).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No materials found.')).toBeInTheDocument()
    await user.click(within(quiz).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No quizzes found.')).toBeInTheDocument()
    expect(calls.filter(call => call.method === 'DELETE').map(call => call.path)).toEqual(['/api/materials/m1', '/api/quizzes/quiz1'])
  })

  test('keeps an item and shows the error when removal fails', async () => {
    logInAs('admin')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi({
      'GET /api/materials': materials,
      'GET /api/quizzes/all': quizzes,
      'DELETE /api/materials/m1': { status: 500, body: { message: 'Unable to delete material' } },
    })
    render(<AdminPage />)
    await userEvent.click(within((await screen.findByRole('heading', { name: 'Optics notes' })).closest('article')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to delete material')
    expect(screen.getByRole('heading', { name: 'Optics notes' })).toBeInTheDocument()
  })

  test('does nothing when the confirmation is cancelled', async () => {
    logInAs('admin')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { calls } = mockApi({ 'GET /api/materials': materials, 'GET /api/quizzes/all': quizzes })
    render(<AdminPage />)
    await userEvent.click(within((await screen.findByRole('heading', { name: 'Optics notes' })).closest('article')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls.every(call => call.method === 'GET')).toBe(true))
  })

  test('shows an error when the lists cannot be loaded', async () => {
    logInAs('admin')
    mockApi({ 'GET /api/materials': materials, 'GET /api/quizzes/all': { status: 403, body: { message: 'Access denied' } } })
    render(<AdminPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Access denied')
  })
})
