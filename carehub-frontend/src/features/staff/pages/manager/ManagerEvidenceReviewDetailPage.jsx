import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import AdminSidebar from '../../../admin/components/AdminSidebar'
import AdminHeader from '../../../admin/components/AdminHeader'
import { tokenStorage } from '../../../auth/services/tokenStorage.js'
import { AUTH_ROLE, hasAnyRole } from '../../../auth/utils/authNavigation.js'
import { getRolesFromAccessToken, getJwtPayload } from '../../../auth/utils/jwt.js'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { trainingApi } from '../../../training/api/trainingApi'
import '../../styles/ManagerPages.css'

function ManagerEvidenceReviewDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [evidence, setEvidence] = useState(null)
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const accessToken = tokenStorage.getAccessToken()
  const payload = getJwtPayload(accessToken)
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])
  const currentEmployeeCode = payload?.employeeCode || ''
  const backPath = isAdmin ? '/admin/training/evidence-review' : '/manager/evidence-review'

  useEffect(() => {
    setLoading(true)
    Promise.all([
      trainingApi.getRecord(id),
      trainingApi.listEvidence(id)
    ])
      .then(([recordRes, evidenceRes]) => {
        setEvidence(recordRes.data?.data)
        setEvidenceFiles(evidenceRes.data?.data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading pending evidence details", err)
        setError("Không thể tải chi tiết minh chứng.")
        setLoading(false)
      })
  }, [id])

  const handleApprove = () => {
    setActionLoading(true)
    trainingApi.approveRecord(id, { 
      approvedHours: evidence?.declaredHours,
      reason: comment || "Phê duyệt"
    })
      .then(() => {
        showToast("Đã duyệt minh chứng thành công!", "success")
        setActionLoading(false)
        navigate(backPath)
      })
      .catch(err => {
        console.error("Error approving record", err)
        showToast(err.response?.data?.message || "Lỗi khi phê duyệt minh chứng.", "error")
        setActionLoading(false)
      })
  }

  const handleReject = () => {
    if (!comment.trim()) {
      showToast("Vui lòng điền lý do từ chối phê duyệt.", "warning")
      return
    }
    setActionLoading(true)
    trainingApi.rejectRecord(id, {
      reason: comment
    })
      .then(() => {
        showToast("Đã từ chối minh chứng thành công.", "success")
        setActionLoading(false)
        navigate(backPath)
      })
      .catch(err => {
        console.error("Error rejecting record", err)
        showToast(err.response?.data?.message || "Lỗi khi từ chối minh chứng.", "error")
        setActionLoading(false)
      })
  }

  const handleDownload = (file) => {
    trainingApi.createEvidenceDownloadUrl(id, file.id)
      .then(res => {
        const downloadUrl = res.data?.data?.downloadUrl
        if (downloadUrl) {
          window.open(downloadUrl, '_blank')
        } else {
          showToast("Không tìm thấy đường dẫn tải về.", "error")
        }
      })
      .catch(err => {
        console.error("Error getting download url", err)
        showToast("Lỗi khi lấy đường dẫn tải tệp.", "error")
      })
  }

  const formatSize = (bytes) => {
    if (!bytes) return '---'
    const kb = bytes / 1024
    if (kb < 1024) return kb.toFixed(1) + ' KB'
    return (kb / 1024).toFixed(1) + ' MB'
  }

  if (loading) {
    return (
      <div className="dashboard-layout">
        {isAdmin ? <AdminSidebar /> : <Sidebar />}
        <div className="dashboard-layout__content">
          {isAdmin ? <AdminHeader breadcrumbs={[{ label: 'Đào tạo' }, { label: 'Duyệt minh chứng' }]} /> : <Header title="Duyệt minh chứng" />}
          <div className="dashboard-layout__body" style={{ textAlign: 'center', padding: 100 }}>
            <LoadingOutlined style={{ fontSize: 32, color: '#2563eb' }} />
            <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải chi tiết minh chứng...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !evidence) {
    return (
      <div className="dashboard-layout">
        {isAdmin ? <AdminSidebar /> : <Sidebar />}
        <div className="dashboard-layout__content">
          {isAdmin ? <AdminHeader breadcrumbs={[{ label: 'Đào tạo' }, { label: 'Duyệt minh chứng' }]} /> : <Header title="Duyệt minh chứng" />}
          <div className="dashboard-layout__body" style={{ textAlign: 'center', padding: 100 }}>
            <p style={{ color: '#ef4444', fontWeight: 600 }}>{error || 'Không tìm thấy thông tin minh chứng.'}</p>
            <button className="training-button" onClick={() => navigate(backPath)} style={{ marginTop: 12 }}>
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'Duyệt minh chứng', link: backPath },
    { label: 'Chi tiết duyệt' }
  ]

  return (
    <div className="dashboard-layout">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <div className="dashboard-layout__content">
        {isAdmin ? <AdminHeader breadcrumbs={breadcrumbs} /> : <Header breadcrumbs={breadcrumbs} />}
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate(backPath)}
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
                  <div className="mgr-kv-val" style={{ fontWeight: 600 }}>{evidence.employeeName} ({evidence.employeeCode})</div>
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
                  <div className="mgr-kv-val" style={{ fontWeight: 600, color: '#2563eb' }}>{evidence.declaredHours} giờ</div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Ngày bắt đầu - kết thúc</span>
                  <div className="mgr-kv-val">
                    {evidence.startDate ? new Date(evidence.startDate).toLocaleDateString('vi-VN') : ''}
                    {evidence.endDate ? ` - ${new Date(evidence.endDate).toLocaleDateString('vi-VN')}` : ''}
                  </div>
                </div>
                <div className="mgr-kv-item">
                  <span className="mgr-kv-label">Ngày nộp</span>
                  <div className="mgr-kv-val">{evidence.submittedAt ? new Date(evidence.submittedAt).toLocaleDateString('vi-VN') : ''}</div>
                </div>
              </div>
            </div>

            {/* Right side: File preview & moderation actions */}
            <div className="mgr-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="mgr-card-title">
                Tệp minh chứng đính kèm
              </div>
              
              {evidenceFiles.length === 0 ? (
                <div style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: '24px 16px',
                  textAlign: 'center',
                  marginBottom: 20,
                  color: '#64748b',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  Không có tệp đính kèm nào được tải lên.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, flex: 1 }}>
                  {evidenceFiles.map(file => (
                    <div key={file.id} style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                        <span style={{ fontSize: 32 }}>📄</span>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={file.fileName}>
                            {file.fileName}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Kích thước: {formatSize(file.fileSizeBytes)}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDownload(file)}
                        className="training-button"
                        style={{ height: 32, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0 }}
                      >
                        <DownloadOutlined /> Tải về
                      </button>
                    </div>
                  ))}
                </div>
              )}

               {/* Comment inputs & action buttons or self-review warning */}
              {!isAdmin && evidence?.employeeCode === currentEmployeeCode ? (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: 8,
                  padding: 16,
                  color: '#d97706',
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  lineHeight: '1.5',
                  marginBottom: 10
                }}>
                  <span>⚠️</span>
                  <div>
                    <strong>Bạn không thể tự phê duyệt hồ sơ của chính mình.</strong>
                    <br />
                    Vui lòng liên hệ Admin để phê duyệt minh chứng này.
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvidenceReviewDetailPage
