import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import MaterialsPage from './MaterialsPage'
import UploadMaterialPage from './UploadMaterialPage'
import { logInAs, mockApi } from '../test/helpers'

function material(i, extra = {}) {
  return {
    id: `m${i}`, title: `Lecture ${i}`, subject: 'Physics', topic: 'Optics', originalName: `lecture-${i}.pdf`,
    mimeType: 'application/pdf', sizeBytes: 2048 * (i + 1), downloadCount: 0, createdAt: '2026-10-20T10:00:00Z', ...extra,
  }
}

function page(materials, { page: pageNumber = 1, total = materials.length } = {}) {
  return { materials, page: pageNumber, pageSize: 10, total, totalPages: Math.ceil(total / 10), ...(total === 0 ? { message: 'No materials found' } : {}) }
}

describe('MaterialsPage (TC-Mat-02, TC-Mat-03)', () => {
  test('lists the newest materials with their details', async () => {
    logInAs('student')
    mockApi({ 'GET /api/materials': page([material(1, { sizeBytes: 3 * 1024 * 1024, downloadCount: 1 }), material(2)]) })
    render(<MaterialsPage />)
    expect(await screen.findByText('2 materials found')).toBeInTheDocument()
    const first = screen.getAllByRole('listitem')[0]
    expect(within(first).getByRole('heading', { name: 'Lecture 1' })).toBeInTheDocument()
    expect(within(first).getByText(/3\.0 MB/)).toHaveTextContent('1 download')
    expect(within(first).getByText('PDF')).toBeInTheDocument()
  })

  test('shows "No materials found" when nothing matches', async () => {
    logInAs('student')
    mockApi({ 'GET /api/materials': page([]) })
    render(<MaterialsPage />)
    expect(await screen.findByText('No materials found')).toBeInTheDocument()
  })

  test('searches by keyword, subject and topic from page 1', async () => {
    logInAs('student')
    const { calls } = mockApi({ 'GET /api/materials': page([material(1)]) })
    const user = userEvent.setup()
    render(<MaterialsPage />)
    await screen.findByText('1 material found')

    await user.type(screen.getByLabelText('Keyword'), ' optics ')
    await user.type(screen.getByLabelText('Subject'), 'Physics')
    await user.type(screen.getByLabelText('Topic'), 'Optics')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1].query).toEqual({ page: '1', q: 'optics', subject: 'Physics', topic: 'Optics' })

    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(calls).toHaveLength(3))
    expect(calls[2].query).toEqual({ page: '1' })
    expect(screen.getByLabelText('Keyword')).toHaveValue('')
  })

  test('pages through results 10 at a time', async () => {
    logInAs('student')
    const { calls } = mockApi({
      'GET /api/materials': ({ query }) => (query.page === '2'
        ? page([material(11), material(12)], { page: 2, total: 12 })
        : page(Array.from({ length: 10 }, (_, i) => material(i + 1)), { page: 1, total: 12 })),
    })
    const user = userEvent.setup()
    render(<MaterialsPage />)
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(calls.at(-1).query.page).toBe('2')

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
  })

  test('downloading saves the file and adds 1 to the download count', async () => {
    logInAs('student')
    const createObjectURL = vi.fn(() => 'blob:material')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mockApi({
      'GET /api/materials': page([material(1, { downloadCount: 4 })]),
      'GET /api/materials/m1/download': () => new Response(new Blob(['%PDF-1.4']), { status: 200 }),
    })
    render(<MaterialsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Download Lecture 1' }))

    expect(await screen.findByText(/5 downloads/)).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  test('shows the server message when a download fails', async () => {
    logInAs('student')
    mockApi({
      'GET /api/materials': page([material(1)]),
      'GET /api/materials/m1/download': { status: 404, body: { message: 'Material file not found' } },
    })
    render(<MaterialsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Download Lecture 1' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Material file not found')
  })

  test('shows search errors and connection failures', async () => {
    logInAs('student')
    mockApi({ 'GET /api/materials': { status: 400, body: { message: 'Page must be a positive whole number' } } })
    const { unmount } = render(<MaterialsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Page must be a positive whole number')
    unmount()

    mockApi({ 'GET /api/materials': () => { throw new TypeError('Failed to fetch') } })
    render(<MaterialsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })

  test('only contributors see the upload link', async () => {
    logInAs('contributor')
    mockApi({ 'GET /api/materials': page([]) })
    const { unmount } = render(<MaterialsPage />)
    expect(await screen.findByRole('link', { name: 'Upload material' })).toHaveAttribute('href', '#/materials/upload')
    unmount()

    logInAs('student')
    render(<MaterialsPage />)
    await screen.findByText('No materials found')
    expect(screen.queryByRole('link', { name: 'Upload material' })).not.toBeInTheDocument()
  })
})

describe('UploadMaterialPage (TC-Mat-01, TC-Sec-04)', () => {
  function pdf(name = 'notes.pdf', size = 1024) {
    const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  async function fillForm(user, file) {
    await user.type(screen.getByLabelText('Title'), 'Optics notes')
    await user.type(screen.getByLabelText('Subject'), 'Physics')
    await user.type(screen.getByLabelText('Topic'), 'Optics')
    await user.upload(screen.getByLabelText('File'), file)
  }

  // jsdom treats a required file input as empty even after a file is chosen, so submit the form directly.
  // The browser tests in e2e/ cover the real button click.
  function submit() {
    fireEvent.submit(screen.getByRole('button', { name: 'Upload material' }).closest('form'))
  }

  test('is denied to anyone who is not a contributor', () => {
    logInAs('student')
    render(<UploadMaterialPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('Only Contributors can upload study material')
  })

  test('uploads the file with its title, subject and topic and resets the form', async () => {
    logInAs('contributor')
    const { calls } = mockApi({ 'POST /api/materials': { status: 201, body: { material: { title: 'Optics notes' } } } })
    const user = userEvent.setup()
    render(<UploadMaterialPage />)
    await fillForm(user, pdf())
    expect(screen.getByText('12/100 characters')).toBeInTheDocument()
    submit()

    expect(await screen.findByRole('status')).toHaveTextContent('“Optics notes” was uploaded successfully.')
    const body = calls[0].init.body
    expect(body.get('title')).toBe('Optics notes')
    expect(body.get('subject')).toBe('Physics')
    expect(body.get('topic')).toBe('Optics')
    expect(body.get('file').name).toBe('notes.pdf')
    expect(screen.getByLabelText('Title')).toHaveValue('')
  })

  test.each([
    ['an unsupported format', () => pdf('notes.txt')],
    ['a file over 20 MB', () => pdf('huge.pdf', 20 * 1024 * 1024 + 1)],
  ])('rejects %s before uploading', async (_, makeFile) => {
    logInAs('contributor')
    const { calls } = mockApi()
    const user = userEvent.setup({ applyAccept: false })
    render(<UploadMaterialPage />)
    await fillForm(user, makeFile())
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid file. Choose a PDF, DOCX or PPTX file of at most 20 MB.')
    expect(calls).toHaveLength(0)
  })

  test('shows the server rejection for a disguised file', async () => {
    logInAs('contributor')
    mockApi({ 'POST /api/materials': { status: 400, body: { message: 'Invalid file' } } })
    const user = userEvent.setup()
    render(<UploadMaterialPage />)
    await fillForm(user, pdf('setup.pdf'))
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid file')
  })

  test('explains when the server cannot be reached', async () => {
    logInAs('contributor')
    mockApi({ 'POST /api/materials': () => { throw new TypeError('Failed to fetch') } })
    const user = userEvent.setup()
    render(<UploadMaterialPage />)
    await fillForm(user, pdf())
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })
})
