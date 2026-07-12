import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import { AUTH_ROLE, hasAnyRole } from '../../auth/utils/authNavigation.js'
import { SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusListPage.css'

function TrainingEmployeeStatusListPage() {
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters State
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [complianceStatus, setComplianceStatus] = useState('')

  // Pagination State
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(keyword)
    }, 400)
    return () => clearTimeout(handler)
  }, [keyword])

  // Fetch departments list for filter
  useEffect(() => {
    async function loadDepts() {
      try {
        const response = await trainingApi.getDepartments()
        if (response.data?.success) {
          setDepartments(response.data.data || [])
        }
      } catch (err) {
        console.error('Error fetching departments:', err)
      }
    }
    loadDepts()
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedKeyword, departmentId, complianceStatus])

  // Fetch training statuses list from server
  const loadData = async () => {
    setLoading(true)
    try {
      const params = {
        page: page - 1, // 0-based in backend
        size: 10,
        keyword: debouncedKeyword.trim() || undefined,
        departmentId: departmentId || undefined,
        complianceStatus: complianceStatus || undefined
      }
      const response = await trainingApi.getEmployeeTrainingStatuses(params)
      if (response.data?.success) {
        const pageData = response.data.data
        const content = pageData?.content || []
        const mapped = content.map(item => ({
          employeeId: String(item.employeeId),
          employeeCode: item.employeeCode,
          employeeName: item.employeeName,
          departmentName: item.departmentName || 'Chưa xác định',
          submittedHours: item.submittedHours || 0,
          requiredHours: item.requiredHours ?? 0,
          complianceStatus: item.complianceStatus
        }))
        setEmployees(mapped)
        setTotalElements(pageData?.totalElements || 0)
        setTotalPages(pageData?.totalPages || 0)
      }
    } catch (err) {
      console.error('API error loading employee training statuses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, debouncedKeyword, departmentId, complianceStatus])

  // Generate pagination buttons array
  const getVisiblePages = () => {
    const pages = []
    const range = 1
    pages.push(1)
    if (page - range > 2) {
      pages.push('...')
    }
    const start = Math.max(2, page - range)
    const end = Math.min(totalPages - 1, page + range)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (page + range < totalPages - 1) {
      pages.push('...')
    }
    if (totalPages > 1) {
      pages.push(totalPages)
    }
    return pages
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Giờ đào tạo nhân viên' }
  ]

  return (
    <div className="dashboard-layout">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <div className="dashboard-layout__content">
        {isAdmin ? <AdminHeader breadcrumbs={breadcrumbs} /> : <Header breadcrumbs={breadcrumbs} />}
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="tes-page">
              
              {/* Title Card */}
              <div className="tes-title-card">
                <h1 className="tes-title">Giờ đào tạo nhân viên</h1>
                <p className="tes-subtitle">
                  Theo dõi và giám sát hồ sơ đào tạo trên toàn khoa/phòng
                </p>
              </div>

              {/* Filter Bar */}
              <div className="tes-filter-bar">
                <div className="tes-search">
                  <span className="tes-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="tes-search-input"
                    placeholder="Tìm theo tên/mã nhân viên.."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>

                <select
                  className="tes-filter-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">Khoa/Phòng</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>

                <select
                  className="tes-filter-select"
                  value={complianceStatus}
                  onChange={(e) => setComplianceStatus(e.target.value)}
                >
                  <option value="">Trạng thái</option>
                  <option value="COMPLIANT">Đạt</option>
                  <option value="NON_COMPLIANT">Không đạt</option>
                  <option value="AT_RISK">Đang theo dõi</option>
                  <option value="NOT_CONFIGURED">Chưa thiết lập</option>
                </select>

                <button 
                  className="tes-btn-export"
                  title="Xuất dữ liệu"
                  onClick={() => alert('Chức năng xuất dữ liệu sẽ được triển khai ở phiên bản sau.')}
                >
                  <DownloadOutlined />
                </button>
              </div>

              {/* Table Card */}
              <div className="tes-table-card">
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Đang tải dữ liệu...
                  </div>
                ) : (
                  <>
                    <table className="tes-table">
                      <thead>
                        <tr>
                          <th>Mã nhân viên</th>
                          <th>Họ và tên</th>
                          <th>Khoa/Phòng</th>
                          <th>Số giờ đã nộp</th>
                          <th>Yêu cầu</th>
                          <th>Trạng thái</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              Không tìm thấy kết quả phù hợp
                            </td>
                          </tr>
                        ) : (
                          employees.map((item, idx) => (
                            <tr key={item.employeeId + '-' + idx}>
                              <td style={{ fontWeight: 500 }}>{item.employeeCode}</td>
                              <td>{item.employeeName}</td>
                              <td>{item.departmentName}</td>
                              <td style={{ fontWeight: 600 }}>{item.submittedHours}h</td>
                              <td style={{ color: '#64748b' }}>
                                {item.complianceStatus === 'NOT_CONFIGURED' ? '—' : `${item.requiredHours}h`}
                              </td>
                              <td>
                                <span className={`tes-badge ${
                                  item.complianceStatus === 'COMPLIANT' 
                                    ? 'tes-badge--compliant' 
                                    : item.complianceStatus === 'NON_COMPLIANT'
                                      ? 'tes-badge--non-compliant' 
                                      : 'tes-badge--at-risk'
                                }`}>
                                  {item.complianceStatus === 'COMPLIANT'
                                    ? 'Đạt'
                                    : item.complianceStatus === 'NON_COMPLIANT'
                                      ? 'Không đạt'
                                      : item.complianceStatus === 'NOT_CONFIGURED'
                                        ? 'Chưa áp dụng'
                                        : 'Đang theo dõi'}
                                </span>
                              </td>
                              <td>
                                <Link 
                                  to={`/training/employees/${item.employeeId}`} 
                                  className="tes-btn-detail"
                                >
                                  <EyeOutlined /> Chi tiết
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination Bar */}
                    <div className="tes-pagination-bar">
                      <div className="tes-pagination-info">
                        Hiển thị {employees.length} trong tổng số {totalElements} kết quả
                      </div>
                      <div className="tes-pagination-buttons">
                        <button 
                          className="tes-page-btn" 
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          &lt;
                        </button>
                        {getVisiblePages().map((n, idx) => {
                          if (n === '...') {
                            return <span key={`dots-${idx}`} className="tes-page-btn tes-page-btn--dots">...</span>
                          }
                          return (
                            <button
                              key={n}
                              className={`tes-page-btn ${n === page ? 'tes-page-btn--active' : ''}`}
                              onClick={() => setPage(n)}
                            >
                              {n}
                            </button>
                          )
                        })}
                        <button 
                          className="tes-page-btn" 
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages || totalPages === 0}
                        >
                          &gt;
                        </button>
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

export default TrainingEmployeeStatusListPage
