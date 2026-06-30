import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  EditOutlined,
  PaperClipOutlined,
  ArrowLeftOutlined,
  SendOutlined
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/TrainingHours.css'

function TrainingHoursDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchRecord = () => {
    setLoading(true)
    trainingApi.getRecord(id)
      .then(res => {
        setRecord(res.data?.data)
      })
      .catch(err => {
        console.error("Error fetching training record", err)
        setError("Không thể tải thông tin hồ sơ đào tạo.")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchRecord()
  }, [id])

  const handleSubmit = () => {
    setSubmitting(true)
    trainingApi.submitRecord(id)
      .then(() => {
        showToast("Gửi duyệt hồ sơ thành công!", "success")
        fetchRecord()
      })
      .catch(err => {
        console.error("Error submitting record", err)
        showToast("Gửi duyệt thất bại! Bạn cần tải lên ít nhất 1 file minh chứng hợp lệ trước khi gửi duyệt.", "error")
      })
      .finally(() => {
        setSubmitting(false)
      })
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
      case 'CANCELLED':
        return 'Đã hủy'
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const getApproverName = (record) => {
    if (!record) return '-'
    if (record.reviewTimeline && record.reviewTimeline.length > 0) {
      // Timeline might contain multiple reviews, let's get the latest decision maker
      const lastReview = record.reviewTimeline[record.reviewTimeline.length - 1]
      return lastReview.reviewedByUserName || 'Quản lý'
    }
    return '-'
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
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Đang tải thông tin chi tiết...</div>
            ) : error || !record ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error || 'Không tìm thấy hồ sơ.'}</div>
            ) : (
              <div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết hồ sơ đào tạo</h1>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{record.title} · {formatDate(record.startDate)}</p>
                </div>

                <div className="detail-card">
                  {/* Card Header */}
                  <div className="detail-card__header">
                    <div>
                      <h2 className="detail-card__title">{record.title}</h2>
                      <p className="detail-card__sub">{formatDate(record.startDate)} · {record.declaredHours}h</p>
                    </div>
                    <span className={`training-badge ${getStatusClass(record.workflowStatus)}`}>
                      <span className="training-badge__dot" />
                      {getStatusLabel(record.workflowStatus)}
                    </span>
                  </div>

                  {/* Detail Fields Grid */}
                  <div className="detail-grid">
                    <div className="detail-field">
                      <label className="detail-field__label">Tên khoá đào tạo</label>
                      <div className="detail-field__value">{record.title}</div>
                    </div>
                    <div className="detail-field">
                      <label className="detail-field__label">Giờ</label>
                      <div className="detail-field__value">{record.declaredHours}h</div>
                    </div>
                    <div className="detail-field">
                      <label className="detail-field__label">Ngày bắt đầu</label>
                      <div className="detail-field__value">{formatDate(record.startDate)}</div>
                    </div>
                    <div className="detail-field">
                      <label className="detail-field__label">Hình thức đào tạo</label>
                      <div className="detail-field__value">{record.activityTypeName}</div>
                    </div>
                    <div className="detail-field">
                      <label className="detail-field__label">Đơn vị tổ chức</label>
                      <div className="detail-field__value">{record.provider || '-'}</div>
                    </div>
                    <div className="detail-field">
                      <label className="detail-field__label">Người duyệt</label>
                      <div className="detail-field__value">{getApproverName(record)}</div>
                    </div>
                    <div className="detail-field detail-field--full">
                      <label className="detail-field__label">Ghi chú / Mô tả</label>
                      <div className="detail-field__value" style={{ minHeight: 80 }}>{record.description || '-'}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 28 }}>
                    <button
                      onClick={() => navigate('/staff/training')}
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
                      <ArrowLeftOutlined /> Quay lại
                    </button>
                    {['DRAFT', 'REJECTED'].includes(record.workflowStatus) && (
                      <button
                        onClick={() => navigate(`/staff/training/${record.id}/edit`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '10px 20px',
                          border: '1px solid #2563eb',
                          borderRadius: 8,
                          background: '#fff',
                          color: '#2563eb',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <EditOutlined /> Chỉnh sửa
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/staff/training/${record.id}/evidence`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '10px 20px',
                        border: '1px solid #374151',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#374151',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <PaperClipOutlined /> Quản lý minh chứng
                    </button>
                    {['DRAFT', 'REJECTED'].includes(record.workflowStatus) && (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '10px 20px',
                          border: 'none',
                          borderRadius: 8,
                          background: '#16a34a',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <SendOutlined /> {submitting ? 'Đang gửi...' : 'Gửi duyệt'}
                      </button>
                    )}
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

export default TrainingHoursDetailScreen
