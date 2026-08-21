import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import { AUTH_ROLE, hasAnyRole } from '../../auth/utils/authNavigation.js'
import { DownloadOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import '../styles/TrainingEmployeeStatusListPage.css'

const EXPORT_PAGE_SIZE = 100
const COMPLIANCE_STATUSES = new Set(['COMPLIANT', 'NON_COMPLIANT'])

function responseData(response) {
  return response?.data?.data || {}
}

function normalizeEmployee(item) {
  const submittedHours = Number(item.submittedHours) || 0
  const requiredHours = Number(item.requiredHours) || 0
  const isCompliant = item.complianceStatus === 'COMPLIANT' || (requiredHours > 0 && submittedHours >= requiredHours)
  return {
    employeeId: String(item.employeeId),
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    departmentName: item.departmentName || 'Chưa xác định',
    jobPositionName: item.jobPositionName || 'Chưa xác định',
    submittedHours,
    requiredHours,
    progressPercentage: Number(item.progressPercentage) || 0,
    complianceStatus: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
  }
}

function getComplianceParams(complianceFilter) {
  if (!complianceFilter) return {}
  return { compliant: complianceFilter === 'COMPLIANT' }
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function downloadEmployeeTrainingCsv(rows) {
  const statusLabels = {
    COMPLIANT: 'Đạt',
    NON_COMPLIANT: 'Chưa đạt',
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
  const [departmentId, setDepartmentId] = useState(() => searchParams.get('departmentId') || '')
  const [professionalFieldId, setProfessionalFieldId] = useState(() => searchParams.get('professionalFieldId') || '')
  const [complianceStatus, setComplianceStatus] = useState(() => {
    if (searchParams.get('compliant') === 'true') return 'COMPLIANT'
    if (searchParams.get('compliant') === 'false') return 'NON_COMPLIANT'
    const requestedStatus = searchParams.get('complianceStatus') || ''
    if (COMPLIANCE_STATUSES.has(requestedStatus)) return requestedStatus
    return requestedStatus ? 'NON_COMPLIANT' : ''
  })

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    keyword: searchParams.get('keyword') || '',
    departmentId: searchParams.get('departmentId') || '',
    professionalFieldId: searchParams.get('professionalFieldId') || '',
    complianceStatus: searchParams.get('compliant') === 'true'
      ? 'COMPLIANT'
      : searchParams.get('compliant') === 'false' ? 'NON_COMPLIANT' : '',
  }))

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
        keyword: appliedFilters.keyword || undefined,
        departmentId: appliedFilters.departmentId || undefined,
        professionalFieldId: appliedFilters.professionalFieldId || undefined,
        ...getComplianceParams(appliedFilters.complianceStatus),
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
  }, [page, appliedFilters])

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const rows = await fetchAllEmployeeStatuses({
        keyword: appliedFilters.keyword || undefined,
        departmentId: appliedFilters.departmentId || undefined,
        professionalFieldId: appliedFilters.professionalFieldId || undefined,
        ...getComplianceParams(appliedFilters.complianceStatus),
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

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ keyword: keyword.trim(), departmentId, professionalFieldId, complianceStatus })
  }

  const resetFilters = () => {
    setKeyword('')
    setDepartmentId('')
    setProfessionalFieldId('')
    setComplianceStatus('')
    setPage(1)
    setAppliedFilters({ keyword: '', departmentId: '', professionalFieldId: '', complianceStatus: '' })
  }

  return (
    <AppShell breadcrumbs={breadcrumbs}>
            <div className="tes-page">

              <div className="tes-title-card">
                <h1 className="tes-title">Giờ đào tạo nhân viên</h1>
                <p className="tes-subtitle">Danh sách nhân viên và tiến độ giờ đào tạo</p>
              </div>

              <AppliedFilterToolbar
                activeCount={[departmentId, professionalFieldId, complianceStatus].filter(Boolean).length}
                actions={<div className="tes-toolbar-actions">
                    <div className="tes-total-label">{totalElements} nhân viên</div>
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
                  </div>}
                className="tes-filter-bar"
                isOpen={isFilterOpen}
                onApply={applyFilters}
                onReset={resetFilters}
                onSearchChange={setKeyword}
                onToggle={() => setIsFilterOpen((current) => !current)}
                panelClassName="tes-filter-panel"
                panelId="training-employee-filter-panel"
                searchAriaLabel="Tìm nhân viên theo tên hoặc mã"
                searchClassName="tes-search"
                searchPlaceholder="Tìm theo tên/mã nhân viên..."
                searchValue={keyword}
              >
                <FilterSelectField
                  ariaLabel="Khoa/phòng"
                  className="tes-department-filter"
                  label="Khoa/phòng"
                  onChange={setDepartmentId}
                  options={[
                    { value: '', label: 'Tất cả khoa/phòng' },
                    ...departments.map((department) => ({
                      value: department.id,
                      label: department.name,
                      searchText: department.code,
                    })),
                  ]}
                  placeholder="Tất cả khoa/phòng"
                  searchPlaceholder="Gõ tên khoa/phòng..."
                  value={departmentId}
                />
                {professionalFields.length > 0 && (
                  <FilterSelectField
                    ariaLabel="Lĩnh vực chuyên môn"
                    className="tes-field-filter"
                    label="Lĩnh vực chuyên môn"
                    onChange={setProfessionalFieldId}
                    options={[
                      { value: '', label: 'Tất cả lĩnh vực' },
                      ...professionalFields.map((field) => ({
                        value: field.id,
                        label: field.name,
                        searchText: field.code,
                      })),
                    ]}
                    placeholder="Tất cả lĩnh vực"
                    searchPlaceholder="Gõ tên lĩnh vực..."
                    value={professionalFieldId}
                  />
                )}
                <FilterSelectField
                  ariaLabel="Trạng thái"
                  className="tes-filter-field"
                  label="Trạng thái"
                  onChange={setComplianceStatus}
                  options={[
                    { value: '', label: 'Tất cả trạng thái' },
                    { value: 'COMPLIANT', label: 'Đạt' },
                    { value: 'NON_COMPLIANT', label: 'Chưa đạt' },
                  ]}
                  placeholder="Tất cả trạng thái"
                  searchable={false}
                  value={complianceStatus}
                />
              </AppliedFilterToolbar>

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
                    <table className="tes-table admin-table-uppercase">
                      <thead>
                        <tr>
                          <th>Mã NV</th>
                          <th>Họ và tên</th>
                          <th>Khoa/Phòng</th>
                          <th className="tes-col-progress">Tiến độ</th>
                          <th>Trạng thái</th>
                          <th className="tes-col-action">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((item, idx) => {
                          const cfg = statusCfg[item.complianceStatus] || statusCfg.NON_COMPLIANT
                          const pct = progressPct(item.submittedHours, item.requiredHours)
                          return (
                            <tr key={item.employeeId + '-' + idx}>
                              <td className="tes-td-code">{item.employeeCode}</td>
                              <td>{item.employeeName}</td>
                              <td>{item.departmentName}</td>
                              <td className="tes-col-progress">
                                <div className="tes-progress-cell">
                                  <span className="tes-progress-label">{item.submittedHours}/{item.requiredHours}h</span>
                                  <div className="tes-progress-track">
                                    <div
                                      className={`tes-progress-fill ${cfg.barClass}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`tes-badge ${cfg.cls}`}>{cfg.label}</span>
                              </td>
                              <td className="tes-col-action">
                                <Link
                                  aria-label={`Xem chi tiết giờ đào tạo của ${item.employeeName}`}
                                  className="tes-btn-detail admin-table-action admin-table-action--icon admin-table-action--primary"
                                  title="Xem chi tiết"
                                  to={`/training/employees/${item.employeeId}`}
                                >
                                  <EyeOutlined />
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
    </AppShell>
  )
}

export default TrainingEmployeeStatusListPage
