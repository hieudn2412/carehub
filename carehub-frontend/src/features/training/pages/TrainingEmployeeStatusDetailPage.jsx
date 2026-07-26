import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import {
  ClockCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusDetailPage.css'

function TrainingEmployeeStatusDetailPage() {
  const { employeeId } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [employeeInfo, setEmployeeInfo] = useState({
    employeeName: '',
    employeeCode: '',
    submittedHours: 0,
    requiredHours: 120,
    complianceStatus: 'NON_COMPLIANT'
  })

  const [recordsList, setRecordsList] = useState([])
  const [page, setPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 10

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [statusResponse, recordsResponse] = await Promise.all([
          trainingApi.getEmployeeTrainingStatus(employeeId, {}),
          trainingApi.getEmployeeTrainingRecords(employeeId, { page, size: pageSize })
        ])

        const statusData = statusResponse.data?.data
        const recordsPage = recordsResponse.data?.data
        const recordsData = recordsPage?.content

        if (statusData) {
          setEmployeeInfo({
            employeeName: statusData.employeeName || '---',
            employeeCode: statusData.employeeCode || '---',
            submittedHours: statusData.submittedHours || 0,
            requiredHours: statusData.requiredHours ?? 0,
            complianceStatus: statusData.status === 'COMPLIANT' ? 'COMPLIANT' : 'NON_COMPLIANT'
          })
        }

        if (recordsData) {
          const mappedRecords = recordsData.map(item => ({
            id: item.id,
            title: item.title,
            hours: item.declaredHours || 0,
            date: item.startDate || '---',
            validUntil: item.validUntil,
            expired: Boolean(item.expired),
            workflowStatus: item.workflowStatus,
            evidenceUrl: item.evidenceCount > 0 ? `/training/records/${item.id}#evidence` : null
          }))
          setRecordsList(mappedRecords)
        }
        setTotalElements(recordsPage?.totalElements || 0)
        setTotalPages(recordsPage?.totalPages || 0)
      } catch (err) {
        console.error('API fetch error in employee training status details:', err)
        setError("Không thể tải chi tiết đào tạo nhân viên.")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [employeeId, page])

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Giờ đào tạo nhân viên', link: '/training/employees' },
    { label: 'Chi tiết đào tạo nhân viên' }
  ]

  return (
    <AppShell back={{ to: '/training/employees', label: 'Quay lại' }} breadcrumbs={breadcrumbs}>
            <div className="ted-page">
              
              {/* Title Card */}
              <div className="ted-title-card">
                <h1 className="ted-title">Chi tiết đào tạo nhân viên</h1>
                <p className="ted-subtitle">
                  Lịch sử khai báo và tiến độ giờ đào tạo
                </p>
              </div>

              {/* Detail Card Container */}
              <div className="ted-detail-card">
                {loading ? (
                  <LoadingState label="Đang tải dữ liệu..." />
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
                        {`${employeeInfo.submittedHours}/${employeeInfo.requiredHours}h - ${employeeInfo.complianceStatus === 'COMPLIANT' ? 'Đạt' : 'Chưa đạt'}`}
                      </div>
                    </div>

                    {/* Training Summary */}
                    <div style={{ marginTop: 24 }}>
                      <h3 className="ted-section-title">TỔNG HỢP GIỜ ĐÀO TẠO</h3>
                      <div className="ted-summary-grid">

                        {/* Card: Submitted Hours */}
                        <div className="ted-summary-card ted-summary-card--total">
                          <div className="ted-card-icon ted-card-icon--total">
                            <ClockCircleOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Số giờ đã nộp</span>
                            <span className="ted-card-value ted-card-value--total">
                              {employeeInfo.submittedHours}h
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Training Records */}
                    <div style={{ marginTop: 24 }}>
                      <h3 className="ted-section-title">LỊCH SỬ KHAI BÁO GIỜ ĐÀO TẠO</h3>
                      <div className="ted-table-wrap">
                        <table className="ted-table">
                          <thead>
                            <tr>
                              <th>Khóa học / Hội thảo</th>
                              <th>Số giờ</th>
                              <th>Ngày bắt đầu</th>
                              <th>Trạng thái</th>
                              <th>Xem</th>
                              <th>Minh chứng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recordsList.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="ch-empty">
                                  Không có lịch sử khai báo nào.
                                </td>
                              </tr>
                            ) : (
                              recordsList.map((item, idx) => (
                                <tr key={item.id || idx}>
                                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                                  <td>{item.hours}h</td>
                                  <td>
                                    <span className="ted-training-date">
                                      {item.date ? new Date(item.date).toLocaleDateString('vi-VN') : '---'}
                                    </span>
                                    {item.expired && (
                                      <span
                                        className="ted-expired-tag"
                                        title={item.validUntil
                                          ? `Hết hạn từ ${new Date(item.validUntil).toLocaleDateString('vi-VN')}`
                                          : 'Hồ sơ đã hết hạn'}
                                      >
                                        Hết hạn
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`ted-status-badge ${
                                      item.workflowStatus === 'SUBMITTED'
                                        ? 'ted-status-badge--approved'
                                        : 'ted-status-badge--pending'
                                    }`}>
                                      <span className={`ted-status-dot ${
                                        item.workflowStatus === 'SUBMITTED'
                                          ? 'ted-status-dot--approved'
                                          : 'ted-status-dot--pending'
                                      }`} />
                                      {item.workflowStatus === 'SUBMITTED' ? 'Đã nộp' : item.workflowStatus === 'DRAFT' ? 'Bản nháp' : item.workflowStatus === 'CANCELLED' ? 'Đã hủy' : item.workflowStatus}
                                    </span>
                                  </td>
                                  <td>
                                    <Link
                                      to={`/training/records/${item.id}`}
                                      className="ted-evidence-link ted-evidence-link--blue"
                                      title="Xem chi tiết hồ sơ"
                                    >
                                      <EyeOutlined />
                                    </Link>
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
                        {totalElements > 0 && (
                          <div className="ted-pagination">
                            <span>Hiển thị {recordsList.length} / {totalElements} hồ sơ</span>
                            <div className="ted-pagination__controls">
                              <button
                                type="button"
                                onClick={() => setPage(current => Math.max(0, current - 1))}
                                disabled={page === 0}
                                aria-label="Trang trước"
                              >
                                <LeftOutlined />
                              </button>
                              <span>{page + 1} / {Math.max(totalPages, 1)}</span>
                              <button
                                type="button"
                                onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
                                disabled={page >= totalPages - 1}
                                aria-label="Trang sau"
                              >
                                <RightOutlined />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
    </AppShell>
  )
}

export default TrainingEmployeeStatusDetailPage
