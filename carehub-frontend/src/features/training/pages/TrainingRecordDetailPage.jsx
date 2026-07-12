import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

function TrainingRecordDetailPage() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const response = await trainingApi.getRecord(id)
        if (!mounted) return
        setRecord(response.data.data)
      } catch (error) {
        if (!mounted) return
        setErrorMessage(getApiErrorMessage(error, 'Cannot load training record'))
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    const timer = window.setTimeout(load, 0)
    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [id])

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Training</p>
          <h1>{record?.title ?? 'Training Record'}</h1>
        </div>
        <div className="training-header-actions">
          {record && record.workflowStatus === 'DRAFT' ? (
            <>
              <Link className="training-button" to={`/training/records/${record.id}/edit`}>
                Edit
              </Link>
              <Link className="training-button" to={`/training/records/${record.id}/evidence`}>
                Evidence
              </Link>
            </>
          ) : null}
          <Link className="training-button" to="/training/records">
            Back
          </Link>
        </div>
      </section>

      {isLoading ? <div className="training-panel training-skeleton">Loading record...</div> : null}
      {errorMessage ? <section className="training-panel training-message training-message--error">{errorMessage}</section> : null}

      {record ? (
        <section className="training-detail-grid">
          <article className="training-panel">
            <h2>Employee</h2>
            <dl className="training-definition">
              <dt>Code</dt>
              <dd>{record.employeeCode}</dd>
              <dt>Name</dt>
              <dd>{record.employeeName}</dd>
              <dt>Department</dt>
              <dd>{record.employeeDepartmentNameSnapshot ?? '-'}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Program</h2>
            <dl className="training-definition">
              <dt>Status</dt>
              <dd>
                <span className={`training-badge ${record.workflowStatus === 'SUBMITTED' ? 'is-active' : 'is-inactive'}`}>
                  {record.workflowStatus}
                </span>
              </dd>
              <dt>Activity</dt>
              <dd>{record.activityTypeName}</dd>
              <dt>Field</dt>
              <dd>{record.professionalFieldName ?? '-'}</dd>
              <dt>Provider</dt>
              <dd>{record.provider ?? '-'}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Dates & Hours</h2>
            <dl className="training-definition">
              <dt>Start</dt>
              <dd>{formatDate(record.startDate)} {record.startTime ?? ''}</dd>
              <dt>End</dt>
              <dd>{formatDate(record.endDate)} {record.endTime ?? ''}</dd>
              <dt>Declared Hours</dt>
              <dd>{record.declaredHours ?? '-'}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Source</h2>
            <dl className="training-definition">
              <dt>Type</dt>
              <dd>{record.sourceType}</dd>
              <dt>Reference</dt>
              <dd>{record.sourceReference ?? '-'}</dd>
              <dt>Submitted</dt>
              <dd>{formatDateTime(record.submittedAt)}</dd>
              <dt>Version</dt>
              <dd>{record.version}</dd>
            </dl>
          </article>

          <article className="training-panel training-panel--wide">
            <h2>Description</h2>
            <p>{record.description || '-'}</p>
          </article>

          <article className="training-panel training-panel--wide">
            <h2>Evidence</h2>
            {record.evidences.length === 0 ? (
              <div className="training-empty">No evidence.</div>
            ) : (
              <table className="training-table training-table--compact">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Moderation</th>
                  </tr>
                </thead>
                <tbody>
                  {record.evidences.map((item) => (
                    <tr key={item.id}>
                      <td>{item.originalFilename}</td>
                      <td>{item.mimeType}</td>
                      <td>{formatSize(item.fileSizeBytes)}</td>
                      <td>{item.moderationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="training-panel">
            <h2>Change History</h2>
            {record.changeHistory.length === 0 ? (
              <div className="training-empty">No changes.</div>
            ) : (
              <ul className="training-timeline">
                {record.changeHistory.map((item) => (
                  <li key={item.id}>
                    <strong>{item.changeType}</strong>
                    <span>v{item.versionNo}</span>
                    <span>{item.changedByUserName ?? '-'}</span>
                    <span>{formatDateTime(item.changedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      ) : null}
    </main>
  )
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatSize(value) {
  if (!value) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

export default TrainingRecordDetailPage
