// SecureShare - My files page (SCRUM-12: upload)
import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const MAX_SIZE = 32 * 1024 * 1024
const MAX_FILES = 10

const STATUS_LABELS = {
  pending: 'Scan in progress',
  clean: 'Clean',
  infected: 'Quarantined'
}

function formatSize (bytes) {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function App () {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [message, setMessage] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function loadFiles () {
    try {
      const res = await fetch(`${API_URL}/api/files`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch {
      setMessage({ type: 'error', text: 'Cannot reach the API (is docker compose up running?)' })
    }
  }

  useEffect(() => {
    loadFiles()
  }, [])

  function handleSelect (event) {
    setSelected(Array.from(event.target.files))
    setMessage(null)
  }

  async function handleUpload (event) {
    event.preventDefault()

    if (selected.length === 0) {
      setMessage({ type: 'error', text: 'Choose at least one file.' })
      return
    }
    if (selected.length > MAX_FILES) {
      setMessage({ type: 'error', text: `Maximum ${MAX_FILES} files at once.` })
      return
    }
    const tooBig = selected.find(f => f.size > MAX_SIZE)
    if (tooBig) {
      setMessage({ type: 'error', text: `"${tooBig.name}" is larger than 32 MB.` })
      return
    }

    const form = new FormData()
    selected.forEach(f => form.append('files', f))

    setUploading(true)
    try {
      const res = await fetch(`${API_URL}/api/files`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Upload failed')
      setMessage({ type: 'success', text: `${data.files.length} file(s) uploaded.` })
      setSelected([])
      event.target.reset()
      await loadFiles()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="page">
      <h1>SecureShare</h1>
      <h2>My files</h2>

      <form className="upload" onSubmit={handleUpload}>
        <input type="file" multiple onChange={handleSelect} />
        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <p className="hint">Up to {MAX_FILES} files, 32 MB max each.</p>
      </form>

      {message && <p className={`message ${message.type}`}>{message.text}</p>}

      {files.length === 0
        ? <p className="empty">No files yet.</p>
        : (
          <table className="files">
            <thead>
              <tr><th>Name</th><th>Size</th><th>Status</th><th>Uploaded</th></tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td>{f.original_name}</td>
                  <td>{formatSize(f.size_bytes)}</td>
                  <td><span className={`status ${f.scan_status}`}>{STATUS_LABELS[f.scan_status] || f.scan_status}</span></td>
                  <td>{new Date(f.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
    </main>
  )
}
