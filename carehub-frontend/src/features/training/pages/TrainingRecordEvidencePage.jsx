import { Link, useParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

function TrainingRecordEvidencePage() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [evidences, setEvidences] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const [recordResponse, evidenceResponse] = await Promise.all([
        trainingApi.getRecord(id),
        trainingApi.listEvidence(id),
      ])
      setRecord(recordResponse.data.data)
      setEvidences(evidenceResponse.data.data ?? [])
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot load evidence'))
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [load])

  const upload = async (event) => {
    event.preventDefault()
    if (!selectedFile) return

    setIsWorking(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await trainingApi.uploadEvidence(id, selectedFile)
      setEvidences((current) => [response.data.data, ...current])
      setSelectedFile(null)
      event.target.reset()
      setSuccessMessage('Evidence uploaded.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot upload evidence'))
    } finally {
      setIsWorking(false)
    }
  }

  const remove = async (evidenceId) => {
    if (!window.confirm('Delete this evidence?')) return

    setIsWorking(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await trainingApi.deleteEvidence(id, evidenceId)
      setEvidences((current) => current.filter((item) => item.id !== evidenceId))
      setSuccessMessage('Evidence deleted.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot delete evidence'))
    } finally {
      setIsWorking(false)
    }
  }

  const download = async (evidenceId) => {
    setIsWorking(true)
    setErrorMessage('')
    try {
      const response = await trainingApi.createEvidenceDownloadUrl(id, evidenceId)
      window.open(toAbsoluteDownloadUrl(response.data.data.downloadUrl), '_blank', 'noopener,noreferrer')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot create download URL'))
    } finally {
      setIsWorking(false)
    }
  }

  const submit = async () => {
    if (!record) return

    setIsWorking(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await trainingApi.submitRecord(id, { version: record.version })
      setRecord(response.data.data)
      setSuccessMessage('Submitted for review.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot submit training record'))
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Training</p>
          <h1>Evidence</h1>
        </div>
        <div className="training-header-actions">
          <Link className="training-button" to={`/training/records/${id}/edit`}>
            Edit Record
          </Link>
          <Link className="training-button" to="/training">
            Back
          </Link>
        </div>
      </section>

      <section className="training-detail-grid">
        <article className="training-panel">
          {isLoading ? (
            <div className="training-skeleton">Loading evidence...</div>
          ) : (
            <>
              {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}
              {successMessage ? <div className="training-message training-message--success">{successMessage}</div> : null}
              <h2>{record?.title ?? `Record #${id}`}</h2>
              <dl className="training-definition">
                <dt>Status</dt>
                <dd>{record?.workflowStatus ?? '-'}</dd>
                <dt>Activity</dt>
                <dd>{record?.activityTypeName ?? '-'}</dd>
                <dt>Hours</dt>
                <dd>{record?.declaredHours ?? '-'}</dd>
                <dt>Version</dt>
                <dd>{record?.version ?? '-'}</dd>
              </dl>
            </>
          )}
        </article>

        <article className="training-panel">
          <form className="training-form" onSubmit={upload}>
            <label>
              File
              <input
                accept="image/png,image/jpeg,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                required
                type="file"
              />
              <small>PNG, JPG, PDF. Max 5MB.</small>
            </label>
            <div className="training-form-actions">
              <button className="training-button training-button--primary" disabled={isWorking} type="submit">
                Upload
              </button>
              <button className="training-button" disabled={isWorking || !record} onClick={submit} type="button">
                Submit Record
              </button>
            </div>
          </form>
        </article>

        <article className="training-panel training-panel--wide">
          {evidences.length === 0 ? (
            <div className="training-empty">No evidence uploaded.</div>
          ) : (
            <div className="training-table-wrap">
              <table className="training-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Moderation</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidences.map((item) => (
                    <tr key={item.id}>
                      <td>{item.originalFilename}</td>
                      <td>{item.mimeType}</td>
                      <td>{formatSize(item.fileSizeBytes)}</td>
                      <td>
                        <span className={`training-badge ${item.moderationStatus === 'PASSED' ? 'is-active' : 'is-inactive'}`}>
                          {item.moderationStatus}
                        </span>
                      </td>
                      <td>{formatDateTime(item.uploadedAt)}</td>
                      <td>
                        <div className="training-actions">
                          <button disabled={isWorking} onClick={() => download(item.id)} type="button">
                            Download
                          </button>
                          <button disabled={isWorking} onClick={() => remove(item.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </main>
  )
}

function formatSize(value) {
  if (!value) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toAbsoluteDownloadUrl(downloadUrl) {
  if (!downloadUrl) return ''
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
  const apiBase = new URL(apiBaseUrl, window.location.origin)
  return new URL(downloadUrl, apiBase.origin).toString()
}

export default TrainingRecordEvidencePage
