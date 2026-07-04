import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import { AUTH_ROLE, hasAnyRole } from '../../auth/utils/authNavigation.js'
import { ClockCircleOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusDetailPage.css'

function TrainingEmployeeStatusDetailPage() {
  const { employeeId } = useParams()
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [employeeInfo, setEmployeeInfo] = useState({
    employeeName: '',
    employeeCode: '',
    approvedHours: 0,
    requiredHours: 120,
    pendingHours: 0,
    totalHours: 0,
    complianceStatus: 'NON_COMPLIANT'
  })

  const [recordsList, setRecordsList] = useState([])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [statusResponse, recordsResponse] = await Promise.all([
          trainingApi.getEmployeeTrainingStatus(employeeId, {}),
          trainingApi.getEmployeeTrainingRecords(employeeId, { size: 50 })
        ])

        const statusData = statusResponse.data?.data
        const recordsData = recordsResponse.data?.data?.content

        if (statusData) {
          setEmployeeInfo({
            employeeName: statusData.employeeName || '---',
            employeeCode: statusData.employeeCode || '---',
            approvedHours: statusData.approvedHours || 0,
            requiredHours: statusData.requiredHours || 120,
            pendingHours: statusData.pendingHours || 0,
            totalHours: (statusData.approvedHours || 0) + (statusData.pendingHours || 0),
            complianceStatus: statusData.complianceStatus || 'NON_COMPLIANT'
          })
        }

        if (recordsData) {
          const mappedRecords = recordsData.map(item => ({
            id: item.id,
            title: item.title,
            hours: item.approvedHours || item.declaredHours || 0,
            date: item.startDate || '---',
            workflowStatus: item.workflowStatus,
            evidenceUrl: item.evidenceCount > 0 ? `/training/records/${item.id}/evidence` : null
          }))
          setRecordsList(mappedRecords)
        }
      } catch (err) {
        console.error('API fetch error in employee training status details:', err)
        setError("Không thể tải chi tiết đào tạo nhân viên.")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [employeeId])

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Giờ đào tạo nhân viên', link: '/training/employees' },
    { label: 'Chi tiết đào tạo nhân viên' }
  ]

  return (
    <div className="dashboard-layout">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <div className="dashboard-layout__content">
        {isAdmin ? <AdminHeader breadcrumbs={breadcrumbs} /> : <Header breadcrumbs={breadcrumbs} />}
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ted-page">
              
              {/* Title Card */}
              <div className="ted-title-card">
                <h1 className="ted-title">Chi tiết đào tạo nhân viên</h1>
                <p className="ted-subtitle">
                  Hồ sơ đào tạo CME chi tiết của nhân sự
                </p>
              </div>

              {/* Detail Card Container */}
              <div className="ted-detail-card">
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải dữ liệu...
                  </div>
                ) : error ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
                    {error}
                  </div>
                ) : (
                  <>
                    {/* Profile Banner */}
                    <div className="ted-profile-banner">
                      <div className="ted-profile-left">
                        <div className="ted-profile-avatar" style={{ background: '#3b82f6', color: '#fff', fontSize: 20, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                          {(employeeInfo.employeeName || 'NV')[0].toUpperCase()}
                        </div>
                        <h2 className="ted-profile-name">{employeeInfo.employeeName} ({employeeInfo.employeeCode})</h2>
                      </div>
                      <div className={`ted-profile-badge ${
                        employeeInfo.complianceStatus === 'COMPLIANT' 
                          ? 'ted-profile-badge--compliant' 
                          : ''
                      }`}>
                        {employeeInfo.totalHours}/{employeeInfo.requiredHours}h - {
                          employeeInfo.complianceStatus === 'COMPLIANT' ? 'Đạt' : 'Không đạt'
                        }
                      </div>
                    </div>

                    {/* Training Summary */}
                    <div style={{ marginTop: 24 }}>
                      <h3 className="ted-section-title">TỔNG HỢP GIỜ ĐÀO TẠO</h3>
                      <div className="ted-summary-grid">
                        
                        {/* Card 1: Total */}
                        <div className="ted-summary-card ted-summary-card--total">
                          <div className="ted-card-icon ted-card-icon--total">
                            <ClockCircleOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Tổng (5 năm)</span>
                            <span className="ted-card-value ted-card-value--total">
                              {employeeInfo.totalHours}h
                            </span>
                          </div>
                        </div>

                        {/* Card 2: Approved */}
                        <div className="ted-summary-card ted-summary-card--approved">
                          <div className="ted-card-icon ted-card-icon--approved">
                            <ClockCircleOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Được duyệt</span>
                            <span className="ted-card-value ted-card-value--approved">
                              {employeeInfo.approvedHours}h
                            </span>
                          </div>
                        </div>

                        {/* Card 3: Pending */}
                        <div className="ted-summary-card ted-summary-card--pending">
                          <div className="ted-card-icon ted-card-icon--pending">
                            <ClockCircleOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Đang chờ duyệt</span>
                            <span className="ted-card-value ted-card-value--pending">
                              {employeeInfo.pendingHours}h
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Training Records */}
                    <div style={{ marginTop: 24 }}>
                      <h3 className="ted-section-title">LỊCH SỬ KHAI BÁO CME</h3>
                      <div className="ted-table-wrap">
                        <table className="ted-table">
                          <thead>
                            <tr>
                              <th>Khóa học / Hội thảo</th>
                              <th>Số giờ</th>
                              <th>Ngày bắt đầu</th>
                              <th>Trạng thái</th>
                              <th>Minh chứng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recordsList.length === 0 ? (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                  Không có lịch sử khai báo nào.
                                </td>
                              </tr>
                            ) : (
                              recordsList.map((item, idx) => (
                                <tr key={item.id || idx}>
                                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                                  <td>{item.hours}h</td>
                                  <td>{item.date ? new Date(item.date).toLocaleDateString('vi-VN') : '---'}</td>
                                  <td>
                                    <span className={`ted-status-badge ${
                                      item.workflowStatus === 'APPROVED' 
                                        ? 'ted-status-badge--approved' 
                                        : 'ted-status-badge--pending'
                                    }`}>
                                      <span className={`ted-status-dot ${
                                        item.workflowStatus === 'APPROVED' 
                                          ? 'ted-status-dot--approved' 
                                          : 'ted-status-dot--pending'
                                      }`} />
                                      {item.workflowStatus === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}
                                    </span>
                                  </td>
                                  <td>
                                    {item.evidenceUrl ? (
                                      <Link 
                                        to={item.evidenceUrl} 
                                        className="ted-evidence-link ted-evidence-link--green"
                                        title="Xem minh chứng"
                                      >
                                        <FileTextOutlined />
                                      </Link>
                                    ) : (
                                      <span style={{ color: '#cbd5e1' }} title="Không có minh chứng">
                                        <FileTextOutlined />
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default TrainingEmployeeStatusDetailPage
