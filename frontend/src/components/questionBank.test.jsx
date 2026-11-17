import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import QuestionBankPage from './QuestionBankPage'
import { jsonBody, logInAs, mockApi } from '../test/helpers'

function question(id, ownerId, extra = {}) {
  return {
    id, text: `Question ${id}?`, options: ['1', '2', '3', '4'], correctIndex: 1,
    topic: 'Algebra', difficulty: 'Easy', ownerId, createdAt: '2026-10-25T10:00:00Z', ...extra,
  }
}

function bank(questions, { page = 1, totalPages = 1 } = {}) {
  return { questions, page, pageSize: 20, total: questions.length, totalPages }
}

const addForm = () => screen.getByRole('form', { name: /^(Add a question|Edit question)$/ })
const filterForm = () => screen.getByRole('form', { name: 'Filter questions' })

describe('QuestionBankPage', () => {
  test('is denied to anyone who is not a contributor', () => {
    logInAs('student')
    render(<QuestionBankPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only Contributors can use the question bank')
  })

  test('TC-QB-01: saves a question with four options, one correct answer, a topic and a difficulty', async () => {
    logInAs('contributor', { id: 'me' })
    const { calls } = mockApi({
      'GET /api/questions': bank([]),
      'POST /api/questions': { status: 201, body: { question: question('q1', 'me') } },
    })
    const user = userEvent.setup()
    render(<QuestionBankPage />)
    expect(await screen.findByText('No questions found')).toBeInTheDocument()

    const form = addForm()
    await user.type(within(form).getByLabelText('Question text'), 'What is 2 + 2?')
    for (const [label, value] of [['A', '3'], ['B', '4'], ['C', '5'], ['D', '22']]) {
      await user.type(within(form).getByLabelText(label), value)
    }
    await user.click(within(form).getByLabelText('Option B is correct'))
    await user.type(within(form).getByLabelText('Topic'), 'Algebra')
    await user.selectOptions(within(form).getByLabelText('Difficulty'), 'Medium')
    await user.click(within(form).getByRole('button', { name: 'Save question' }))

    expect(await within(form).findByRole('status')).toHaveTextContent('Question saved to the question bank.')
    const post = calls.find(call => call.method === 'POST')
    expect(jsonBody(post)).toEqual({ text: 'What is 2 + 2?', options: ['3', '4', '5', '22'], correctIndex: 1, topic: 'Algebra', difficulty: 'Medium' })
    expect(within(form).getByLabelText('Question text')).toHaveValue('')
  })

  test('shows the server message for an invalid question', async () => {
    logInAs('contributor', { id: 'me' })
    mockApi({
      'GET /api/questions': bank([]),
      'POST /api/questions': { status: 400, body: { message: 'Options must be different' } },
    })
    const user = userEvent.setup()
    render(<QuestionBankPage />)
    const form = addForm()
    await user.type(within(form).getByLabelText('Question text'), 'Pick one')
    for (const label of ['A', 'B', 'C', 'D']) await user.type(within(form).getByLabelText(label), 'same')
    await user.type(within(form).getByLabelText('Topic'), 'Algebra')
    await user.click(within(form).getByRole('button', { name: 'Save question' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Options must be different')
  })

  test('lists questions with the correct answer, tags and "Yours" only on own questions', async () => {
    logInAs('contributor', { id: 'me' })
    mockApi({ 'GET /api/questions': bank([question('q1', 'me'), question('q2', 'someone-else', { difficulty: 'Hard' })]) })
    render(<QuestionBankPage />)
    const own = (await screen.findByText('Question q1?')).closest('li')
    const other = screen.getByText('Question q2?').closest('li')

    expect(within(own).getByText('(correct answer)')).toBeInTheDocument()
    expect(within(own).getByText('Yours')).toBeInTheDocument()
    expect(within(own).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(within(other).getByText('Hard')).toBeInTheDocument()
    expect(within(other).queryByText('Yours')).not.toBeInTheDocument()
    expect(within(other).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(other).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  test('TC-QB-02: edits an own question with PUT and shows "Question updated."', async () => {
    logInAs('contributor', { id: 'me' })
    const { calls } = mockApi({
      'GET /api/questions': bank([question('q1', 'me')]),
      'PUT /api/questions/q1': { question: question('q1', 'me', { text: 'Edited?' }) },
    })
    const user = userEvent.setup()
    render(<QuestionBankPage />)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const form = addForm()
    expect(within(form).getByRole('heading', { name: 'Edit question' })).toBeInTheDocument()
    const text = within(form).getByLabelText('Question text')
    expect(text).toHaveValue('Question q1?')
    await user.clear(text)
    await user.type(text, 'Edited?')
    await user.click(within(form).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Question updated.')).toBeInTheDocument()
    expect(jsonBody(calls.find(call => call.method === 'PUT'))).toMatchObject({ text: 'Edited?', correctIndex: 1 })
    expect(within(addForm()).getByRole('heading', { name: 'Add a question' })).toBeInTheDocument()
  })

  test('cancelling an edit returns to the add form', async () => {
    logInAs('contributor', { id: 'me' })
    mockApi({ 'GET /api/questions': bank([question('q1', 'me')]) })
    const user = userEvent.setup()
    render(<QuestionBankPage />)
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    await user.click(within(addForm()).getByRole('button', { name: 'Cancel' }))
    expect(within(addForm()).getByRole('heading', { name: 'Add a question' })).toBeInTheDocument()
  })

  test('TC-QB-02: deletes an own question after confirmation', async () => {
    logInAs('contributor', { id: 'me' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = mockApi({
      'GET /api/questions': bank([question('q1', 'me')]),
      'DELETE /api/questions/q1': { message: 'Question deleted' },
    })
    render(<QuestionBankPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Question deleted.')).toBeInTheDocument()
    expect(calls.some(call => call.method === 'DELETE')).toBe(true)
  })

  test('TC-QB-02: shows "Question is in use" when the question is in a published quiz', async () => {
    logInAs('contributor', { id: 'me' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi({
      'GET /api/questions': bank([question('q1', 'me')]),
      'DELETE /api/questions/q1': { status: 409, body: { message: 'Question is in use' } },
    })
    render(<QuestionBankPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Question is in use')
  })

  test('does not delete when the confirmation is cancelled', async () => {
    logInAs('contributor', { id: 'me' })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { calls } = mockApi({ 'GET /api/questions': bank([question('q1', 'me')]) })
    render(<QuestionBankPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(calls.every(call => call.method === 'GET')).toBe(true)
  })

  test('TC-QB-03: filters by topic and difficulty, then clears the filters', async () => {
    logInAs('contributor', { id: 'me' })
    const { calls } = mockApi({ 'GET /api/questions': bank([question('q1', 'me')]) })
    const user = userEvent.setup()
    render(<QuestionBankPage />)
    await screen.findByText('Question q1?')

    const filters = filterForm()
    await user.type(within(filters).getByLabelText('Topic'), ' Algebra ')
    await user.selectOptions(within(filters).getByLabelText('Difficulty'), 'Easy')
    await user.click(within(filters).getByRole('button', { name: 'Filter' }))
    await waitFor(() => expect(calls.at(-1).query).toEqual({ page: '1', limit: '20', topic: 'Algebra', difficulty: 'Easy' }))
    expect(await screen.findByText(/1 matching/)).toBeInTheDocument()

    await user.click(within(filters).getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(calls.at(-1).query).toEqual({ page: '1', limit: '20' }))
  })

  test('pages through the question bank', async () => {
    logInAs('contributor', { id: 'me' })
    const { calls } = mockApi({
      'GET /api/questions': ({ query }) => bank([question(`p${query.page}`, 'me')], { page: Number(query.page), totalPages: 2 }),
    })
    const user = userEvent.setup()
    render(<QuestionBankPage />)
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(calls.at(-1).query.page).toBe('2')
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  })

  test('shows load errors and connection failures', async () => {
    logInAs('contributor', { id: 'me' })
    mockApi({ 'GET /api/questions': { status: 400, body: { message: 'Difficulty must be Easy, Medium or Hard' } } })
    const { unmount } = render(<QuestionBankPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Difficulty must be Easy, Medium or Hard')
    unmount()

    mockApi({ 'GET /api/questions': () => { throw new TypeError('Failed to fetch') } })
    render(<QuestionBankPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })
})
