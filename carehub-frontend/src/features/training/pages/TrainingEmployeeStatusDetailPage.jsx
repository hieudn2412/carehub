import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const TODAY = new Date().toISOString().slice(0, 10)

function TrainingEmployeeStatusDetailPage() {
  const { employeeId } = useParams()
  const [asOf, setAsOf] = useState(TODAY)
  const [professionalFieldId, setProfessionalFieldId] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState('')
  const [page, setPage] = useState(0)
  const [professionalFields, setProfessionalFields] = useState([])
  const [status, setStatus] = useState(null)
  const [records, setRecords] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const rows = records?.content ?? []

  async function fetchData() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [statusResponse, recordsResponse, optionsResponse] = await Promise.all([
        trainingApi.getEmployeeTrainingStatus(employeeId, {
          professionalFieldId: professionalFieldId || undefined,
          asOf,
        }),
        trainingApi.getEmployeeTrainingRecords(employeeId, {
          professionalFieldId: professionalFieldId || undefined,
          workflowStatus: workflowStatus || undefined,
          asOf,
          page,
          size: 10,
          sort: 'startDate,desc',
        }),
        trainingApi.getRecordOptions(),
      ])

      setStatus(statusResponse.data.data)
      setRecords(recordsResponse.data.data)
      setProfessionalFields(optionsResponse.data.data?.professionalFields ?? [])
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được chi tiết giờ đào tạo nhân viên'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(fetchData, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, asOf, professionalFieldId, workflowStatus, page])

  const updateProfessionalField = (value) => {
    setPage(0)
    setProfessionalFieldId(value)
  }

  const updateWorkflowStatus = (value) => {
    setPage(0)
    setWorkflowStatus(value)
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Employee</p>
          <h1>{status?.employeeName || `Employee #${employeeId}`}</h1>
        </div>
        <div className="training-header-actions">
          <Link className="training-button" to="/training/employees">
            Back
          </Link>
        </div>
      </section>

      <section className="training-panel training-panel--wide training-status-toolbar">
        <div className="training-filters training-filters--status">
          <label>
            Professional field
            <select onChange={(event) => updateProfessionalField(event.target.value)} value={professionalFieldId}>
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
          <label>
            Ledger status
            <select onChange={(event) => updateWorkflowStatus(event.target.value)} value={workflowStatus}>
              <option value="">Approved + pending + rejected</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </label>
        </div>
      </section>

      {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}

      {isLoading ? (
        <section className="training-panel training-panel--wide">
          <div className="training-skeleton">Loading employee training detail...</div>
        </section>
      ) : status ? (
        <>
          <section className="training-grid training-grid--status">
            <StatusCard label="Employee" value={status.employeeCode || '-'} note={status.employeeName} />
            <StatusCard label="Compliance" value={status.status} note={status.warningMessage} />
            <StatusCard
              label="Requirement"
              value={status.requirementName || 'NOT CONFIGURED'}
              note={status.cycleYears ? `${status.cycleYears} năm` : '-'}
            />
            <StatusCard label="Window" value={status.windowStart || '-'} note={status.windowEnd || '-'} />
            <StatusCard label="Required" value={hours(status.requiredHours)} note="Cấu hình hiện hành" />
            <StatusCard label="Approved" value={hours(status.approvedHours)} note="Được tính compliance" />
            <StatusCard label="Pending" value={hours(status.pendingHours)} note="Chưa được tính" />
            <StatusCard label="Remaining" value={hours(status.remainingHours)} note={`${status.progressPercentage ?? 0}%`} />
          </section>

          {status.status === 'NOT_CONFIGURED' ? (
            <section className="training-panel training-panel--wide">
              <div className="training-note">Chưa có requirement phù hợp, nên ledger theo compliance window đang để trống.</div>
            </section>
          ) : null}

          <section className="training-panel training-panel--wide">
            <h2>Progress</h2>
            <div className="training-progress">
              <span style={{ width: `${Math.min(Number(status.progressPercentage ?? 0), 100)}%` }} />
            </div>
          </section>

          <section className="training-detail-grid">
            <div className="training-panel">
              <h2>Breakdown theo năm</h2>
              <StatusTable rows={status.yearlyHours ?? []} columns={['year', 'approvedHours', 'pendingHours', 'rejectedHours']} />
            </div>
            <div className="training-panel">
              <h2>Breakdown theo activity</h2>
              <StatusTable
                rows={status.activityTypeHours ?? []}
                columns={['activityTypeName', 'approvedHours', 'pendingHours', 'rejectedHours']}
              />
            </div>
          </section>

          <section className="training-panel training-panel--wide">
            <h2>Ledger</h2>
            {rows.length === 0 ? (
              <div className="training-empty">Không có record trong window hiện tại.</div>
            ) : (
              <>
                <div className="training-table-wrap">
                  <table className="training-table training-table--employee-ledger">
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>Activity</th>
                        <th>Date</th>
                        <th>Declared</th>
                        <th>Approved</th>
                        <th>Running approved</th>
                        <th>Status</th>
                        <th>Evidence</th>
                        <th>Timeline</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <Link to={`/training/records/${record.id}`}>{record.title}</Link>
                            <br />
                            <span className="training-muted">{record.provider || '-'}</span>
                          </td>
                          <td>{record.activityTypeName || '-'}</td>
                          <td>
                            {record.startDate}
                            <br />
                            <span className="training-muted">{record.endDate || '-'}</span>
                          </td>
                          <td>{hours(record.declaredHours)}</td>
                          <td>{record.approvedHours == null ? '-' : hours(record.approvedHours)}</td>
                          <td>{hours(record.runningApprovedHours)}</td>
                          <td>{record.workflowStatus}</td>
                          <td>
                            {record.evidenceCount} total
                            <br />
                            <span className="training-muted">
                              {record.passedEvidenceCount} passed / {record.failedEvidenceCount} failed
                            </span>
                          </td>
                          <td>
                            {record.reviewCount} review
                            <br />
                            <span className="training-muted">{record.changeLogCount} change</span>
                          </td>
                          <td>
                            {record.sourceType}
                            <br />
                            <span className="training-muted">{record.sourceSubmittedAt || record.sourceReference || '-'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="training-pagination">
                  <button disabled={page <= 0} onClick={() => setPage((value) => value - 1)} type="button">
                    Previous
                  </button>
                  <span>
                    Page {records.page + 1} / {Math.max(records.totalPages, 1)}
                  </span>
                  <button
                    disabled={page + 1 >= records.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
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

function hours(value) {
  return `${value ?? 0}h`
}

export default TrainingEmployeeStatusDetailPage
