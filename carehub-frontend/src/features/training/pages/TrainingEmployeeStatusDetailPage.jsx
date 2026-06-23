import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusDetailPage.css'

const MOCK_RECORDS = [
  {
    id: 1,
    title: 'Kỹ thuật vệ sinh tay',
    hours: 8,
    date: '01/06/2026',
    workflowStatus: 'APPROVED',
    evidenceUrl: '#'
  },
  {
    id: 2,
    title: 'Quy trình tiêm tĩnh mạch',
    hours: 9,
    date: '01/06/2026',
    workflowStatus: 'PENDING_REVIEW',
    evidenceUrl: '#'
  },
  {
    id: 3,
    title: 'Thay băng vết thương',
    hours: 7,
    date: '01/06/2026',
    workflowStatus: 'APPROVED',
    evidenceUrl: '#'
  },
  {
    id: 4,
    title: 'An toàn chuyển bệnh nhân',
    hours: 6,
    date: '01/06/2026',
    workflowStatus: 'APPROVED',
    evidenceUrl: '#'
  }
]

function TrainingEmployeeStatusDetailPage() {
  const { employeeId } = useParams()
  const [loading, setLoading] = useState(false)
  const [apiMode, setApiMode] = useState(false)
  
  const [employeeInfo, setEmployeeInfo] = useState({
    employeeName: 'Nguyễn Thị Lan',
    employeeCode: 'VD00368',
    approvedHours: 18,
    requiredHours: 120,
    pendingHours: 12,
    totalHours: 36,
    complianceStatus: 'NON_COMPLIANT'
  })

  const [recordsList, setRecordsList] = useState(MOCK_RECORDS)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [statusResponse, recordsResponse] = await Promise.all([
          trainingApi.getEmployeeTrainingStatus(employeeId, {}),
          trainingApi.getEmployeeTrainingRecords(employeeId, { size: 50 })
        ])

        const statusData = statusResponse.data?.data
        const recordsData = recordsResponse.data?.data?.content

        if (statusData) {
          setEmployeeInfo({
            employeeName: statusData.employeeName || 'Nguyễn Thị Lan',
            employeeCode: statusData.employeeCode || 'VD00368',
            approvedHours: statusData.approvedHours || 0,
            requiredHours: statusData.requiredHours || 120,
            pendingHours: statusData.pendingHours || 0,
            totalHours: (statusData.approvedHours || 0) + (statusData.pendingHours || 0),
            complianceStatus: statusData.complianceStatus || 'NON_COMPLIANT'
          })
          setApiMode(true)
        }

        if (recordsData && recordsData.length > 0) {
          const mappedRecords = recordsData.map(item => ({
            id: item.id,
            title: item.title,
            hours: item.approvedHours || item.declaredHours || 0,
            date: item.startDate || '01/06/2026',
            workflowStatus: item.workflowStatus,
            evidenceUrl: item.evidenceCount > 0 ? `/training/records/${item.id}/evidence` : null
          }))
          setRecordsList(mappedRecords)
        }
      } catch (err) {
        console.warn('API fetch error, using mock data:', err)
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
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ted-page">
              
              {/* Title Card */}
              <div className="ted-title-card">
                <h1 className="ted-title">Chi tiết đào tạo nhân viên</h1>
                <p className="ted-subtitle">
                  Full training profile for one employee
                </p>
              </div>

              {/* Detail Card Container */}
              <div className="ted-detail-card">
                
                {/* Profile Banner */}
                <div className="ted-profile-banner">
                  <div className="ted-profile-left">
                    <div className="ted-profile-avatar">
                      <img src="/avatar_lan.png" alt="Avatar" />
                    </div>
                    <h2 className="ted-profile-name">{employeeInfo.employeeName}</h2>
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
                <div>
                  <h3 className="ted-section-title">TRAINNING SUMMARY</h3>
                  <div className="ted-summary-grid">
                    
                    {/* Card 1: Total */}
                    <div className="ted-summary-card ted-summary-card--total">
                      <div className="ted-card-icon ted-card-icon--total">
                        <ClockCircleOutlined />
                      </div>
                      <div className="ted-card-info">
                        <span className="ted-card-label">Tổng(5 năm)</span>
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
                        <span className="ted-card-label">Đang chờ</span>
                        <span className="ted-card-value ted-card-value--pending">
                          {employeeInfo.pendingHours}h
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Training Records */}
                <div>
                  <h3 className="ted-section-title">TRAINNING RECORDS</h3>
                  <div className="ted-table-wrap">
                    <table className="ted-table">
                      <thead>
                        <tr>
                          <th>Trainning</th>
                          <th>Hours</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordsList.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td style={{ fontWeight: 500 }}>{item.title}</td>
                            <td>{item.hours}h</td>
                            <td>{item.date}</td>
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
                                {item.workflowStatus === 'APPROVED' ? 'Duyệt' : 'Chờ'}
                              </span>
                            </td>
                            <td>
                              <Link 
                                to={item.evidenceUrl || '#'} 
                                className={`ted-evidence-link ${
                                  item.workflowStatus === 'APPROVED' 
                                    ? 'ted-evidence-link--green' 
                                    : 'ted-evidence-link--red'
                                }`}
                              >
                                <FileTextOutlined />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default TrainingEmployeeStatusDetailPage
