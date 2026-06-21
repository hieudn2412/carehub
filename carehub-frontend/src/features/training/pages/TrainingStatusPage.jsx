import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const TODAY = new Date().toISOString().slice(0, 10)

function TrainingStatusPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const [asOf, setAsOf] = useState(TODAY)
  const [professionalFieldId, setProfessionalFieldId] = useState('')
  const [employeeInput, setEmployeeInput] = useState(employeeId || '')
  const [professionalFields, setProfessionalFields] = useState([])
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchStatus() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [statusResponse, optionsResponse] = await Promise.all([
        employeeId
          ? trainingApi.getEmployeeTrainingStatus(employeeId, {
              professionalFieldId: professionalFieldId || undefined,
              asOf,
            })
          : trainingApi.getMyTrainingStatus({
              professionalFieldId: professionalFieldId || undefined,
              asOf,
            }),
        trainingApi.getRecordOptions(),
      ])
      setStatus(statusResponse.data.data)
      setProfessionalFields(optionsResponse.data.data?.professionalFields ?? [])
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được trạng thái đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(fetchStatus, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, asOf, professionalFieldId])

  const openEmployeeStatus = (event) => {
    event.preventDefault()
    const trimmed = employeeInput.trim()
    navigate(trimmed ? `/training/status/${trimmed}` : '/training/status')
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Training</p>
          <h1>Training Status</h1>
        </div>
      </section>

      <section className="training-panel training-panel--wide training-status-toolbar">
        <form className="training-filters training-filters--status" onSubmit={openEmployeeStatus}>
          <label>
            Employee ID
            <input
              onChange={(event) => setEmployeeInput(event.target.value)}
              placeholder="Trống = tôi"
              value={employeeInput}
            />
          </label>
          <label>
            Professional field
            <select
              onChange={(event) => setProfessionalFieldId(event.target.value)}
              value={professionalFieldId}
            >
              <option value="">Default</option>
              {professionalFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            As of
            <input onChange={(event) => setAsOf(event.target.value)} type="date" value={asOf} />
          </label>
          <div className="training-form-actions">
            <button className="training-button training-button--primary" type="submit">
              Load
            </button>
            <button
              className="training-button"
              onClick={() => {
                setEmployeeInput('')
                navigate('/training/status')
              }}
              type="button"
            >
              Mine
            </button>
          </div>
        </form>
      </section>

      {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}

      {isLoading ? (
        <section className="training-panel training-panel--wide">
          <div className="training-skeleton">Loading training status...</div>
        </section>
      ) : status ? (
        <>
          <section className="training-grid training-grid--status">
            <StatusCard label="Employee" value={status.employeeName || '-'} note={status.employeeCode} />
            <StatusCard label="Compliance" value={status.status} note={status.warningMessage} />
            <StatusCard
              label="Requirement"
              value={status.requirementName || 'NOT CONFIGURED'}
              note={status.cycleYears ? `${status.cycleYears} năm` : '-'}
            />
            <StatusCard label="Window" value={status.windowStart || '-'} note={status.windowEnd || '-'} />
            <StatusCard label="Approved" value={`${status.approvedHours ?? 0}h`} note={`Required ${status.requiredHours ?? 0}h`} />
            <StatusCard label="Pending" value={`${status.pendingHours ?? 0}h`} note="Không tính vào compliance" />
            <StatusCard label="Rejected" value={`${status.rejectedHours ?? 0}h`} note="Không tính vào compliance" />
            <StatusCard label="Remaining" value={`${status.remainingHours ?? 0}h`} note={`${status.progressPercentage ?? 0}%`} />
          </section>

          <section className="training-panel training-panel--wide">
            <h2>Progress</h2>
            <div className="training-progress">
              <span style={{ width: `${Math.min(Number(status.progressPercentage ?? 0), 100)}%` }} />
            </div>
          </section>

          <section className="training-detail-grid">
            <div className="training-panel">
              <h2>Giờ theo năm</h2>
              <StatusTable rows={status.yearlyHours ?? []} columns={['year', 'approvedHours', 'pendingHours', 'rejectedHours']} />
            </div>
            <div className="training-panel">
              <h2>Giờ theo activity type</h2>
              <StatusTable
                rows={status.activityTypeHours ?? []}
                columns={['activityTypeName', 'approvedHours', 'pendingHours', 'rejectedHours']}
              />
            </div>
            <div className="training-panel training-panel--wide">
              <h2>Record gần đây</h2>
              <RecordTable rows={status.recentRecords ?? []} />
            </div>
            <div className="training-panel training-panel--wide">
              <h2>Record cần xử lý</h2>
              <RecordTable rows={status.attentionRecords ?? []} />
            </div>
          </section>
        </>
      ) : null}
    </main>
  )
}

function StatusCard({ label, value, note }) {
  return (
    <div className="training-panel training-status-card">
      <p className="training-eyebrow">{label}</p>
      <div className="training-stat training-stat--small">{value}</div>
      <span className="training-muted">{note || '-'}</span>
    </div>
  )
}

function StatusTable({ rows, columns }) {
  if (rows.length === 0) {
    return <div className="training-empty">Không có dữ liệu.</div>
  }

  return (
    <div className="training-table-wrap">
      <table className="training-table training-table--compact">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.year ?? row.activityTypeId ?? index}`}>
              {columns.map((column) => (
                <td key={column}>{row[column] ?? '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordTable({ rows }) {
  if (rows.length === 0) {
    return <div className="training-empty">Không có record.</div>
  }

  return (
    <div className="training-table-wrap">
      <table className="training-table training-table--compact">
        <thead>
          <tr>
            <th>Title</th>
            <th>Activity</th>
            <th>Date</th>
            <th>Declared</th>
            <th>Approved</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr key={record.id}>
              <td>{record.title}</td>
              <td>{record.activityTypeName}</td>
              <td>{record.startDate}</td>
              <td>{record.declaredHours ?? '-'}</td>
              <td>{record.approvedHours ?? '-'}</td>
              <td>{record.workflowStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TrainingStatusPage
