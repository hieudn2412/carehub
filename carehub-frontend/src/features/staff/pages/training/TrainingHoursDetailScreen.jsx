import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EditOutlined,
  PaperClipOutlined,
  SendOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  RollbackOutlined,
  FolderOutlined,
  DeleteOutlined,
  LeftOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../../../../features/admin/components/ConfirmModal.jsx'
import { getApiErrorMessage } from '../../../../features/auth/utils/apiError.js'
import '../../styles/TrainingHours.css'

const PREVIEWABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

function canPreviewEvidence(evidence) {
  return PREVIEWABLE_IMAGE_TYPES.has(evidence?.mimeType?.toLowerCase())
}

function isPdfEvidence(evidence) {
  return evidence?.mimeType?.toLowerCase() === 'application/pdf'
}

function getEvidenceTypeLabel(evidence) {
  const mimeType = evidence?.mimeType?.toLowerCase()
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType === 'image/png') return 'PNG'
  if (mimeType === 'image/jpeg') return 'JPG'
  return 'Tệp đính kèm'
}

function formatEvidenceSize(sizeInBytes) {
  const size = Number(sizeInBytes)
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [openingEvidenceId, setOpeningEvidenceId] = useState(null)
  const [mobileTab, setMobileTab] = useState('info')
  const [trainingWindowYears, setTrainingWindowYears] = useState(null)

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

  useEffect(() => {
    trainingApi.getMyTrainingStatus()
      .then(res => {
        const years = Number(res.data?.data?.cycleYears)
        setTrainingWindowYears(Number.isInteger(years) && years > 0 ? years : null)
      })
      .catch(() => setTrainingWindowYears(null))
  }, [])

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
    if (record.startDate && trainingWindowYears) {
      const recordDate = new Date(record.startDate)
      const windowStart = new Date()
      windowStart.setFullYear(windowStart.getFullYear() - trainingWindowYears)
      windowStart.setHours(0, 0, 0, 0)
      recordDate.setHours(0, 0, 0, 0)
      if (recordDate < windowStart) {
        showToast(`Hồ sơ đào tạo quá ${trainingWindowYears} năm không được phép nộp.`, "error")
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

  const handleViewEvidence = async (evidenceId) => {
    setOpeningEvidenceId(evidenceId)
    try {
      const url = await requestEvidencePreview(evidenceId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      showToast("Không thể mở minh chứng.", "error")
    } finally {
      setOpeningEvidenceId(null)
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
    setReturnConfirmOpen(false)
    setReturningToDraft(true)
    try {
      await trainingApi.returnToDraft(id)
      showToast("Đã trả hồ sơ về nháp!", "success")
      fetchRecord()
    } catch (error) {
      showToast(getApiErrorMessage(error, "Không thể trả hồ sơ về nháp."), "error")
    } finally {
      setReturningToDraft(false)
    }
  }

  const handleDelete = async () => {
    if (!record) return
    setDeleteConfirmOpen(false)
    setDeleting(true)
    try {
      await trainingApi.deleteRecord(id, record.version)
      showToast("Đã xóa hồ sơ đào tạo.", "success")
      navigate('/staff/training')
    } catch (error) {
      showToast(getApiErrorMessage(error, "Không thể xóa hồ sơ đào tạo."), "error")
    } finally {
      setDeleting(false)
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
  const visibleEvidences = record?.evidences || []

  return (
    <AppShell
      className="training-hours-detail-shell"
      back={{ to: '/staff/training', label: 'Quay lại' }}
      breadcrumbs={[
        { label: 'Giờ đào tạo', link: '/staff/training' },
        { label: 'Chi tiết' }
      ]}
    >
      <div className={`training-page th-detail-page th-detail-page--mobile-${mobileTab}`}>

            {loading ? (
              <div className="th-table-state">Đang tải thông tin...</div>
            ) : !record ? (
              <div className="th-table-state">Không tìm thấy hồ sơ.</div>
            ) : (
              <>
                <div className="th-detail-header">
                  <button
                    type="button"
                    className="th-mobile-detail-back"
                    onClick={() => navigate('/staff/training')}
                    aria-label="Quay lại danh sách giờ đào tạo"
                  >
                    <LeftOutlined />
                  </button>
                  <div className="th-detail-header__left">
                    <h1 className="th-detail-title">{record.title}</h1>
                    <div className="th-detail-meta">
                      <span className="th-detail-meta__date"><ClockCircleOutlined /> {formatDate(record.startDate)}</span>
                      {record.professionalFieldName && <span className="th-detail-meta__field"><FolderOutlined /> {record.professionalFieldName}</span>}
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

                <nav className="th-mobile-detail-tabs" aria-label="Nội dung chi tiết hồ sơ">
                  <button
                    type="button"
                    className={mobileTab === 'info' ? 'is-active' : ''}
                    onClick={() => setMobileTab('info')}
                  >
                    Thông tin
                  </button>
                  <button
                    type="button"
                    className={mobileTab === 'evidence' ? 'is-active' : ''}
                    onClick={() => setMobileTab('evidence')}
                  >
                    Minh chứng <span>{visibleEvidences.length}</span>
                  </button>
                </nav>

                <div className="th-mobile-detail-content">
                {/* Evidence is the primary verification object, so it appears first. */}
                {visibleEvidences.length > 0 && (
                  <section className="th-detail-section th-detail-section--evidence-first" aria-labelledby="training-evidence-heading">
                    <div className="th-detail-section-heading">
                      <div>
                        <span className="th-detail-section-eyebrow">Minh chứng xác thực</span>
                        <h2 className="th-detail-section-title" id="training-evidence-heading">
                          <PaperClipOutlined /> Tệp minh chứng
                        </h2>
                      </div>
                      <span className="th-detail-section-count">
                        {visibleEvidences.length} tệp
                      </span>
                    </div>
                    <div className="th-evidence-grid th-evidence-grid--featured">
                      {visibleEvidences.map(ev => {
                        const isPreviewable = canPreviewEvidence(ev)
                        const isPdf = isPdfEvidence(ev)
                        const preview = evidencePreviews[ev.id]
                        const fileSize = formatEvidenceSize(ev.fileSizeBytes)

                        return (
                          <article
                            key={ev.id}
                            className={`th-evidence-item${isPreviewable ? ' th-evidence-item--with-preview' : ''}${isPdf ? ' th-evidence-item--document' : ''}`}
                          >
                            {isPreviewable && (
                              <div className="th-evidence-preview">
                                {preview?.status === 'ready' ? (
                                  <img
                                    className="th-evidence-preview__image"
                                    src={preview.url}
                                    alt={`Minh chứng ${ev.originalFilename}`}
                                    loading="eager"
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
                                    Đang tải hình ảnh minh chứng...
                                  </div>
                                )}
                              </div>
                            )}

                            {isPdf && (
                              <div className="th-evidence-document" aria-hidden="true">
                                <span className="th-evidence-document__icon"><FilePdfOutlined /></span>
                                <span className="th-evidence-document__type">Tài liệu PDF</span>
                                <span className="th-evidence-document__hint">Có thể xem trực tuyến hoặc tải xuống</span>
                              </div>
                            )}

                            <div className="th-evidence-item__info">
                              {isPdf
                                ? <FilePdfOutlined className="th-evidence-item__icon th-evidence-item__icon--pdf" />
                                : isPreviewable
                                  ? <FileImageOutlined className="th-evidence-item__icon" />
                                  : <PaperClipOutlined className="th-evidence-item__icon" />}
                              <span className="th-evidence-item__details">
                                <span className="th-evidence-item__name" title={ev.originalFilename}>
                                  {ev.originalFilename}
                                </span>
                                <span className="th-evidence-item__meta">
                                  {getEvidenceTypeLabel(ev)}{fileSize ? ` · ${fileSize}` : ''}
                                </span>
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
                              <span className="th-evidence-item__actions">
                                <button
                                  type="button"
                                  className="th-detail-btn th-evidence-item__view"
                                  onClick={() => handleViewEvidence(ev.id)}
                                  disabled={openingEvidenceId === ev.id}
                                  aria-label={`Xem ${ev.originalFilename}`}
                                >
                                  {openingEvidenceId === ev.id ? <LoadingOutlined spin /> : <EyeOutlined />} Xem
                                </button>
                                <button
                                  type="button"
                                  className="th-detail-btn th-evidence-item__download"
                                  onClick={() => handleDownloadEvidence(ev.id)}
                                  aria-label={`Tải xuống ${ev.originalFilename}`}
                                >
                                  <DownloadOutlined /> Tải xuống
                                </button>
                              </span>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )}
                {visibleEvidences.length === 0 && (
                  <div className="th-mobile-detail-empty">
                    <PaperClipOutlined />
                    <strong>Chưa có minh chứng</strong>
                    <span>Hồ sơ này chưa đính kèm tệp minh chứng đào tạo.</span>
                  </div>
                )}

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
                </div>

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
                      <button
                        className="th-detail-btn th-detail-btn--danger"
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={deleting}
                      >
                        <DeleteOutlined /> {deleting ? 'Đang xóa...' : 'Xóa hồ sơ'}
                      </button>
                    </>
                  )}
                  {record.workflowStatus === 'SUBMITTED' && (
                    <button
                      className="th-detail-btn"
                      onClick={() => setReturnConfirmOpen(true)}
                      disabled={returningToDraft}
                    >
                      <RollbackOutlined /> {returningToDraft ? 'Đang xử lý...' : 'Trả về nháp'}
                    </button>
                  )}
                </div>
              </>
            )}
      </div>
      <ConfirmModal
        isOpen={returnConfirmOpen}
        title="Trả hồ sơ về nháp"
        message="Hồ sơ sẽ được mở lại để chỉnh sửa và cần nộp lại sau khi hoàn tất thay đổi."
        confirmText="Trả về nháp"
        onConfirm={handleReturnToDraft}
        onCancel={() => setReturnConfirmOpen(false)}
      />
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Xóa hồ sơ đào tạo"
        message="Bạn có chắc chắn muốn xóa hồ sơ này không? Hồ sơ sẽ được lưu trạng thái đã hủy để bảo đảm lịch sử thay đổi."
        confirmText="Xóa hồ sơ"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </AppShell>
  )
}

export default TrainingHoursDetailScreen
