import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FileTextOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  DownloadOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  InboxOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../../../../features/admin/components/ConfirmModal.jsx'
import '../../styles/TrainingHours.css'

function TrainingHoursEvidenceScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const { showToast } = useToast()

  const [record, setRecord] = useState(null)
  const [evidenceList, setEvidenceList] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    evidenceId: null
  })

  // Editable constraint: only DRAFT records can modify evidence
  const isEditable = record && record.workflowStatus === 'DRAFT'

  const fetchRecordAndEvidence = () => {
    setLoading(true)
    Promise.all([
      trainingApi.getRecord(id),
      trainingApi.listEvidence(id)
    ])
      .then(([recordRes, evidenceRes]) => {
        setRecord(recordRes.data?.data)
        setEvidenceList(evidenceRes.data?.data || [])
      })
      .catch(err => {
        console.error("Error loading record or evidence", err)
        showToast("Không thể tải thông tin minh chứng.", "error")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchRecordAndEvidence()
  }, [id])

  const handleUpload = (file) => {
    if (!isEditable) {
      showToast("Hồ sơ ở trạng thái hiện tại không thể thêm minh chứng.", "warning")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Tập tin quá lớn. Kích thước tối đa là 5MB.", "warning")
      return
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    const fileExtension = file.name.split('.').pop().toLowerCase()
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg']
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      showToast("Định dạng tệp không được hỗ trợ. Chỉ cho phép các tệp PDF, PNG, JPG.", "warning")
      return
    }

    setUploading(true)
    trainingApi.uploadEvidence(id, file)
      .then(() => {
        showToast("Tải lên minh chứng thành công!", "success")
        fetchRecordAndEvidence()
      })
      .catch(err => {
        console.error("Error uploading evidence", err)
        showToast("Tải lên thất bại. Vui lòng thử lại.", "error")
      })
      .finally(() => {
        setUploading(false)
      })
  }

  const handleDropzoneClick = () => {
    if (!isEditable) {
      showToast("Hồ sơ ở trạng thái hiện tại không thể chỉnh sửa minh chứng.", "warning")
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (isEditable) {
      setDragOver(true)
    }
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!isEditable) {
      return
    }
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleDownload = (evidenceId) => {
    trainingApi.createEvidenceDownloadUrl(id, evidenceId)
      .then(res => {
        const url = res.data?.data?.downloadUrl
        if (url) {
          window.open(toAbsoluteDownloadUrl(url), '_blank', 'noopener,noreferrer')
          showToast("Đang mở liên kết tải xuống...", "success")
        }
      })
      .catch(err => {
        console.error("Error downloading file", err)
        showToast("Không thể tải tập tin.", "error")
      })
  }

  const handleDelete = (evidenceId) => {
    if (!isEditable) {
      showToast("Hồ sơ ở trạng thái hiện tại không thể xóa minh chứng.", "warning")
      return
    }
    setConfirmModal({
      isOpen: true,
      evidenceId
    })
  }

  const executeDelete = (evidenceId) => {
    trainingApi.deleteEvidence(id, evidenceId)
      .then(() => {
        showToast("Đã xóa tệp minh chứng thành công.", "success")
        fetchRecordAndEvidence()
      })
      .catch(err => {
        console.error("Error deleting evidence", err)
        showToast("Không thể xóa tập tin.", "error")
      })
  }

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileUnknownOutlined className="file-type-icon" style={{ background: '#f1f5f9', color: '#64748b' }} />
    if (mimeType.includes('pdf')) {
      return <FileTextOutlined className="file-type-icon file-type-icon--pdf" />
    }
    if (mimeType.includes('image') || mimeType.includes('png') || mimeType.includes('jpeg')) {
      return <FileImageOutlined className="file-type-icon file-type-icon--image" />
    }
    return <FileUnknownOutlined className="file-type-icon" style={{ background: '#f1f5f9', color: '#64748b' }} />
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'SUBMITTED': return 'Đã nộp'
      case 'CANCELLED': return 'Đã hủy'
      case 'DRAFT': return 'Bản nháp'
      default: return status
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'SUBMITTED': return 'training-badge--approved'
      case 'CANCELLED': return 'training-badge--rejected'
      case 'DRAFT': return 'training-badge--pending'
      default: return 'training-badge--pending'
    }
  }

  const toAbsoluteDownloadUrl = (downloadUrl) => {
    if (!downloadUrl) return ''
    if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
    const apiBase = new URL(apiBaseUrl, window.location.origin)
    return new URL(downloadUrl, apiBase.origin).toString()
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

  const getModerationBadgeClass = (status) => {
    switch (status) {
      case 'PASSED': return 'moderation-status-badge--passed'
      case 'FAILED': return 'moderation-status-badge--failed'
      case 'PENDING':
      default:
        return 'moderation-status-badge--pending'
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Giờ đào tạo', link: '/staff/training' },
          { label: 'Chi tiết', link: `/staff/training/${id}` },
          { label: 'Minh chứng' }
        ]} />
        <div className="dashboard-layout__body">
          <div className="training-page">
            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280' }}>
                <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải thông tin minh chứng...
              </div>
            ) : !record ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
                Không tìm thấy thông tin hồ sơ.
              </div>
            ) : (
              <div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Minh chứng đào tạo</h1>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 20px' }}>
                    {record.title} · Quản lý và tải lên tệp minh chứng CME
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr', alignItems: 'stretch', marginBottom: 24 }}>
                  {/* Left Info Panel */}
                  <div className="detail-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
                    <dl className="training-definition" style={{ gap: '12px 16px' }}>
                      <dt>Đào tạo</dt>
                      <dd style={{ color: '#1e293b', fontWeight: 600 }}>{record.title}</dd>
                      <dt>Trạng thái hồ sơ</dt>
                      <dd>
                        <span className={`training-badge ${getStatusClass(record.workflowStatus)}`} style={{ margin: 0 }}>
                          <span className="training-badge__dot" />
                          {getStatusLabel(record.workflowStatus)}
                        </span>
                      </dd>
                      <dt>Số giờ khai báo</dt>
                      <dd style={{ color: '#2563eb', fontWeight: 700 }}>{record.declaredHours} giờ</dd>
                    </dl>
                  </div>

                  {/* Right Upload Panel */}
                  <div className="detail-card" style={{ margin: 0, padding: 18 }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/png,image/jpeg,application/pdf"
                      style={{ display: 'none' }}
                    />
                    
                    {isEditable ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleDropzoneClick}
                        className={`evidence-dropzone ${dragOver ? 'drag-active' : ''}`}
                        style={{ margin: 0, padding: '24px 16px' }}
                      >
                        <InboxOutlined className="dropzone-icon" />
                        <p className="dropzone-text">
                          {uploading ? 'Đang tải lên...' : 'Kéo thả hoặc click để chọn file minh chứng'}
                        </p>
                        <small className="dropzone-hint">Định dạng JPG, PNG, PDF · Tối đa 5MB</small>
                      </div>
                    ) : (
                      <div className="evidence-info-box" style={{ background: '#f8fafc', borderColor: '#cbd5e1', color: '#64748b', height: '100%', display: 'flex', alignItems: 'center' }}>
                        <InfoCircleOutlined style={{ fontSize: 18, color: '#64748b' }} />
                        <p className="evidence-info-text">
                          Hồ sơ đang ở trạng thái <strong>{getStatusLabel(record.workflowStatus)}</strong>. Bạn không thể thêm hoặc sửa đổi minh chứng trong trạng thái này.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence List section */}
                <div style={{ marginTop: 24 }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: 8, marginBottom: 16 }}>
                    Danh sách tệp minh chứng đã đính kèm
                  </h2>
                  
                  {evidenceList.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                      Chưa có tệp minh chứng nào được tải lên cho hồ sơ này.
                    </div>
                  ) : (
                    <div className="evidence-cards-grid">
                      {evidenceList.map((f) => (
                        <div className="evidence-card" key={f.id}>
                          <div>
                            <div className="evidence-card-header">
                              {getFileIcon(f.mimeType)}
                              <div style={{ flex: 1 }}>
                                <h4 className="evidence-card-title" title={f.originalFilename}>
                                  {f.originalFilename}
                                </h4>
                                <div className="evidence-card-meta">
                                  <span>{formatSize(f.fileSizeBytes)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="evidence-card-footer">
                            <span className={`moderation-status-badge ${getModerationBadgeClass(f.moderationStatus)}`}>
                              {getModerationLabel(f.moderationStatus)}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button 
                                className="training-button" 
                                onClick={() => handleDownload(f.id)} 
                                style={{ padding: '4px 10px', minHeight: '30px', fontSize: '12.5px', borderRadius: '6px' }}
                                type="button"
                              >
                                <DownloadOutlined style={{ marginRight: 4 }} /> Tải về
                              </button>
                              
                              {isEditable && (
                                <button 
                                  className="training-button" 
                                  onClick={() => handleDelete(f.id)} 
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
                </div>

                {/* Footer action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
                  <button
                    onClick={() => navigate(`/staff/training/${id}`)}
                    className="training-button"
                    style={{ borderRadius: 8, padding: '8px 18px', fontWeight: 600 }}
                  >
                    <ArrowLeftOutlined style={{ marginRight: 6 }} /> Quay lại chi tiết hồ sơ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Xóa minh chứng"
        message="Bạn có chắc chắn muốn xóa tệp minh chứng này không? Hành động này không thể hoàn tác."
        danger={true}
        onConfirm={() => {
          executeDelete(confirmModal.evidenceId)
          setConfirmModal({ isOpen: false, evidenceId: null })
        }}
        onCancel={() => setConfirmModal({ isOpen: false, evidenceId: null })}
      />
    </div>
  )
}

export default TrainingHoursEvidenceScreen
