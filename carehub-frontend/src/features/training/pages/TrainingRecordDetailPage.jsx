import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import { formatEvidenceStorageSummary } from '../utils/evidenceFile.js'
import '../styles/training.css'

function TrainingRecordDetailPage() {
  const { id } = useParams()
  const [record, setRecord] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [returningToDraft, setReturningToDraft] = useState(false)

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

  const handleDownloadEvidence = async (evidenceId) => {
    try {
      const res = await trainingApi.createEvidenceDownloadUrl(id, evidenceId)
      const url = res.data?.data?.downloadUrl
      if (url) {
        window.open(url, '_blank')
      }
    } catch {
      alert('Không thể tải minh chứng')
    }
  }

  const handleReturnToDraft = async () => {
    if (!window.confirm('Bạn có chắc muốn trả hồ sơ này về nháp?')) return
    setReturningToDraft(true)
    try {
      await trainingApi.returnToDraft(id)
      const response = await trainingApi.getRecord(id)
      setRecord(response.data.data)
    } catch (err) {
      alert(getApiErrorMessage(err, 'Không thể trả hồ sơ về nháp'))
    } finally {
      setReturningToDraft(false)
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Đào tạo</p>
          <h1>{record?.title ?? 'Hồ sơ đào tạo'}</h1>
        </div>
        <div className="training-header-actions">
          {record && record.workflowStatus === 'DRAFT' ? (
            <>
              <Link className="training-button" to={`/training/records/${record.id}/edit`}>
                Chỉnh sửa
              </Link>
              <Link className="training-button" to={`/training/records/${record.id}/evidence`}>
                Minh chứng
              </Link>
            </>
          ) : null}
          {record && record.workflowStatus === 'SUBMITTED' ? (
            <button
              className="training-button"
              onClick={handleReturnToDraft}
              disabled={returningToDraft}
            >
              {returningToDraft ? 'Đang xử lý...' : 'Trả về nháp'}
            </button>
          ) : null}
          <Link className="training-button" to="/training/records">
            Quay lại
          </Link>
        </div>
      </section>

      {isLoading ? <div className="training-panel training-skeleton">Đang tải hồ sơ...</div> : null}
      {errorMessage ? <section className="training-panel training-message training-message--error">{errorMessage}</section> : null}

      {record ? (
        <section className="training-detail-grid">
          <article className="training-panel">
            <h2>Nhân viên</h2>
            <dl className="training-definition">
              <dt>Mã</dt>
              <dd>{record.employeeCode}</dd>
              <dt>Tên</dt>
              <dd>{record.employeeName}</dd>
              <dt>Phòng ban</dt>
              <dd>{record.employeeDepartmentNameSnapshot ?? '-'}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Chương trình</h2>
            <dl className="training-definition">
              <dt>Trạng thái</dt>
              <dd>
                <span className={`training-badge ${record.workflowStatus === 'SUBMITTED' ? 'is-active' : 'is-inactive'}`}>
                  {record.workflowStatus === 'SUBMITTED' ? 'Đã nộp' : record.workflowStatus === 'DRAFT' ? 'Nháp' : record.workflowStatus}
                </span>
              </dd>
              <dt>Hình thức</dt>
              <dd>{record.activityTypeName}</dd>
              <dt>Lĩnh vực</dt>
              <dd>{record.professionalFieldName ?? '-'}</dd>
              <dt>Đơn vị tổ chức</dt>
              <dd>{record.provider ?? '-'}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Ngày & Giờ</h2>
            <dl className="training-definition">
              <dt>Bắt đầu</dt>
              <dd>{formatDate(record.startDate)} {record.startTime ?? ''}</dd>
              <dt>Kết thúc</dt>
              <dd>{formatDate(record.endDate)} {record.endTime ?? ''}</dd>
              <dt>Giờ khai báo</dt>
              <dd>{record.declaredHours ?? '-'}</dd>
            </dl>
          </article>

          <article className="training-panel">
            <h2>Nguồn</h2>
            <dl className="training-definition">
              <dt>Loại</dt>
              <dd>{record.sourceType}</dd>
              <dt>Tham chiếu</dt>
              <dd>{record.sourceReference ?? '-'}</dd>
              <dt>Ngày nộp</dt>
              <dd>{formatDateTime(record.submittedAt)}</dd>
              <dt>Phiên bản</dt>
              <dd>{record.version}</dd>
            </dl>
          </article>

          <article className="training-panel training-panel--wide">
            <h2>Mô tả</h2>
            <p>{record.description || '-'}</p>
          </article>

          <article className="training-panel training-panel--wide">
            <h2>Minh chứng</h2>
            {!record.evidences || record.evidences.length === 0 ? (
              <div className="training-empty">Không có minh chứng.</div>
            ) : (
              <table className="training-table training-table--compact">
                <thead>
                  <tr>
                    <th>Tệp</th>
                    <th>Loại</th>
                    <th>Kích thước</th>
                    <th>Kiểm duyệt</th>
                    <th>Tải xuống</th>
                  </tr>
                </thead>
                <tbody>
                  {record.evidences.map((item) => (
                    <tr key={item.id}>
                      <td>{item.originalFilename}</td>
                      <td>{item.mimeType}</td>
                      <td>{formatEvidenceStorageSummary(item, formatSize)}</td>
                      <td>{item.moderationStatus}</td>
                      <td>
                        <button
                          className="training-button"
                          onClick={() => handleDownloadEvidence(item.id)}
                          style={{ padding: '2px 10px', fontSize: '0.85rem' }}
                        >
                          Tải xuống
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="training-panel">
            <h2>Lịch sử thay đổi</h2>
            {!record.changeHistory || record.changeHistory.length === 0 ? (
              <div className="training-empty">Không có thay đổi.</div>
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
