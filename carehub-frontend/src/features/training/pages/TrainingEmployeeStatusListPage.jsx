import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import { AUTH_ROLE, hasAnyRole } from '../../auth/utils/authNavigation.js'
import { DownloadOutlined, EyeOutlined, LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import '../styles/TrainingEmployeeStatusListPage.css'

const EXPORT_PAGE_SIZE = 100
const COMPLIANCE_STATUSES = new Set(['COMPLIANT', 'NEEDS_ATTENTION', 'NON_COMPLIANT', 'AT_RISK', 'NOT_CONFIGURED'])

function responseData(response) {
  return response?.data?.data || {}
}

function normalizeEmployee(item) {
  return {
    employeeId: String(item.employeeId),
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    departmentName: item.departmentName || 'Chưa xác định',
    jobPositionName: item.jobPositionName || 'Chưa xác định',
    submittedHours: Number(item.submittedHours) || 0,
    requiredHours: Number(item.requiredHours) || 0,
    progressPercentage: Number(item.progressPercentage) || 0,
    complianceStatus: item.complianceStatus,
  }
}

function getComplianceParams(complianceFilter) {
  return complianceFilter === 'NEEDS_ATTENTION'
    ? { compliant: false }
    : { complianceStatus: complianceFilter || undefined }
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function downloadEmployeeTrainingCsv(rows) {
  const statusLabels = {
    COMPLIANT: 'Đạt',
    NON_COMPLIANT: 'Chưa đạt',
    AT_RISK: 'Đang theo dõi',
    NOT_CONFIGURED: 'Chưa áp dụng',
  }
  const csvRows = [
    ['Mã NV', 'Họ và tên', 'Khoa/Phòng', 'Chức danh', 'Giờ yêu cầu', 'Giờ đã nộp', 'Tiến độ', 'Trạng thái']
      .map(csvCell)
      .join(','),
    ...rows.map((item) => [
      item.employeeCode,
      item.employeeName,
      item.departmentName,
      item.jobPositionName,
      item.requiredHours,
      item.submittedHours,
      `${item.progressPercentage}%`,
      statusLabels[item.complianceStatus] || item.complianceStatus,
    ].map(csvCell).join(',')),
  ]
  const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `gio-dao-tao-nhan-vien-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function fetchAllEmployeeStatuses(params) {
  const firstResponse = await trainingApi.getEmployeeTrainingStatuses({
    ...params,
    page: 0,
    size: EXPORT_PAGE_SIZE,
  })
  const firstPage = responseData(firstResponse)
  const totalPages = Math.max(1, Number(firstPage.totalPages) || 1)
  if (totalPages === 1) return firstPage.content || []

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      trainingApi.getEmployeeTrainingStatuses({
        ...params,
        page: index + 1,
        size: EXPORT_PAGE_SIZE,
      })
    )),
  )

  return [
    ...(firstPage.content || []),
    ...remainingResponses.flatMap((response) => responseData(response).content || []),
  ]
}

function TrainingEmployeeStatusListPage() {
  const [searchParams] = useSearchParams()
  const [roles] = useState(() => {
    const accessToken = tokenStorage.getAccessToken()
    return accessToken ? getRolesFromAccessToken(accessToken) : []
  })

  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])

  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') || '')
  const [debouncedKeyword, setDebouncedKeyword] = useState(() => searchParams.get('keyword') || '')
  const [departmentId, setDepartmentId] = useState(() => searchParams.get('departmentId') || '')
  const [professionalFieldId, setProfessionalFieldId] = useState(() => searchParams.get('professionalFieldId') || '')
  const [complianceStatus, setComplianceStatus] = useState(() => {
    if (searchParams.get('compliant') === 'false') return 'NEEDS_ATTENTION'
    const requestedStatus = searchParams.get('complianceStatus') || ''
    return COMPLIANCE_STATUSES.has(requestedStatus) ? requestedStatus : ''
  })

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(keyword)
      setPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [keyword])

  useEffect(() => {
    Promise.allSettled([
      trainingApi.getDepartments(),
      trainingApi.getRecordOptions(),
    ]).then(([departmentResult, optionResult]) => {
      if (departmentResult.status === 'fulfilled' && departmentResult.value.data?.success) {
        setDepartments(departmentResult.value.data.data || [])
      }
      if (optionResult.status === 'fulfilled') {
        setProfessionalFields(responseData(optionResult.value).professionalFields || [])
      }
    })
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      const params = {
        page: page - 1,
        size: 10,
        keyword: debouncedKeyword.trim() || undefined,
        departmentId: departmentId || undefined,
        professionalFieldId: professionalFieldId || undefined,
        ...getComplianceParams(complianceStatus),
      }
      trainingApi.getEmployeeTrainingStatuses(params)
        .then(res => {
          if (active && res.data?.success) {
            const pd = res.data.data
            setEmployees((pd?.content || []).map(normalizeEmployee))
            setTotalElements(pd?.totalElements || 0)
            setTotalPages(pd?.totalPages || 1)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [page, debouncedKeyword, departmentId, professionalFieldId, complianceStatus])

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const rows = await fetchAllEmployeeStatuses({
        keyword: debouncedKeyword.trim() || undefined,
        departmentId: departmentId || undefined,
        professionalFieldId: professionalFieldId || undefined,
        ...getComplianceParams(complianceStatus),
      })
      downloadEmployeeTrainingCsv(rows.map(normalizeEmployee))
    } catch {
      setExportError('Không thể xuất dữ liệu theo bộ lọc hiện tại. Vui lòng thử lại.')
    } finally {
      setExporting(false)
    }
  }

  const progressPct = (submitted, required) =>
    required > 0 ? Math.min(Math.round((submitted / required) * 100), 100) : 0

  const statusCfg = {
    COMPLIANT: { label: 'Đạt', cls: 'tes-badge--compliant', barClass: 'tes-progress--compliant' },
    NON_COMPLIANT: { label: 'Chưa đạt', cls: 'tes-badge--non-compliant', barClass: 'tes-progress--non-compliant' },
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
                <div className="tes-department-filter">
                  <SearchableSelect
                    value={departmentId}
                    onChange={(value) => {
                      setDepartmentId(value)
                      setPage(1)
                    }}
                    options={[
                      { value: '', label: 'Tất cả khoa/phòng' },
                      ...departments.map((department) => ({ value: department.id, label: department.name })),
                    ]}
                    placeholder="Tất cả khoa/phòng"
                    searchPlaceholder="Tìm tên khoa/phòng..."
                    ariaLabel="Tìm và chọn khoa/phòng"
                  />
                </div>
                {professionalFields.length > 0 && (
                  <div className="tes-field-filter">
                    <SearchableSelect
                      value={professionalFieldId}
                      onChange={(value) => {
                        setProfessionalFieldId(value)
                        setPage(1)
                      }}
                      options={[
                        { value: '', label: 'Tất cả lĩnh vực' },
                        ...professionalFields.map((field) => ({ value: field.id, label: field.name })),
                      ]}
                      placeholder="Tất cả lĩnh vực"
                      searchPlaceholder="Tìm tên lĩnh vực..."
                      ariaLabel="Tìm và chọn lĩnh vực chuyên môn"
                    />
                  </div>
                )}
                <select className="tes-filter-select" value={complianceStatus} onChange={e => {
                  setComplianceStatus(e.target.value)
                  setPage(1)
                }}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="COMPLIANT">Đạt</option>
                  <option value="NEEDS_ATTENTION">Chưa đạt / cần chú ý</option>
                  <option value="NON_COMPLIANT">Chưa đạt</option>
                  <option value="AT_RISK">Đang theo dõi</option>
                  <option value="NOT_CONFIGURED">Chưa thiết lập</option>
                </select>
                <div className="tes-total-label">
                  {totalElements} nhân viên
                </div>
                {isAdmin && (
                  <button
                    className="tes-export-button"
                    disabled={exporting || loading || totalElements === 0}
                    onClick={handleExport}
                    type="button"
                  >
                    {exporting ? <LoadingOutlined spin /> : <DownloadOutlined />}
                    {exporting ? 'Đang xuất...' : 'Xuất kết quả'}
                  </button>
                )}
              </div>

              {exportError && <div className="tes-export-error" role="alert">{exportError}</div>}

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
