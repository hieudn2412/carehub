import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import { downloadCsv, exportFileName } from '../../../shared/utils/tableExport.js'
import '../styles/EvaluationDashboardPage.css'

const today = new Date().toISOString().slice(0, 10)
const yearStart = `${new Date().getFullYear()}-01-01`

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

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'

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

  const loadData = useCallback(async () => {
    if (!departmentId && !isAdmin) {
      showToast('Vui lòng chọn khoa/phòng', 'warning')
      return
    }
    setLoading(true)
    try {
      const response = await competencyApi.getByTechnique({
        departmentId,
        keyword: keyword || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      const responseData = apiData(response, null)
      setData(responseData)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [departmentId, fromDate, isAdmin, keyword, toDate, showToast])

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
      fromDate,
      toDate,
    ])
    downloadCsv(exportFileName('tuan-thu-chung'), EXPORT_HEADERS, rows)
  }

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    { label: 'Tuân thủ chung' },
  ]

  const totalCount = data?.items ? data.items.length : 0
  const activeFilterCount = [
    isAdmin && departmentId,
    fromDate && fromDate !== yearStart,
    toDate && toDate !== today,
  ].filter(Boolean).length

  return (
    <AppShell breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Tuân thủ chung' : undefined}>
            <div className="evd-page">
              <section className="compliance-toolbar admin-control-toolbar" aria-label="Công cụ tuân thủ chung">
                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__controls">
                    <div className="compliance-toolbar__search admin-control-toolbar__search">
                      <SearchOutlined />
                      <input
                        aria-label="Tìm theo tên nhân viên"
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="Tìm theo tên nhân viên..."
                      />
                    </div>
                    <button
                      type="button"
                      className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      aria-controls="compliance-filter-panel"
                      aria-expanded={isFilterOpen}
                      onClick={() => setIsFilterOpen((current) => !current)}
                    >
                      <FilterOutlined />
                      Bộ lọc
                      {activeFilterCount > 0 && (
                        <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>
                      )}
                    </button>
                  </div>
                  <div className="compliance-toolbar__actions">
                    <span>{totalCount} nhân viên</span>
                    <button
                      type="button"
                      className="compliance-toolbar__export"
                      onClick={handleExport}
                      disabled={loading || totalCount === 0}
                      title="Xuất danh sách đang lọc ra file Excel"
                    >
                      <DownloadOutlined /> Xuất Excel
                    </button>
                    <button
                      type="button"
                      className="compliance-toolbar__reload"
                      onClick={loadData}
                      disabled={loading}
                      aria-label="Tải lại dữ liệu"
                      title="Tải lại"
                    >
                      <ReloadOutlined spin={loading} />
                    </button>
                  </div>
                </div>

                {isFilterOpen && (
                  <div id="compliance-filter-panel" className="compliance-filter-panel admin-control-toolbar__panel">
                    <label className="admin-control-toolbar__field">
                      <span>Khoa/phòng</span>
                      {isAdmin ? (
                        <SearchableSelect
                          value={departmentId}
                          onChange={setDepartmentId}
                          options={[
                            { value: '', label: 'Toàn viện' },
                            ...departments.map((department) => ({ value: department.id, label: department.name })),
                          ]}
                          placeholder="Toàn viện"
                          searchPlaceholder="Tìm tên khoa/phòng..."
                          ariaLabel="Tìm và chọn khoa/phòng"
                        />
                      ) : (
                        <div className="compliance-filter-panel__fixed">
                          {departments[0]?.name || 'Khoa của tôi'}
                        </div>
                      )}
                    </label>
                    <label className="admin-control-toolbar__field">
                      <span>Từ ngày</span>
                      <KeyboardDatePicker value={fromDate} max={toDate || undefined} onChange={(val) => setFromDate(val)} />
                    </label>
                    <label className="admin-control-toolbar__field">
                      <span>Đến ngày</span>
                      <KeyboardDatePicker value={toDate} min={fromDate || undefined} onChange={(val) => setToDate(val)} />
                    </label>
                  </div>
                )}
              </section>

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
                                params.set('from', fromDate)
                                params.set('to', toDate)
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
