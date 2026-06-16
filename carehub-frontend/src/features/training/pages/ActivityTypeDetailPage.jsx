import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

function ActivityTypeDetailPage() {
  const { id } = useParams()
  const [activityType, setActivityType] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchDetail = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const response = await trainingApi.getActivityType(id)
      setActivityType(response.data.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được chi tiết loại đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchDetail()
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const toggleStatus = async () => {
    if (!activityType) return
    const nextStatus = !activityType.active
    const label = nextStatus ? 'kích hoạt' : 'ngừng kích hoạt'
    if (!window.confirm(`Bạn muốn ${label} loại "${activityType.name}"?`)) {
      return
    }

    try {
      await trainingApi.updateActivityTypeStatus(activityType.id, {
        active: nextStatus,
        version: activityType.version,
      })
      fetchDetail()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không cập nhật được trạng thái'))
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Admin</p>
          <h1>Activity Type Detail</h1>
        </div>
        <div className="training-header-actions">
          <Link className="training-button" to="/admin/training/activity-types">
            Back
          </Link>
          {activityType ? (
            <>
              <Link className="training-button" to={`/admin/training/activity-types/${activityType.id}/edit`}>
                Edit
              </Link>
              <button className="training-button" onClick={toggleStatus} type="button">
                {activityType.active ? 'Deactivate' : 'Activate'}
              </button>
            </>
          ) : null}
        </div>
      </section>

      {isLoading ? <div className="training-panel training-skeleton">Loading detail...</div> : null}

      {errorMessage ? (
        <section className="training-panel training-message training-message--error">
          <p>{errorMessage}</p>
          <button className="training-button" onClick={fetchDetail} type="button">
            Retry
          </button>
        </section>
      ) : null}

      {activityType ? (
        <section className="training-detail-grid">
          <article className="training-panel">
            <h2>Thông tin chung</h2>
            <dl className="training-definition">
              <dt>Code</dt>
              <dd>{activityType.code}</dd>
              <dt>Name</dt>
              <dd>{activityType.name}</dd>
              <dt>Description</dt>
              <dd>{activityType.description || '-'}</dd>
              <dt>Status</dt>
              <dd>
                <span className={`training-badge ${activityType.active ? 'is-active' : 'is-inactive'}`}>
                  {activityType.active ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Quy tắc thời lượng và evidence</h2>
            <dl className="training-definition">
              <dt>Default duration unit</dt>
              <dd>{activityType.defaultDurationUnit}</dd>
              <dt>Requires evidence</dt>
              <dd>{activityType.requiresEvidence ? 'Required' : 'Optional'}</dd>
              <dt>Max credited hours/record</dt>
              <dd>{activityType.maxCreditedHoursPerRecord ?? '-'}</dd>
              <dt>Sort order</dt>
              <dd>{activityType.sortOrder}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Usage statistics</h2>
            <p className="training-stat">{activityType.usageCount}</p>
            <p>record đang sử dụng type này</p>
          </article>

          <article className="training-panel">
            <h2>Metadata</h2>
            <dl className="training-definition">
              <dt>Created</dt>
              <dd>{formatDateTime(activityType.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(activityType.updatedAt)}</dd>
              <dt>Version</dt>
              <dd>{activityType.version}</dd>
            </dl>
          </article>

          <article className="training-panel training-panel--wide">
            <h2>Record gần đây</h2>
            {activityType.recentRecords.length === 0 ? (
              <p>Chưa có record sử dụng type này.</p>
            ) : (
              <table className="training-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Employee</th>
                    <th>Start date</th>
                    <th>Declared</th>
                    <th>Approved</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activityType.recentRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.title}</td>
                      <td>{record.employeeCode} - {record.employeeName}</td>
                      <td>{record.startDate}</td>
                      <td>{record.declaredHours ?? '-'}</td>
                      <td>{record.approvedHours ?? '-'}</td>
                      <td>{record.workflowStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="training-panel training-panel--wide">
            <h2>Audit timeline</h2>
            {activityType.auditTimeline.length === 0 ? (
              <p>Chưa có audit event.</p>
            ) : (
              <ul className="training-timeline">
                {activityType.auditTimeline.map((event) => (
                  <li key={event.id}>
                    <strong>{event.changeType}</strong>
                    <span>{formatDateTime(event.changedAt)}</span>
                    <span>{event.changedByName || `User ${event.changedByUserId}`}</span>
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

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

export default ActivityTypeDetailPage
