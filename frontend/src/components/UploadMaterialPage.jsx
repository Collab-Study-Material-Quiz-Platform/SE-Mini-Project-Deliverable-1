// UploadMaterialPage.jsx — Contributor form to share one PDF, DOCX or PPTX file (CSQ-F-010)
import { useRef, useState } from 'react'
import { apiRequest, getAuthUser, readJson } from '../api'
import './Materials.css'

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx']
const EMPTY_FORM = { title: '', subject: '', topic: '' }

function hasAllowedExtension(name) {
  const lower = name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

export default function UploadMaterialPage() {
  const user = getAuthUser()
  const fileInput = useRef(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user?.role !== 'contributor') {
    return (
      <section className="materials-page">
        <div className="status-message error" role="alert">Access denied. Only Contributors can upload study material.</div>
      </section>
    )
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (status.message) setStatus({ type: '', message: '' })
  }

  function handleFileChange(event) {
    setFile(event.target.files[0] || null)
    if (status.message) setStatus({ type: '', message: '' })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!file || !hasAllowedExtension(file.name) || file.size > MAX_FILE_SIZE_BYTES) {
      setStatus({ type: 'error', message: 'Invalid file. Choose a PDF, DOCX or PPTX file of at most 20 MB.' })
      return
    }

    const body = new FormData()
    body.append('title', form.title.trim())
    body.append('subject', form.subject.trim())
    body.append('topic', form.topic.trim())
    body.append('file', file)

    setIsSubmitting(true)
    setStatus({ type: '', message: '' })
    try {
      const response = await apiRequest('/api/materials', { method: 'POST', body })
      const data = await readJson(response)
      if (!response.ok) {
        setStatus({ type: 'error', message: data.message || 'Upload failed. Please try again.' })
        return
      }
      setStatus({ type: 'success', message: `“${data.material.title}” was uploaded successfully.` })
      setForm(EMPTY_FORM)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch {
      setStatus({ type: 'error', message: 'Could not reach the server. Make sure the backend is running and try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="materials-page" aria-labelledby="upload-title">
      <header className="materials-header">
        <h1 id="upload-title">Upload study material</h1>
        <p>Share one PDF, DOCX or PPTX file (up to 20 MB) with the community.</p>
      </header>

      <form className="materials-card materials-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="material-title">Title</label>
          <input id="material-title" name="title" type="text" maxLength={100} value={form.title} onChange={handleChange} required />
          <span className="field-hint">{form.title.length}/100 characters</span>
        </div>
        <div className="materials-form-row">
          <div className="form-field">
            <label htmlFor="material-subject">Subject</label>
            <input id="material-subject" name="subject" type="text" maxLength={100} placeholder="e.g. Mathematics" value={form.subject} onChange={handleChange} required />
          </div>
          <div className="form-field">
            <label htmlFor="material-topic">Topic</label>
            <input id="material-topic" name="topic" type="text" maxLength={100} placeholder="e.g. Algebra" value={form.topic} onChange={handleChange} required />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="material-file">File</label>
          <input id="material-file" ref={fileInput} name="file" type="file" accept=".pdf,.docx,.pptx" onChange={handleFileChange} required />
          <span className="field-hint">PDF, DOCX or PPTX, maximum 20 MB.</span>
        </div>

        {status.message && (
          <div className={`status-message ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.message}
          </div>
        )}

        <button className="materials-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Uploading…' : 'Upload material'}
        </button>
      </form>
    </section>
  )
}
