// MaterialsPage.jsx — search study material by keyword, subject or topic, 10 per page (CSQ-F-011)
import { useEffect, useState } from 'react'
import { apiRequest, getAuthUser, readJson } from '../api'
import './Materials.css'

const EMPTY_CRITERIA = { q: '', subject: '', topic: '' }

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function fileLabel(name) {
  const extension = name.split('.').pop()
  return extension ? extension.toUpperCase() : 'FILE'
}

export default function MaterialsPage() {
  const isContributor = getAuthUser()?.role === 'contributor'
  const [form, setForm] = useState(EMPTY_CRITERIA)
  const [criteria, setCriteria] = useState(EMPTY_CRITERIA)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page) })
    for (const [key, value] of Object.entries(criteria)) {
      if (value.trim()) params.set(key, value.trim())
    }

    ;(async () => {
      try {
        const response = await apiRequest(`/api/materials?${params}`)
        const data = await readJson(response)
        if (cancelled) return
        if (response.ok) {
          setResults(data)
        } else {
          setError(data.message || 'Search failed. Please try again.')
          setResults(null)
        }
      } catch {
        if (cancelled) return
        setError('Could not reach the server. Make sure the backend is running and try again.')
        setResults(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    // Ignore the response of a search that was replaced by a newer one.
    return () => { cancelled = true }
  }, [criteria, page])

  // A new criteria object always triggers a fresh request, even when the values are unchanged.
  function showPage(searchCriteria, pageNumber) {
    setIsLoading(true)
    setError('')
    setCriteria({ ...searchCriteria })
    setPage(pageNumber)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSearch(event) {
    event.preventDefault()
    showPage(form, 1)
  }

  function handleClear() {
    setForm(EMPTY_CRITERIA)
    showPage(EMPTY_CRITERIA, 1)
  }

  // The download needs the bearer token, so fetch the file and hand it to the browser as a blob (CSQ-F-012).
  async function handleDownload(material) {
    setDownloadingId(material.id)
    setError('')
    try {
      const response = await apiRequest(`/api/materials/${material.id}/download`)
      if (!response.ok) {
        const data = await readJson(response)
        setError(data.message || 'Download failed. Please try again.')
        return
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = material.originalName
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setResults((current) => ({
        ...current,
        materials: current.materials.map((item) => (
          item.id === material.id ? { ...item, downloadCount: item.downloadCount + 1 } : item
        )),
      }))
    } catch {
      setError('Could not reach the server. Make sure the backend is running and try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="materials-page" aria-labelledby="materials-title">
      <header className="materials-header materials-header-row">
        <div>
          <h1 id="materials-title">Study material</h1>
          <p>Search shared notes, papers and slides by keyword, subject or topic.</p>
        </div>
        {isContributor && <a className="materials-button" href="#/materials/upload">Upload material</a>}
      </header>

      <form className="materials-card materials-search" onSubmit={handleSearch} role="search">
        <div className="form-field materials-search-keyword">
          <label htmlFor="search-keyword">Keyword</label>
          <input id="search-keyword" name="q" type="search" placeholder="e.g. matrices" value={form.q} onChange={handleChange} />
        </div>
        <div className="form-field">
          <label htmlFor="search-subject">Subject</label>
          <input id="search-subject" name="subject" type="text" placeholder="e.g. Mathematics" value={form.subject} onChange={handleChange} />
        </div>
        <div className="form-field">
          <label htmlFor="search-topic">Topic</label>
          <input id="search-topic" name="topic" type="text" placeholder="e.g. Algebra" value={form.topic} onChange={handleChange} />
        </div>
        <div className="materials-search-actions">
          <button className="materials-button" type="submit" disabled={isLoading}>Search</button>
          <button className="materials-button secondary" type="button" onClick={handleClear} disabled={isLoading}>Clear</button>
        </div>
      </form>

      {error && <div className="status-message error" role="alert">{error}</div>}

      <div aria-live="polite" aria-busy={isLoading}>
        {isLoading && !results && <p className="materials-empty">Searching…</p>}
        {results && results.total === 0 && <p className="materials-empty">No materials found</p>}
        {results && results.total > 0 && (
          <>
            <p className="materials-count">
              {results.total} material{results.total === 1 ? '' : 's'} found
            </p>
            <ul className="materials-list">
              {results.materials.map((material) => (
                <li className="materials-card material-item" key={material.id}>
                  <span className="material-type" aria-hidden="true">{fileLabel(material.originalName)}</span>
                  <div className="material-details">
                    <h2>{material.title}</h2>
                    <p className="material-tags">
                      <span>{material.subject}</span>
                      <span>{material.topic}</span>
                    </p>
                    <p className="material-meta">
                      {formatSize(material.sizeBytes)} · Uploaded {new Date(material.createdAt).toLocaleDateString()} · {material.downloadCount} download{material.downloadCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    className="materials-button"
                    type="button"
                    onClick={() => handleDownload(material)}
                    disabled={downloadingId === material.id}
                    aria-label={`Download ${material.title}`}
                  >
                    {downloadingId === material.id ? 'Downloading…' : 'Download'}
                  </button>
                </li>
              ))}
            </ul>
            {results.totalPages > 1 && (
              <nav className="materials-pagination" aria-label="Search results pages">
                <button className="materials-button secondary" type="button" onClick={() => showPage(criteria, page - 1)} disabled={isLoading || page <= 1}>Previous</button>
                <span>Page {results.page} of {results.totalPages}</span>
                <button className="materials-button secondary" type="button" onClick={() => showPage(criteria, page + 1)} disabled={isLoading || page >= results.totalPages}>Next</button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  )
}
