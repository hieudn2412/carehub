import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, DownloadOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/ManagerPages.css'

function ManagerEvidenceReviewDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [evidence] = useState({
    id: id || 1,
    employeeId: 'NV-001',
    employeeName: 'Nguyễn Văn An',
    title: 'Chứng chỉ Kiểm soát nhiễm khuẩn 2026',
    hours: 8,
    date: '20/06/2026',
    filename: 'ksnk_cert_2026.pdf',
    size: '1.2MB',
    provider: 'Bệnh viện Hữu nghị Việt Đức',
    description: 'Khóa tập huấn chuyên sâu 3 ngày về KSNK phòng mổ và KSNK tay cơ bản cho điều dưỡng ngoại khoa.'
  })

  const handleApprove = () => {
    setActionLoading(true)
    setTimeout(() => {
      showToast("Đã duyệt minh chứng thành công!", "success")
      setActionLoading(false)
      navigate('/manager/evidence-review')
    }, 800)
  }

  const handleReject = () => {
    if (!comment.trim()) {
      showToast("Vui lòng điền lý do từ chối phê duyệt.", "warning")
      return
    }
    setActionLoading(true)
    setTimeout(() => {
      showToast("Đã từ chối minh chứng.", "error")
      setActionLoading(false)
      navigate('/manager/evidence-review')
    }, 800)
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Duyệt minh chứng', link: '/manager/evidence-review' },
          { label: 'Chi tiết duyệt' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/manager/evidence-review')}
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                padding: '4px 0',
                marginBottom: 8
              }}
            >
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết phê duyệt minh chứng</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Kiểm tra thông tin chi tiết và tệp chứng nhận CME đính kèm
            </p>
          </div>

          <div className="mgr-section-row">
            {/* Left side: Evidence Info */}
            <div className="mgr-card" style={{ margin: 0 }}>
              <div className="mgr-card-title">
                Thông tin hồ sơ đào tạo
              </div>
              <div className="mgr-kv-grid" style={{ gridTemplateColumns: '1fr', gap: 14 }}>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Nhân viên khai báo</span>
                  <div className="mgr-kv-val" style={{ fontWeight: 600 }}>{evidence.employeeName} ({evidence.employeeId})</div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Tên khóa học / Hội thảo</span>
                  <div className="mgr-kv-val" style={{ fontWeight: 600 }}>{evidence.title}</div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Đơn vị tổ chức</span>
                  <div className="mgr-kv-val">{evidence.provider}</div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Số giờ đào tạo</span>
                  <div className="mgr-kv-val" style={{ fontWeight: 600, color: '#2563eb' }}>{evidence.hours} giờ</div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Mô tả chi tiết</span>
                  <div className="mgr-kv-val" style={{ minHeight: 60, alignItems: 'flex-start' }}>{evidence.description}</div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Ngày nộp</span>
                  <div className="mgr-kv-val">{evidence.date}</div>
                </div>
              </div>
            </div>

            {/* Right side: File preview & moderation actions */}
            <div className="mgr-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="mgr-card-title">
                Tệp minh chứng đính kèm
              </div>
              
              {/* File details card */}
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 8,
                padding: '24px 16px',
                textAlign: 'center',
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1
              }}>
                <span style={{ fontSize: 48, marginBottom: 12 }}>📄</span>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: '#0f172a' }}>{evidence.filename}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Kích thước: {evidence.size}</div>
                
                <button 
                  onClick={() => showToast("Đang tải tệp tin...", "success")}
                  className="training-button"
                  style={{ marginTop: 16, height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                >
                  <DownloadOutlined /> Tải tệp tin về máy
                </button>
              </div>

              {/* Comment inputs */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Ý kiến nhận xét / Lý do từ chối
                </label>
                <textarea 
                  className="f-textarea"
                  placeholder="Nhập nhận xét phê duyệt hoặc lý do từ chối (bắt buộc khi Từ chối)..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button 
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="training-button"
                  style={{ background: '#fef2f2', color: '#ef4444', borderColor: '#fecaca', height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}
                >
                  <CloseOutlined /> Từ chối
                </button>
                <button 
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="training-button training-button--primary"
                  style={{ background: '#10b981', borderColor: '#10b981', height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}
                >
                  <CheckOutlined /> Phê duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvidenceReviewDetailPage
