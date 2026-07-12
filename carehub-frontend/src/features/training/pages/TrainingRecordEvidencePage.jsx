import { Link, useParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../../admin/components/ConfirmModal.jsx'
import { 
  UploadOutlined, 
  FilePdfOutlined, 
  FileImageOutlined, 
  DeleteOutlined, 
  DownloadOutlined, 
  InboxOutlined, 
  ArrowLeftOutlined, 
  CloseOutlined, 
  LoadingOutlined,
  FileUnknownOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import '../styles/training.css'

function TrainingRecordEvidencePage() {
  const { id } = useParams()
  const { showToast } = useToast()
  
  const [record, setRecord] = useState(null)
  const [evidences, setEvidences] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    evidenceId: null
  })

  // Editable check: only DRAFT records can modify evidence
  const isEditable = record && record.workflowStatus === 'DRAFT'

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [recordResponse, evidenceResponse] = await Promise.all([
        trainingApi.getRecord(id),
        trainingApi.listEvidence(id),
      ])
      setRecord(recordResponse.data.data)
      setEvidences(evidenceResponse.data.data ?? [])
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể tải minh chứng'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [id, showToast])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [load])

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true)
    } else if (e.type === "dragleave") {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const validTypes = ['image/png', 'image/jpeg', 'application/pdf']
      const fileExtension = file.name.split('.').pop().toLowerCase()
      const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg']
      
      if (file.size > 5 * 1024 * 1024) {
        showToast('Tập tin quá lớn. Kích thước tối đa là 5MB.', 'warning')
        return
      }
      
      if (validTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        setSelectedFile(file)
      } else {
        showToast('Định dạng tệp không hợp lệ! Vui lòng chọn tệp PNG, JPG hoặc PDF.', 'warning')
      }
    }
  }

  const upload = async (event) => {
    if (event) event.preventDefault()
    if (!selectedFile) return
    if (!isEditable) {
      showToast('Hồ sơ ở trạng thái hiện tại không thể thêm minh chứng.', 'warning')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast('Tập tin quá lớn. Kích thước tối đa là 5MB.', 'warning')
      return
    }

    const validTypes = ['image/png', 'image/jpeg', 'application/pdf']
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase()
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg']
    if (!validTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExtension)) {
      showToast('Định dạng tệp không hợp lệ! Vui lòng chọn tệp PNG, JPG hoặc PDF.', 'warning')
      return
    }

    setIsWorking(true)
    try {
      const response = await trainingApi.uploadEvidence(id, selectedFile)
      setEvidences((current) => [response.data.data, ...current])
      setSelectedFile(null)
      showToast('Tải lên tệp minh chứng thành công!', 'success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể tải lên minh chứng'), 'error')
    } finally {
      setIsWorking(false)
    }
  }

  const remove = (evidenceId) => {
    if (!isEditable) {
      showToast('Hồ sơ ở trạng thái hiện tại không thể xóa minh chứng.', 'warning')
      return
    }
    setConfirmModal({
      isOpen: true,
      evidenceId
    })
  }

  const executeRemove = async (evidenceId) => {
    setIsWorking(true)
    try {
      await trainingApi.deleteEvidence(id, evidenceId)
      setEvidences((current) => current.filter((item) => item.id !== evidenceId))
      showToast('Đã xóa tệp minh chứng thành công.', 'success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể xóa minh chứng'), 'error')
    } finally {
      setIsWorking(false)
    }
  }

  const download = async (evidenceId) => {
    setIsWorking(true)
    try {
      const response = await trainingApi.createEvidenceDownloadUrl(id, evidenceId)
      window.open(toAbsoluteDownloadUrl(response.data.data.downloadUrl), '_blank', 'noopener,noreferrer')
      showToast('Đang mở liên kết tải xuống...', 'success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể tạo liên kết tải xuống'), 'error')
    } finally {
      setIsWorking(false)
    }
  }

  const submit = async () => {
    if (!record) return
    if (!isEditable) {
      showToast('Hồ sơ ở trạng thái hiện tại không thể nộp duyệt.', 'warning')
      return
    }

    setIsWorking(true)
    try {
      const response = await trainingApi.submitRecord(id, { version: record.version })
      setRecord(response.data.data)
      showToast('Đã nộp hồ sơ đào tạo.', 'success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể nộp hồ sơ đào tạo'), 'error')
    } finally {
      setIsWorking(false)
    }
  }

  const renderFileIcon = (mimeType) => {
    if (!mimeType) return <FileUnknownOutlined className="file-type-icon" style={{ background: '#f1f5f9', color: '#64748b' }} />
    if (mimeType.includes('pdf')) {
      return <FilePdfOutlined className="file-type-icon file-type-icon--pdf" />
    }
    if (mimeType.includes('image') || mimeType.includes('png') || mimeType.includes('jpeg')) {
      return <FileImageOutlined className="file-type-icon file-type-icon--image" />
    }
    return <FileUnknownOutlined className="file-type-icon" style={{ background: '#f1f5f9', color: '#64748b' }} />
  }

  const getModerationBadgeClass = (status) => {
    switch (status) {
      case 'PASSED': return 'moderation-status-badge--passed'
      case 'FAILED': return 'moderation-status-badge--failed'
      case 'PENDING':
      default:
        return 'moderation-status-badge--pending'
    }
  }

  const getModerationLabel = (status) => {
    switch (status) {
      case 'PASSED': return 'Đã duyệt'
      case 'FAILED': return 'Từ chối'
      case 'PENDING':
      default:
        return 'Chờ duyệt'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'SUBMITTED': return 'Đã nộp'
      case 'CANCELLED': return 'Đã hủy'
      case 'DRAFT': return 'Bản nháp'
      default: return status
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Đào tạo liên tục CME</p>
          <h1>Minh chứng khóa học</h1>
        </div>
        <div className="training-header-actions">
          <Link className="training-button" to={`/training/records/${id}/edit`}>
            Sửa thông tin hồ sơ
          </Link>
          <Link className="training-button" to="/training/records">
            Quay lại
          </Link>
        </div>
      </section>

      <section className="training-detail-grid">
        <article className="training-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {isLoading ? (
            <div className="training-skeleton" style={{ border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải thông tin...
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '16px' }}>
                {record?.title ?? `Hồ sơ #${id}`}
              </h2>
              <dl className="training-definition" style={{ gap: '12px 16px' }}>
                <dt>Trạng thái</dt>
                <dd>
                  <span className={`training-badge ${
                    record?.workflowStatus === 'SUBMITTED' ? 'is-active' :
                    record?.workflowStatus === 'CANCELLED' ? 'is-inactive' : 'is-warning'
                  }`}>
                    {record?.workflowStatus === 'SUBMITTED' ? 'Đã nộp' :
                     record?.workflowStatus === 'CANCELLED' ? 'Đã hủy' :
                     'Bản nháp'}
                  </span>
                </dd>
                <dt>Loại hình</dt>
                <dd style={{ color: '#334155', fontWeight: 500 }}>{record?.activityTypeName ?? '-'}</dd>
                <dt>Số giờ đào tạo</dt>
                <dd style={{ color: '#2563eb', fontWeight: 700, fontSize: '1.05rem' }}>{record?.declaredHours ?? '0'} giờ</dd>
                <dt>Phiên bản</dt>
                <dd>{record?.version ?? '-'}</dd>
              </dl>
            </div>
          )}
        </article>

        <article className="training-panel">
          <form className="training-form" onSubmit={upload}>
            {isEditable ? (
              <div 
                className={`evidence-dropzone ${isDragActive ? 'drag-active' : ''} ${selectedFile ? 'file-selected' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('evidence-file-input').click()}
              >
                <input 
                  id="evidence-file-input"
                  type="file" 
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-content">
                  <InboxOutlined className="dropzone-icon" />
                  {selectedFile ? (
                    <div className="selected-file-info">
                      <p className="filename">{selectedFile.name}</p>
                      <p className="filesize">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <>
                      <p className="dropzone-text">Kéo thả tệp minh chứng vào đây hoặc click để chọn</p>
                      <small className="dropzone-hint">Hỗ trợ định dạng PNG, JPG, PDF (Tối đa 5MB)</small>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="evidence-info-box" style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#64748b', padding: 20, borderRadius: 12, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
                <InfoCircleOutlined style={{ fontSize: 18, color: '#64748b' }} />
                <p style={{ margin: 0, fontSize: 13.5 }}>
                  Hồ sơ đang ở trạng thái <strong>{getStatusLabel(record?.workflowStatus)}</strong>. Không thể thêm hoặc sửa đổi minh chứng.
                </p>
              </div>
            )}

            <div className="training-form-actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              {selectedFile && (
                <button 
                  className="training-button" 
                  type="button" 
                  onClick={() => setSelectedFile(null)} 
                  style={{ marginRight: 'auto', background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  Hủy tệp
                </button>
              )}
              <button 
                className="training-button training-button--primary" 
                disabled={isWorking || !selectedFile || !isEditable} 
                type="submit"
                style={{ borderRadius: '8px', padding: '8px 18px' }}
              >
                {isWorking ? <LoadingOutlined style={{ marginRight: 6 }} /> : <UploadOutlined style={{ marginRight: 6 }} />} Tải lên minh chứng
              </button>
              <button 
                className="training-button" 
                disabled={isWorking || !record || !isEditable} 
                onClick={submit} 
                type="button"
                style={{ borderRadius: '8px', padding: '8px 18px', background: '#f8fafc', fontWeight: 600 }}
              >
                Nộp hồ sơ
              </button>
            </div>
          </form>
        </article>

        <article className="training-panel training-panel--wide" style={{ border: 'none', background: 'transparent', padding: 0 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: 8, marginBottom: 8 }}>
            Tệp minh chứng đã tải lên
          </h2>
          
          {isLoading ? (
            <div className="training-skeleton" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingOutlined style={{ fontSize: 20, marginRight: 8 }} /> Đang tải danh sách...
            </div>
          ) : evidences.length === 0 ? (
            <div className="training-empty" style={{ textAlign: 'center', padding: '40px 20px' }}>
              Chưa có tệp minh chứng nào được tải lên cho hồ sơ này.
            </div>
          ) : (
            <div className="evidence-cards-grid">
              {evidences.map((item) => (
                <div className="evidence-card" key={item.id}>
                  <div>
                    <div className="evidence-card-header">
                      {renderFileIcon(item.mimeType)}
                      <div style={{ flex: 1 }}>
                        <h4 className="evidence-card-title" title={item.originalFilename}>
                          {item.originalFilename}
                        </h4>
                        <div className="evidence-card-meta">
                          <span>{formatSize(item.fileSizeBytes)}</span>
                          <span style={{ margin: '0 6px' }}>•</span>
                          <span>{formatDateTime(item.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="evidence-card-footer">
                    <span className={`moderation-status-badge ${getModerationBadgeClass(item.moderationStatus)}`}>
                      {getModerationLabel(item.moderationStatus)}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        className="training-button" 
                        onClick={() => download(item.id)} 
                        disabled={isWorking}
                        style={{ padding: '4px 10px', minHeight: '30px', fontSize: '12.5px', borderRadius: '6px' }}
                        type="button"
                      >
                        <DownloadOutlined style={{ marginRight: 4 }} /> Tải về
                      </button>
                      
                      {isEditable && (
                        <button 
                          className="training-button" 
                          onClick={() => remove(item.id)} 
                          disabled={isWorking}
                          style={{ padding: '4px 10px', minHeight: '30px', fontSize: '12.5px', borderRadius: '6px', color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' }}
                          type="button"
                        >
                          <DeleteOutlined style={{ marginRight: 4 }} /> Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Xóa minh chứng"
        message="Bạn có chắc chắn muốn xóa tệp minh chứng này không? Hành động này không thể hoàn tác."
        danger={true}
        onConfirm={() => {
          executeRemove(confirmModal.evidenceId)
          setConfirmModal({ isOpen: false, evidenceId: null })
        }}
        onCancel={() => setConfirmModal({ isOpen: false, evidenceId: null })}
      />
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
