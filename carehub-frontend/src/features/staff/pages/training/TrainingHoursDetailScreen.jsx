import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EditOutlined,
  PaperClipOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  RollbackOutlined,
  FolderOutlined,
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/TrainingHours.css'

const PREVIEWABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

function canPreviewEvidence(evidence) {
  return PREVIEWABLE_IMAGE_TYPES.has(evidence?.mimeType?.toLowerCase())
}

function TrainingHoursDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [returningToDraft, setReturningToDraft] = useState(false)
  const [evidencePreviews, setEvidencePreviews] = useState({})

  const fetchRecord = useCallback(() => {
    setLoading(true)
    trainingApi.getRecord(id)
      .then(res => setRecord(res.data?.data))
      .catch(() => showToast("Không thể tải hồ sơ.", "error"))
      .finally(() => setLoading(false))
  }, [id, showToast])

  useEffect(() => {
    const timer = window.setTimeout(fetchRecord, 0)
    return () => window.clearTimeout(timer)
  }, [fetchRecord])

  const requestEvidencePreview = useCallback(async (evidenceId) => {
    const response = await trainingApi.createEvidencePreviewUrl(id, evidenceId)
    const url = response.data?.data?.downloadUrl
    if (!url) {
      throw new Error('Preview URL is missing')
    }
    return url
  }, [id])

  useEffect(() => {
    const previewableEvidences = record?.evidences?.filter(canPreviewEvidence) || []
    if (previewableEvidences.length === 0) return undefined

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setEvidencePreviews(Object.fromEntries(
        previewableEvidences.map(evidence => [evidence.id, { status: 'loading' }])
      ))

      const previewEntries = await Promise.all(previewableEvidences.map(async (evidence) => {
        try {
          const url = await requestEvidencePreview(evidence.id)
          return [evidence.id, { status: 'ready', url }]
        } catch {
          return [evidence.id, { status: 'error' }]
        }
      }))

      if (!cancelled) {
        setEvidencePreviews(Object.fromEntries(previewEntries))
      }
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [record?.evidences, requestEvidencePreview])

  const handleSubmit = () => {
    if (!record) return
    if (record.startDate) {
      const recordDate = new Date(record.startDate)
      const fiveYearsAgo = new Date()
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
      fiveYearsAgo.setHours(0, 0, 0, 0)
      recordDate.setHours(0, 0, 0, 0)
      if (recordDate < fiveYearsAgo) {
        showToast("Hồ sơ đào tạo quá 5 năm không được phép nộp.", "error")
        return
      }
    }
    setSubmitting(true)
    trainingApi.submitRecord(id, { version: record.version })
      .then(() => { showToast("Nộp hồ sơ thành công!", "success"); fetchRecord() })
      .catch(() => showToast("Nộp hồ sơ thất bại.", "error"))
      .finally(() => setSubmitting(false))
  }

  const handleDownloadEvidence = async (evidenceId) => {
    try {
      const res = await trainingApi.createEvidenceDownloadUrl(id, evidenceId)
      const url = res.data?.data?.downloadUrl
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      showToast("Không thể tải minh chứng.", "error")
    }
  }

  const handleRetryPreview = async (evidenceId) => {
    setEvidencePreviews(previous => ({
      ...previous,
      [evidenceId]: { status: 'loading' },
    }))
    try {
      const url = await requestEvidencePreview(evidenceId)
      setEvidencePreviews(previous => ({
        ...previous,
        [evidenceId]: { status: 'ready', url },
      }))
    } catch {
      setEvidencePreviews(previous => ({
        ...previous,
        [evidenceId]: { status: 'error' },
      }))
    }
  }

  const handlePreviewImageError = (evidenceId) => {
    setEvidencePreviews(previous => ({
      ...previous,
      [evidenceId]: { status: 'error' },
    }))
  }

  const handleReturnToDraft = async () => {
    if (!window.confirm('Bạn có chắc muốn trả hồ sơ này về nháp?')) return
    setReturningToDraft(true)
    try {
      await trainingApi.returnToDraft(id)
      showToast("Đã trả hồ sơ về nháp!", "success")
      fetchRecord()
    } catch {
      showToast("Không thể trả hồ sơ về nháp.", "error")
    } finally {
      setReturningToDraft(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const statusCfg = {
    SUBMITTED: { label: 'Đã nộp', cls: 'th-badge--success' },
    DRAFT: { label: 'Nháp', cls: 'th-badge--warning' },
    CANCELLED: { label: 'Đã hủy', cls: 'th-badge--danger' },
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Giờ đào tạo', link: '/staff/training' },
          { label: 'Chi tiết' }
        ]} />
        <div className="dashboard-layout__body">
          <div className="training-page">

            {loading ? (
              <div className="th-table-state">Đang tải thông tin...</div>
            ) : !record ? (
              <div className="th-table-state">Không tìm thấy hồ sơ.</div>
            ) : (
              <>
                <div className="th-detail-header">
                  <div className="th-detail-header__left">
                    <h1 className="th-detail-title">{record.title}</h1>
                    <div className="th-detail-meta">
                      <span><ClockCircleOutlined /> {formatDate(record.startDate)}</span>
                      {record.professionalFieldName && <span><FolderOutlined /> {record.professionalFieldName}</span>}
                      <span className={`th-badge ${(statusCfg[record.workflowStatus] || statusCfg.DRAFT).cls}`}>
                        {(statusCfg[record.workflowStatus] || statusCfg.DRAFT).label}
                      </span>
                    </div>
                  </div>
                  <div className="th-detail-header__right">
                    <div className="th-detail-hours-ring">
                      <span className="th-detail-hours-value">{record.declaredHours}h</span>
                      <span className="th-detail-hours-label">Giờ đào tạo</span>
                    </div>
                    <div className="th-detail-evidence-ring">
                      <span className="th-detail-evidence-value">
                        <PaperClipOutlined /> {record.evidences?.length || 0}
                      </span>
                      <span className="th-detail-evidence-label">Minh chứng</span>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="th-detail-grid">
                  <div className="th-detail-block">
                    <label className="th-detail-label">Tên khoá đào tạo</label>
                    <div className="th-detail-text">{record.title}</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Số giờ đào tạo</label>
                    <div className="th-detail-text th-detail-text--em">{record.declaredHours} giờ</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Ngày bắt đầu</label>
                    <div className="th-detail-text">{formatDate(record.startDate)}</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Hình thức đào tạo</label>
                    <div className="th-detail-text">{record.activityTypeName || '-'}</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Lĩnh vực chuyên môn</label>
                    <div className="th-detail-text">{record.professionalFieldName || '-'}</div>
                  </div>
                  <div className="th-detail-block th-detail-block--full">
                    <label className="th-detail-label">Ghi chú</label>
                    <div className="th-detail-text">{record.description || 'Không có ghi chú'}</div>
                  </div>
                </div>

                {/* Evidence Preview */}
                {record.evidences && (record.workflowStatus === 'DRAFT' ? record.evidences.length > 0 : record.evidences.filter(canPreviewEvidence).length > 0) && (
                  <div className="th-detail-section">
                    <h3 className="th-detail-section-title">
                      <PaperClipOutlined /> Minh chứng ({record.workflowStatus === 'DRAFT' ? record.evidences.length : record.evidences.filter(canPreviewEvidence).length})
                    </h3>
                    <div className="th-evidence-grid">
                      {(record.workflowStatus === 'DRAFT' ? record.evidences : record.evidences.filter(canPreviewEvidence)).map(ev => {
                        const isPreviewable = canPreviewEvidence(ev)
                        const preview = evidencePreviews[ev.id]

                        return (
                          <article
                            key={ev.id}
                            className={`th-evidence-item${isPreviewable ? ' th-evidence-item--with-preview' : ''}`}
                          >
                            {isPreviewable && (
                              <div className="th-evidence-preview">
                                {preview?.status === 'ready' ? (
                                  <img
                                    className="th-evidence-preview__image"
                                    src={preview.url}
                                    alt={`Minh chứng ${ev.originalFilename}`}
                                    loading="lazy"
                                    onError={() => handlePreviewImageError(ev.id)}
                                  />
                                ) : preview?.status === 'error' ? (
                                  <div className="th-evidence-preview__state" role="alert">
                                    <span>Không thể hiển thị ảnh.</span>
                                    <button
                                      type="button"
                                      className="th-evidence-preview__retry"
                                      onClick={() => handleRetryPreview(ev.id)}
                                    >
                                      Thử lại
                                    </button>
                                  </div>
                                ) : (
                                  <div className="th-evidence-preview__state" role="status">
                                    Đang tải ảnh từ R2...
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="th-evidence-item__info">
                              <PaperClipOutlined className="th-evidence-item__icon" />
                              <span className="th-evidence-item__name" title={ev.originalFilename}>
                                {ev.originalFilename}
                              </span>
                              <span className={`th-badge th-badge--${
                                ev.moderationStatus === 'PASSED' ? 'success'
                                  : ev.moderationStatus === 'FAILED' || ev.moderationStatus === 'ERROR' ? 'danger'
                                  : 'warning'
                              } th-badge--sm`}>
                                {ev.moderationStatus === 'PASSED' ? 'Đã duyệt'
                                  : ev.moderationStatus === 'FAILED' ? 'Từ chối'
                                  : ev.moderationStatus === 'ERROR' ? 'Lỗi'
                                  : 'Chờ duyệt'}
                              </span>
                              {record.workflowStatus === 'DRAFT' && (
                                <button
                                  type="button"
                                  className="th-detail-btn th-evidence-item__download"
                                  onClick={() => handleDownloadEvidence(ev.id)}
                                  aria-label={`Tải xuống ${ev.originalFilename}`}
                                >
                                  <DownloadOutlined /> Tải
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="th-detail-actions">
                  {record.workflowStatus === 'DRAFT' && (
                    <>
                      <button className="th-detail-btn th-detail-btn--primary" onClick={handleSubmit} disabled={submitting}>
                        <SendOutlined /> {submitting ? 'Đang nộp...' : 'Nộp hồ sơ'}
                      </button>
                      <button className="th-detail-btn" onClick={() => navigate(`/staff/training/${record.id}/edit`)}>
                        <EditOutlined /> Chỉnh sửa
                      </button>
                      <button className="th-detail-btn" onClick={() => navigate(`/staff/training/${record.id}/evidence`)}>
                        <PaperClipOutlined /> Quản lý minh chứng
                      </button>
                    </>
                  )}
                  {record.workflowStatus === 'SUBMITTED' && (
                    <button
                      className="th-detail-btn"
                      onClick={handleReturnToDraft}
                      disabled={returningToDraft}
                    >
                      <RollbackOutlined /> {returningToDraft ? 'Đang xử lý...' : 'Trả về nháp'}
                    </button>
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingHoursDetailScreen
