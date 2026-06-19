import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { MOCK_LOGS } from '../api/mockLogs'
import { ArrowLeftOutlined } from '@ant-design/icons'
import '../styles/SystemLogs.css'

function SystemLogDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()

  const log = useMemo(() => {
    return MOCK_LOGS.find(l => l.id === parseInt(id))
  }, [id])

  const breadcrumbs = [
    { label: 'System logs', link: '/admin/system-logs' },
    { label: 'Chi tiết log' }
  ]

  // Get action class for styling the tag pill
  const getActionClass = (actionName) => {
    if (!actionName) return 'other'
    if (actionName.includes('Chỉnh sửa') || actionName.includes('Đổi mật khẩu')) return 'edit'
    if (actionName.includes('Đăng nhập') || actionName.includes('Đăng xuất')) return 'login'
    if (actionName.includes('Cấu hình')) return 'config'
    if (actionName.includes('Upload')) return 'upload'
    return 'other'
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            
            <div className="log-page">
              
              {/* Log Detail Card */}
              <div className="log-detail-card">
                <div style={{ marginBottom: 32 }}>
                  <h1 className="log-title">Chi tiết log</h1>
                  <p className="log-subtitle">Chi tiết đầy đủ của một dòng nhật ký kiểm toán duy nhất.</p>
                </div>

                {log ? (
                  <div className="log-detail-grid">
                    
                    {/* Timestamp */}
                    <div className="log-detail-item">
                      <label className="log-detail-label">Mốc thời gian</label>
                      <div className="log-detail-value-box">{log.timestamp}</div>
                    </div>

                    {/* Action */}
                    <div className="log-detail-item">
                      <label className="log-detail-label">Hành động</label>
                      <div className="log-detail-value-box">
                        <span className={`log-action-pill log-action-pill--${getActionClass(log.action)}`}>
                          {log.action}
                        </span>
                      </div>
                    </div>

                    {/* Actor */}
                    <div className="log-detail-item">
                      <label className="log-detail-label">Người thực hiện</label>
                      <div className="log-detail-value-box">{log.actor}</div>
                    </div>

                    {/* IP Address */}
                    <div className="log-detail-item">
                      <label className="log-detail-label">Địa chỉ IP</label>
                      <div className="log-detail-value-box">{log.ipAddress}</div>
                    </div>

                    {/* Target */}
                    <div className="log-detail-item">
                      <label className="log-detail-label">Đối tượng bị tác động</label>
                      <div className="log-detail-value-box">{log.target}</div>
                    </div>

                    {/* Change Summary */}
                    <div className="log-detail-item">
                      <label className="log-detail-label">Tóm tắt thay đổi</label>
                      <div className="log-detail-value-box">{log.summary}</div>
                    </div>

                  </div>
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>
                    Lỗi: Không tìm thấy nhật ký kiểm toán tương ứng với ID này.
                  </div>
                )}

                {/* Back Navigation Bar */}
                <div className="log-back-bar">
                  <button className="log-btn-back" onClick={() => navigate('/admin/system-logs')}>
                    <ArrowLeftOutlined /> Quay lại
                  </button>
                </div>

              </div>
              
            </div>

          </main>
        </div>
      </div>
    </div>
  )
}

export default SystemLogDetailScreen
