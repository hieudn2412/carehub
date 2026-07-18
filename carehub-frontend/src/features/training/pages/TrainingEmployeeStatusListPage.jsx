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
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusListPage.css'

function TrainingEmployeeStatusListPage() {
  const [roles, setRoles] = useState([])

  useEffect(() => {
    const accessToken = tokenStorage.getAccessToken()
    if (accessToken) setRoles(getRolesFromAccessToken(accessToken))
  }, [])

  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [complianceStatus, setComplianceStatus] = useState('')

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedKeyword(keyword), 400)
    return () => clearTimeout(handler)
  }, [keyword])

  useEffect(() => setPage(1), [debouncedKeyword, departmentId, complianceStatus])

  useEffect(() => {
    trainingApi.getDepartments()
      .then(res => { if (res.data?.success) setDepartments(res.data.data || []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {
      page: page - 1,
      size: 10,
      keyword: debouncedKeyword.trim() || undefined,
      departmentId: departmentId || undefined,
      complianceStatus: complianceStatus || undefined,
    }
    trainingApi.getEmployeeTrainingStatuses(params)
      .then(res => {
        if (res.data?.success) {
          const pd = res.data.data
          setEmployees((pd?.content || []).map(item => ({
            employeeId: String(item.employeeId),
            employeeCode: item.employeeCode,
            employeeName: item.employeeName,
            departmentName: item.departmentName || 'Chưa xác định',
            submittedHours: item.submittedHours || 0,
            requiredHours: item.requiredHours ?? 0,
            complianceStatus: item.complianceStatus,
          })))
          setTotalElements(pd?.totalElements || 0)
          setTotalPages(pd?.totalPages || 1)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, debouncedKeyword, departmentId, complianceStatus])

  const progressPct = (submitted, required) =>
    required > 0 ? Math.min(Math.round((submitted / required) * 100), 100) : 0

  const statusCfg = {
    COMPLIANT: { label: 'Đạt', cls: 'tes-badge--compliant', barClass: 'tes-progress--compliant' },
    NON_COMPLIANT: { label: 'Không đạt', cls: 'tes-badge--non-compliant', barClass: 'tes-progress--non-compliant' },
    AT_RISK: { label: 'Đang theo dõi', cls: 'tes-badge--at-risk', barClass: 'tes-progress--at-risk' },
    NOT_CONFIGURED: { label: 'Chưa áp dụng', cls: 'tes-badge--not-configured', barClass: '' },
  }

  const getVisiblePages = () => {
    const pages = []
    const range = 1
    pages.push(1)
    if (page - range > 2) pages.push('...')
    for (let i = Math.max(2, page - range); i <= Math.min(totalPages - 1, page + range); i++) pages.push(i)
    if (page + range < totalPages - 1) pages.push('...')
    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages)
    return pages
  }

  const breadcrumbs = [{ label: 'Quản lý chất lượng' }, { label: 'Giờ đào tạo nhân viên' }]

  return (
    <div className="dashboard-layout">
      {isAdmin ? <AdminSidebar /> : <Sidebar />}
      <div className="dashboard-layout__content">
        {isAdmin ? <AdminHeader breadcrumbs={breadcrumbs} /> : <Header breadcrumbs={breadcrumbs} />}
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="tes-page">

              <div className="tes-title-card">
                <h1 className="tes-title">Giờ đào tạo nhân viên</h1>
                <p className="tes-subtitle">Danh sách nhân viên và tiến độ giờ đào tạo</p>
              </div>

              <div className="tes-filter-bar">
                <div className="tes-search">
                  <SearchOutlined className="tes-search-icon" />
                  <input
                    type="text"
                    className="tes-search-input"
                    placeholder="Tìm theo tên/mã nhân viên..."
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                  />
                </div>
                <select className="tes-filter-select" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                  <option value="">Tất cả khoa/phòng</option>
                  {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
                <select className="tes-filter-select" value={complianceStatus} onChange={e => setComplianceStatus(e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="COMPLIANT">Đạt</option>
                  <option value="NON_COMPLIANT">Không đạt</option>
                  <option value="AT_RISK">Đang theo dõi</option>
                  <option value="NOT_CONFIGURED">Chưa thiết lập</option>
                </select>
                <div className="tes-total-label">
                  {totalElements} nhân viên
                </div>
              </div>

              <div className="tes-table-card">
                {loading ? (
                  <div className="tes-table-state">Đang tải dữ liệu...</div>
                ) : employees.length === 0 ? (
                  <div className="tes-table-state">
                    <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#374151' }}>Không tìm thấy kết quả</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm.</p>
                  </div>
                ) : (
                  <>
                    <table className="tes-table">
                      <thead>
                        <tr>
                          <th>Mã NV</th>
                          <th>Họ và tên</th>
                          <th>Khoa/Phòng</th>
                          <th className="tes-col-progress">Tiến độ</th>
                          <th>Trạng thái</th>
                          <th className="tes-col-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((item, idx) => {
                          const cfg = statusCfg[item.complianceStatus] || statusCfg.NOT_CONFIGURED
                          const pct = item.complianceStatus === 'NOT_CONFIGURED'
                            ? 0
                            : progressPct(item.submittedHours, item.requiredHours)
                          return (
                            <tr key={item.employeeId + '-' + idx}>
                              <td className="tes-td-code">{item.employeeCode}</td>
                              <td>{item.employeeName}</td>
                              <td>{item.departmentName}</td>
                              <td className="tes-col-progress">
                                {item.complianceStatus === 'NOT_CONFIGURED' ? (
                                  <span className="tes-progress-none">—</span>
                                ) : (
                                  <div className="tes-progress-cell">
                                    <span className="tes-progress-label">{item.submittedHours}/{item.requiredHours}h</span>
                                    <div className="tes-progress-track">
                                      <div
                                        className={`tes-progress-fill ${cfg.barClass}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`tes-badge ${cfg.cls}`}>{cfg.label}</span>
                              </td>
                              <td className="tes-col-action">
                                <Link to={`/training/employees/${item.employeeId}`} className="tes-btn-detail">
                                  <EyeOutlined /> Chi tiết
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div className="tes-pagination-bar">
                      <div className="tes-pagination-info">
                        Hiển thị {employees.length} / {totalElements} kết quả
                      </div>
                      <div className="tes-pagination-buttons">
                        <button className="tes-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                          &lt;
                        </button>
                        {getVisiblePages().map((n, idx) =>
                          n === '...' ? (
                            <span key={`dots-${idx}`} className="tes-page-btn tes-page-btn--dots">...</span>
                          ) : (
                            <button
                              key={n}
                              className={`tes-page-btn ${n === page ? 'tes-page-btn--active' : ''}`}
                              onClick={() => setPage(n)}
                            >
                              {n}
                            </button>
                          )
                        )}
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
