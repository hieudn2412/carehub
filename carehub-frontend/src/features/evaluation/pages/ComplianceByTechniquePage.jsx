import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import { downloadCsv, exportFileName } from '../../../shared/utils/tableExport.js'
import '../styles/EvaluationDashboardPage.css'

const today = new Date().toISOString().slice(0, 10)
const yearStart = `${new Date().getFullYear()}-01-01`
const TECHNIQUE_PAGE_SIZE = 100

async function loadAllTechniqueRows(params) {
  const firstResponse = await competencyApi.getByTechnique({
    ...params,
    page: 0,
    size: TECHNIQUE_PAGE_SIZE,
  })
  const firstPage = apiData(firstResponse, null)
  if (!firstPage) return null

  const totalPages = Math.max(1, Number(firstPage.totalPages) || 1)
  if (totalPages === 1) return firstPage

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      competencyApi.getByTechnique({
        ...params,
        page: index + 1,
        size: TECHNIQUE_PAGE_SIZE,
      })
    )),
  )

  return {
    ...firstPage,
    items: [
      ...(firstPage.items || []),
      ...remainingResponses.flatMap((response) => apiData(response, {})?.items || []),
    ],
  }
}

const EXPORT_HEADERS = [
  'Mã NV',
  'Họ và tên',
  'Khoa / Phòng',
  'Tổng số lần được kiểm tra',
  'Số lần đạt',
  'Tỷ lệ tuân thủ (%)',
  'Từ ngày',
  'Đến ngày',
]

function ComplianceByTechniquePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])

  const [departmentId, setDepartmentId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [fromDate, setFromDate] = useState(yearStart)
  const [toDate, setToDate] = useState(today)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState({ departmentId: '', keyword: '', fromDate: yearStart, toDate: today })
  const effectiveDepartmentId = isAdmin ? appliedFilters.departmentId : departmentId
  const effectiveKeyword = appliedFilters.keyword
  const effectiveFromDate = appliedFilters.fromDate
  const effectiveToDate = appliedFilters.toDate

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        if (isAdmin) {
          const response = await adminApi.getDepartments()
          const depts = apiData(response, [])
          setDepartments(depts)
          return
        }

        const response = await staffApi.getProfile()
        const profile = apiData(response, null)
        if (!profile?.departmentId) {
          throw new Error('Manager chưa được gán khoa/phòng')
        }
        setDepartments([{
          id: profile.departmentId,
          name: profile.departmentName || 'Khoa của tôi',
        }])
        setDepartmentId(String(profile.departmentId))
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isAdmin, showToast])

  useEffect(() => {
    const nextKeyword = keyword.trim()
    if (nextKeyword === appliedFilters.keyword) return undefined
    const timer = window.setTimeout(() => {
      setAppliedFilters((current) => (
        current.keyword === nextKeyword ? current : { ...current, keyword: nextKeyword }
      ))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [appliedFilters.keyword, keyword])

  const loadData = useCallback(async () => {
    if (!departmentId && !isAdmin) {
      showToast('Vui lòng chọn khoa/phòng', 'warning')
      return
    }
    setLoading(true)
    try {
      const responseData = await loadAllTechniqueRows({
        departmentId: effectiveDepartmentId || undefined,
        keyword: effectiveKeyword || undefined,
        fromDate: effectiveFromDate || undefined,
        toDate: effectiveToDate || undefined,
      })
      setData(responseData)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [departmentId, effectiveDepartmentId, effectiveFromDate, effectiveKeyword, effectiveToDate, isAdmin, showToast])

  useEffect(() => {
    if (!departmentId && !isAdmin) return undefined
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [departmentId, isAdmin, loadData])

  // `data.items` chính là kết quả của bộ lọc đang áp dụng (backend lọc theo khoa, từ khóa và
  // khoảng ngày), nên file xuất ra luôn khớp đúng những gì đang hiển thị trên bảng.
  const handleExport = () => {
    const rows = (data?.items || []).map((item) => [
      item.employeeCode,
      item.employeeName,
      item.departmentName || data?.departmentName || '',
      item.evaluationCount || 0,
      item.passCount || 0,
      item.passRate != null ? item.passRate : 0,
      effectiveFromDate,
      effectiveToDate,
    ])
    downloadCsv(exportFileName('tuan-thu-chung'), EXPORT_HEADERS, rows)
  }

  const breadcrumbs = [
    { label: 'Giám sát tuân thủ' },
    { label: 'Tuân thủ chung' },
  ]

  const totalCount = Number(data?.totalElements) || data?.items?.length || 0
  const activeFilterCount = [
    effectiveKeyword,
    isAdmin && appliedFilters.departmentId,
    effectiveFromDate && effectiveFromDate !== yearStart,
    effectiveToDate && effectiveToDate !== today,
  ].filter(Boolean).length

  function applyFilters() {
    if (fromDate && toDate && fromDate > toDate) {
      showToast('Từ ngày không được sau đến ngày', 'warning')
      return
    }
    setAppliedFilters({ departmentId, keyword: keyword.trim(), fromDate, toDate })
    setIsFilterOpen(false)
  }

  function resetFilters() {
    setKeyword('')
    setFromDate(yearStart)
    setToDate(today)
    setDepartmentId(isAdmin ? '' : departmentId)
    setAppliedFilters({ departmentId: '', keyword: '', fromDate: yearStart, toDate: today })
  }

  const toolbarActions = (
    <div className="compliance-toolbar__actions">
      <span>{totalCount} nhân viên</span>
      <button type="button" className="compliance-toolbar__export" onClick={handleExport}
        disabled={loading || totalCount === 0} title="Xuất danh sách đang lọc ra file Excel">
        <DownloadOutlined /> Xuất Excel
      </button>
      <button type="button" className="compliance-toolbar__reload" onClick={loadData}
        disabled={loading} aria-label="Tải lại dữ liệu" title="Tải lại">
        <ReloadOutlined spin={loading} />
      </button>
    </div>
  )

  const filterFields = (
    <>
      {isAdmin ? (
          <FilterSelectField label="Khoa/phòng" value={departmentId} onChange={setDepartmentId}
            options={[{ value: '', label: 'Toàn viện' }, ...departments.map((department) => ({ value: department.id, label: department.name }))]}
            placeholder="Toàn viện" searchable searchPlaceholder="Tìm tên khoa/phòng..." />
        ) : <label className="admin-control-toolbar__field"><span>Khoa/phòng</span><div className="compliance-filter-panel__fixed">{departments[0]?.name || 'Khoa của tôi'}</div></label>}
      <label className="admin-control-toolbar__field"><span>Từ ngày</span>
        <KeyboardDatePicker value={fromDate} max={toDate || undefined} onChange={setFromDate} />
      </label>
      <label className="admin-control-toolbar__field"><span>Đến ngày</span>
        <KeyboardDatePicker value={toDate} min={fromDate || undefined} onChange={setToDate} />
      </label>
    </>
  )

  return (
    <AppShell breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Tuân thủ chung' : undefined}>
            <div className="evd-page">
              <AppliedFilterToolbar
                activeCount={activeFilterCount}
                actions={toolbarActions}
                ariaLabel="Công cụ tuân thủ chung"
                className="compliance-toolbar"
                isOpen={isFilterOpen}
                onApply={applyFilters}
                onReset={resetFilters}
                onSearchChange={setKeyword}
                onToggle={() => setIsFilterOpen((current) => !current)}
                panelClassName="compliance-filter-panel"
                panelId="compliance-filter-panel"
                searchAriaLabel="Tìm theo tên nhân viên"
                searchClassName="compliance-toolbar__search"
                searchPlaceholder="Tìm theo tên nhân viên..."
                searchValue={keyword}
              >
                {filterFields}
              </AppliedFilterToolbar>

              <div className="evd-card evd-x-table-card compliance-table-card">
                <table className="evd-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Tổng số lần được kiểm tra</th>
                      <th>Tỷ lệ tuân thủ chung</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="ch-empty">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !data || !data.items || data.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ch-empty">
                          {!departmentId ? 'Vui lòng chọn khoa/phòng.' : 'Chưa có dữ liệu tuân thủ chung.'}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>{item.employeeName}<br /><small>{item.employeeCode} · {item.departmentName || data?.departmentName || '—'}</small></td>
                          <td>{item.evaluationCount}</td>
                          <td>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>
                              {item.passCount || 0}/{item.evaluationCount || 0} – {item.passRate != null ? `${item.passRate}%` : '0%'}
                            </span>
                          </td>
                          <td>
                            <button
                              aria-label={`Xem chi tiết tuân thủ của ${item.employeeName}`}
                              className="evd-btn-text admin-table-action admin-table-action--icon admin-table-action--primary"
                              onClick={() => {
                                const params = new URLSearchParams()
                                params.set('from', effectiveFromDate)
                                params.set('to', effectiveToDate)
                                navigate(
                                  isAdmin
                                    ? `/admin/evaluation/compliance-by-technique/${item.employeeId}?${params.toString()}`
                                    : `/manager/compliance-by-technique/${item.employeeId}?${params.toString()}`
                                )
                              }}
                              title="Xem chi tiết"
                              type="button"
                            >
                              <EyeOutlined />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
    </AppShell>
  )
}

export default ComplianceByTechniquePage
