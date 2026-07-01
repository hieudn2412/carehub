import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import AdminSidebar from '../../../admin/components/AdminSidebar'
import AdminHeader from '../../../admin/components/AdminHeader'
import { tokenStorage } from '../../../auth/services/tokenStorage.js'
import { AUTH_ROLE, hasAnyRole } from '../../../auth/utils/authNavigation.js'
import { getRolesFromAccessToken } from '../../../auth/utils/jwt.js'
import { trainingApi } from '../../../training/api/trainingApi'
import '../../styles/ManagerPages.css'

function ManagerEvidenceReviewListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [evidences, setEvidences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])

  useEffect(() => {
    trainingApi.getPendingRecords({ size: 100 })
      .then(res => {
        setEvidences(res.data?.data?.content || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching pending records", err)
        setError("Không thể tải danh sách minh chứng chờ duyệt.")
        setLoading(false)
      })
  }, [])

  const filteredEvidences = evidences.filter(ev => 
    (ev.employeeName || '').toLowerCase().includes(search.toLowerCase()) ||
    (ev.employeeCode || '').toLowerCase().includes(search.toLowerCase()) ||
    (ev.title || '').toLowerCase().includes(search.toLowerCase())
  )

  const breadcrumbs = [
    { label: 'Đào tạo' },
    { label: 'Duyệt minh chứng' }
  ]

  return (
    <div className="dashboard-layout">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <div className="dashboard-layout__content">
        {isAdmin ? <AdminHeader breadcrumbs={breadcrumbs} /> : <Header title="Duyệt minh chứng" />}
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Duyệt minh chứng</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Xem xét và phê duyệt các tệp chứng chỉ/minh chứng CME do điều dưỡng tự khai báo
            </p>
          </div>

          {/* Toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm theo tên nhân viên, tên khóa học..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
          </div>

          {/* List Card */}
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải danh sách...
              </div>
            ) : error ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
                {error}
              </div>
            ) : filteredEvidences.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Không có minh chứng nào đang chờ phê duyệt.
              </div>
            ) : (
              <table className="mgr-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Tên khóa đào tạo / Hội thảo</th>
                    <th>Số giờ khai báo</th>
                    <th>Ngày nộp</th>
                    <th>Tài liệu minh chứng</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvidences.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{ev.employeeName}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>{ev.employeeCode}</div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{ev.title}</td>
                      <td><strong style={{ color: '#2563eb' }}>{ev.declaredHours}h</strong></td>
                      <td style={{ color: '#475569' }}>
                        {ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString('vi-VN') : '---'}
                      </td>
                      <td style={{ color: '#64748b', fontSize: 12.5 }}>
                        {ev.evidences && ev.evidences.length > 0 ? (
                          <span style={{ color: '#16a34a', fontWeight: 500 }}>
                            📄 {ev.evidences.length} tệp đính kèm
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Chưa đính kèm file</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => navigate(isAdmin ? `/admin/training/evidence-review/${ev.id}` : `/manager/evidence-review/${ev.id}`)}
                          style={{
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: '#475569',
                            transition: 'all 0.15s'
                          }}
                          title="Xem chi tiết & Phê duyệt"
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#fff'; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#475569'; }}
                        >
                          <EyeOutlined />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvidenceReviewListPage
