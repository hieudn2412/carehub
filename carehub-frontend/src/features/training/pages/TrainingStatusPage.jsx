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
            Mã nhân viên
            <input
              onChange={(event) => setEmployeeInput(event.target.value)}
              placeholder="Trống = tôi"
              value={employeeInput}
            />
          </label>
          <label>
            Lĩnh vực chuyên môn
            <select
              onChange={(event) => setProfessionalFieldId(event.target.value)}
              value={professionalFieldId}
            >
              <option value="">Mặc định</option>
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
            <StatusCard label="Nhân viên" value={status.employeeName || '-'} note={status.employeeCode} />
            <StatusCard
              label="Trạng thái"
              value={status.status === 'COMPLIANT' ? 'ĐẠT' : status.status === 'NON_COMPLIANT' ? 'KHÔNG ĐẠT' : status.status}
              note={status.warningMessage}
            />
            <StatusCard
              label="Yêu cầu"
              value={status.requirementName || 'CHƯA CẤU HÌNH'}
              note={status.cycleYears ? `${status.cycleYears} năm` : '-'}
            />
            <StatusCard label="Chu kỳ" value={status.windowStart || '-'} note={`→ ${status.windowEnd || '-'}`} />
          </section>

          <section className="training-hero-progress">
            <div className="training-progress-info">
              <div className="training-progress-stat">
                <span className="training-progress-value">{status.submittedHours ?? 0}h</span>
                <span className="training-progress-label">đã nộp trên {status.requiredHours ?? 0}h yêu cầu</span>
              </div>
              <div className="training-progress-stat">
                <span className="training-progress-value">{status.remainingHours ?? 0}h</span>
                <span className="training-progress-label">còn thiếu ({status.progressPercentage ?? 0}%)</span>
              </div>
            </div>
            <div className="training-progress">
              <span style={{ width: `${Math.min(Number(status.progressPercentage ?? 0), 100)}%` }} />
            </div>
          </section>

          <section className="training-detail-grid">
            <div className="training-panel">
              <h2>Giờ theo năm</h2>
              <StatusTable rows={status.yearlyHours ?? []} columns={['year', 'submittedHours']} labels={{ year: 'Năm', submittedHours: 'Giờ đã nộp' }} />
            </div>
            <div className="training-panel">
              <h2>Giờ theo activity type</h2>
              <StatusTable
                rows={status.activityTypeHours ?? []}
                columns={['activityTypeName', 'submittedHours']}
                labels={{ activityTypeName: 'Loại hoạt động', submittedHours: 'Giờ đã nộp' }}
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

function StatusTable({ rows, columns, labels }) {
  if (rows.length === 0) {
    return <div className="training-empty">Không có dữ liệu.</div>
  }

  return (
    <div className="training-table-wrap">
      <table className="training-table training-table--compact">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{labels?.[column] || column}</th>
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

  function statusText(workflowStatus) {
    const map = {
      SUBMITTED: 'Đã nộp',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Từ chối',
      DRAFT: 'Bản nháp',
    }
    return map[workflowStatus] || workflowStatus || '-'
  }

  return (
    <div className="training-table-wrap">
      <table className="training-table training-table--compact">
        <thead>
          <tr>
            <th>Tiêu đề</th>
            <th>Hoạt động</th>
            <th>Ngày</th>
            <th>Giờ khai báo</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((record) => (
            <tr key={record.id}>
              <td>{record.title}</td>
              <td>{record.activityTypeName}</td>
              <td>{record.startDate}</td>
              <td>{record.declaredHours ?? '-'}</td>
              <td>{statusText(record.workflowStatus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TrainingStatusPage
