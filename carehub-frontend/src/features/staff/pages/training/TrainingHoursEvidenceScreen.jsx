import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  FileTextOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import '../../styles/TrainingHours.css'

function TrainingHoursEvidenceScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [record, setRecord] = useState(null)
  const [evidenceList, setEvidenceList] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

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
        setError("Không thể tải thông tin minh chứng.")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchRecordAndEvidence()
  }, [id])

  const handleUpload = (file) => {
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert("Tập tin quá lớn. Kích thước tối đa là 5MB.")
      return
    }

    setUploading(true)
    trainingApi.uploadEvidence(id, file)
      .then(() => {
        fetchRecordAndEvidence()
      })
      .catch(err => {
        console.error("Error uploading evidence", err)
        alert("Tải lên thất bại. Vui lòng thử lại.")
      })
      .finally(() => {
        setUploading(false)
      })
  }

  const handleDropzoneClick = () => {
    if (record?.workflowStatus === 'APPROVED') {
      alert("Hồ sơ đã duyệt không thể chỉnh sửa minh chứng.")
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
    if (record?.workflowStatus !== 'APPROVED') {
      setDragOver(true)
    }
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (record?.workflowStatus === 'APPROVED') {
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
          window.open(url, '_blank')
        }
      })
      .catch(err => {
        console.error("Error downloading file", err)
        alert("Không thể tải tập tin.")
      })
  }

  const handleDelete = (evidenceId) => {
    if (record?.workflowStatus === 'APPROVED') {
      alert("Hồ sơ đã duyệt không thể xóa minh chứng.")
      return
    }
    if (window.confirm("Bạn có chắc muốn xóa tệp minh chứng này không?")) {
      trainingApi.deleteEvidence(id, evidenceId)
        .then(() => {
          fetchRecordAndEvidence()
        })
        .catch(err => {
          console.error("Error deleting evidence", err)
          alert("Không thể xóa tập tin.")
        })
    }
  }

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileUnknownOutlined />
    if (mimeType.includes('pdf')) return <FileTextOutlined style={{ color: '#dc2626' }} />
    if (mimeType.includes('image')) return <FileImageOutlined style={{ color: '#2563eb' }} />
    return <FileUnknownOutlined />
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
      case 'APPROVED':
        return 'Duyệt'
      case 'PENDING_REVIEW':
        return 'Chờ'
      case 'REJECTED':
        return 'Từ chối'
      case 'DRAFT':
        return 'Nháp'
      default:
        return status
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'training-badge--approved'
      case 'PENDING_REVIEW':
        return 'training-badge--pending'
      case 'REJECTED':
        return 'training-badge--rejected'
      case 'DRAFT':
        return 'training-badge--pending'
      default:
        return 'training-badge--pending'
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
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Đang tải thông tin minh chứng...</div>
            ) : error || !record ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error || 'Không tìm thấy hồ sơ.'}</div>
            ) : (
              <div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Minh chứng đào tạo</h1>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{record.title} · Tải lên và quản lý các tệp minh chứng</p>
                </div>

                <div className="detail-card">
                  {/* Top info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
                    <div className="detail-field">
                      <label className="detail-field__label">Đào tạo</label>
                      <div className="detail-field__value">{record.title}</div>
                    </div>
                    <div className="detail-field">
                      <label className="detail-field__label">Trạng thái</label>
                      <div className="detail-field__value" style={{ background: '#fff', display: 'flex', alignItems: 'center' }}>
                        <span className={`training-badge ${getStatusClass(record.workflowStatus)}`}>
                          <span className="training-badge__dot" />
                          {getStatusLabel(record.workflowStatus)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Upload input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />

                  {/* Files List */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      DANH SÁCH FILE MINH CHỨNG
                    </p>
                    {evidenceList.length === 0 ? (
                      <div style={{ padding: '20px 0', textHTML: 'center', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: 8, textAlign: 'center' }}>
                        Chưa có tệp minh chứng nào được tải lên.
                      </div>
                    ) : (
                      <div className="evidence-files-list">
                        {evidenceList.map((f) => (
                          <div key={f.id} className="evidence-file-item">
                            <div className="evidence-file-item__info">
                              {getFileIcon(f.mimeType)}
                              <div>
                                <div className="evidence-file-item__name" style={{ fontWeight: 500 }}>{f.originalFilename}</div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{formatSize(f.fileSizeBytes)}</div>
                              </div>
                            </div>
                            <div className="training-actions">
                              <button
                                onClick={() => handleDownload(f.id)}
                                className="training-action-btn"
                                style={{ color: '#16a34a', borderColor: '#16a34a' }}
                                title="Tải xuống"
                              >
                                <DownloadOutlined />
                              </button>
                              {record.workflowStatus !== 'APPROVED' && (
                                <button
                                  onClick={() => handleDelete(f.id)}
                                  className="training-action-btn"
                                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                                  title="Xóa"
                                >
                                  <DeleteOutlined />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Drop zone */}
                  {record.workflowStatus !== 'APPROVED' && (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={handleDropzoneClick}
                      className={`dropzone-container ${dragOver ? 'dragover' : ''}`}
                    >
                      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                        <UploadOutlined style={{ fontSize: 32, color: '#1aaa84' }} />
                      </div>
                      <p className="dropzone-text">
                        {uploading ? 'Đang tải lên...' : 'Kéo & thả hoặc click để chọn file · Định dạng .JPG, PNG, PDF · Tối đa 5MB'}
                      </p>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="evidence-info-box">
                    <InfoCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
                    <p className="evidence-info-text">
                      Minh chứng có thể được xuất trình cho quản lý của bạn trong quá trình đánh giá. Tải xuống để lưu về máy.
                    </p>
                  </div>

                  {/* Footer buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                    <button
                      onClick={() => navigate(`/staff/training/${id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '10px 20px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#374151',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <ArrowLeftOutlined /> Quay lại chi tiết
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingHoursEvidenceScreen
