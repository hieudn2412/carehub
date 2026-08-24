import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import AdminFilterDisclosure from '../../../shared/components/AdminFilterDisclosure.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
import { currentYearDateRange, validateHistoricalDateRange } from '../../../shared/utils/dateRange.js'
import '../styles/EvaluationDashboardPage.css'
import PassFailBadge from '../../../shared/components/PassFailBadge.jsx'

const DEFAULT_FIELD_DATES = currentYearDateRange()

function CompetencyByFieldPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [fromDate, setFromDate] = useState(DEFAULT_FIELD_DATES.fromDate)
  const [toDate, setToDate] = useState(DEFAULT_FIELD_DATES.toDate)
  const [filterError, setFilterError] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ departmentId: '', categoryId: '', ...DEFAULT_FIELD_DATES })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'
  const detailPathBase = isAdmin ? '/admin/evaluation/competency-by-field' : '/manager/competency-by-field'

  const loadDepartments = useCallback(async () => {
    try {
      if (isAdmin) {
        const response = await adminApi.getDepartments()
        const depts = apiData(response, [])
        setDepartments(depts)
        if (depts.length > 0) {
          const initialDepartmentId = String(depts[0].id)
          setSelectedDeptId(current => current || initialDepartmentId)
          setAppliedFilters(current => current.departmentId ? current : { ...current, departmentId: initialDepartmentId })
        }
        return
      }

      const response = await staffApi.getProfile()
      const profile = apiData(response, null)
      if (!profile?.departmentId) {
        throw new Error('Quản lý cấp Khoa chưa được gán khoa/phòng')
      }
      setDepartments([{
        id: profile.departmentId,
        name: profile.departmentName || 'Khoa của tôi',
      }])
      setSelectedDeptId(String(profile.departmentId))
      setAppliedFilters(current => ({ ...current, departmentId: String(profile.departmentId) }))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }, [isAdmin, showToast])

  const loadCategories = useCallback(async () => {
    try {
      const response = await questionCategoryApi.listCategories()
      const cats = apiData(response, [])
      setCategories(cats)
    } catch {
      // Categories optional - don't show error toast on load
      setCategories([])
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!appliedFilters.departmentId) return
    setLoading(true)
    try {
      const params = {
        departmentId: appliedFilters.departmentId,
        fromDate: appliedFilters.fromDate,
        toDate: appliedFilters.toDate,
      }
      if (appliedFilters.categoryId) {
        params.categoryId = appliedFilters.categoryId
      }
      const response = await competencyApi.getByField(params)
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, showToast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDepartments()
      loadCategories()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDepartments, loadCategories])

  useEffect(() => {
    if (!appliedFilters.departmentId) return undefined
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [appliedFilters.departmentId, loadData])

  const applyFilters = () => {
    const validationError = validateHistoricalDateRange(fromDate, toDate, { maxDate: DEFAULT_FIELD_DATES.toDate })
    if (validationError) {
      setFilterError(validationError)
      return
    }
    if (!selectedDeptId) {
      setFilterError('Vui lòng chọn khoa/phòng.')
      return
    }
    setFilterError('')
    setAppliedFilters({ departmentId: selectedDeptId, categoryId: selectedCategory, fromDate, toDate })
  }

  const resetFilters = () => {
    setSelectedCategory('')
    setFromDate(DEFAULT_FIELD_DATES.fromDate)
    setToDate(DEFAULT_FIELD_DATES.toDate)
    setFilterError('')
    setAppliedFilters({ departmentId: selectedDeptId, categoryId: '', ...DEFAULT_FIELD_DATES })
  }

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    { label: 'Năng lực theo lĩnh vực' },
  ]

  const filteredItems = data?.items
    ? data.items.filter(item =>
        !searchTerm ||
        (item.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  return (
    <AppShell breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Năng lực theo lĩnh vực' : undefined}>
            <div className="evd-page">
              <section className="evd-competency-toolbar admin-control-toolbar" aria-label="Công cụ năng lực theo lĩnh vực">
                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__search">
                    <SearchOutlined aria-hidden="true" />
                    <input
                      type="search"
                      placeholder="Tìm theo tên hoặc mã nhân viên..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="admin-control-toolbar__controls">
                    <AdminFilterDisclosure activeCount={Number(Boolean(appliedFilters.categoryId)) + Number(appliedFilters.fromDate !== DEFAULT_FIELD_DATES.fromDate) + Number(appliedFilters.toDate !== DEFAULT_FIELD_DATES.toDate)}>
                      <FilterSelectField
                            label="Khoa/phòng"
                            value={selectedDeptId}
                            onChange={setSelectedDeptId}
                            disabled={!isAdmin}
                            options={departments.map((department) => ({ value: department.id, label: department.name }))}
                            placeholder="Chọn khoa/phòng"
                            searchable
                            searchPlaceholder="Tìm tên khoa/phòng..."
                          />
                      <FilterSelectField
                            label="Lĩnh vực chuyên môn"
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={[
                              { value: '', label: 'Tất cả lĩnh vực' },
                              ...categories.map((category) => ({ value: category.id, label: category.name })),
                            ]}
                            placeholder="Tất cả lĩnh vực"
                            searchable
                            searchPlaceholder="Tìm tên lĩnh vực..."
                          />
                      <label className="admin-control-toolbar__field">
                        <span>Từ ngày</span>
                        <KeyboardDatePicker allowInvalidValue value={fromDate} max={toDate || DEFAULT_FIELD_DATES.toDate} onChange={val => { setFilterError(''); setFromDate(val) }} />
                      </label>
                      <label className="admin-control-toolbar__field">
                        <span>Đến ngày</span>
                        <KeyboardDatePicker allowInvalidValue value={toDate} min={fromDate || undefined} max={DEFAULT_FIELD_DATES.toDate} onChange={val => { setFilterError(''); setToDate(val) }} />
                      </label>
                      {filterError && <p className="applied-filter-toolbar__error" role="alert">{filterError}</p>}
                      <FilterActionButtons onReset={resetFilters} onApply={applyFilters} />
                    </AdminFilterDisclosure>
                    <span className="evd-competency-toolbar__count">{filteredItems.length} nhân viên</span>
                    <button className="evd-icon-btn" type="button" onClick={loadData} disabled={loading} title="Tải lại" aria-label="Tải lại">
                      <ReloadOutlined />
                    </button>
                  </div>
                </div>
              </section>

              <div className="evd-card evd-x-table-card">
                <table className="evd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>STT</th>
                      <th>Mã NV</th>
                      <th>Họ tên</th>
                      <th>Số lần thi</th>
                      <th>Điểm TB</th>
                      <th>Tỷ lệ đạt</th>
                      <th>Phân loại</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="ch-empty">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="ch-empty">
                          Chưa có dữ liệu đánh giá cho lĩnh vực này.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr
                          key={item.employeeId}
                          className={!item.isPassed ? 'evd-row--danger' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`${detailPathBase}/${item.employeeId}`)}
                        >
                          <td>{idx + 1}</td>
                          <td>{item.employeeCode}</td>
                          <td style={{ fontWeight: 500 }}>{item.employeeName}</td>
                          <td>{item.attemptCount}</td>
                          <td>{formatNumber(item.averageScore)}</td>
                          <td>
                            <span style={{ color: (item.passRate || 0) < 50 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {item.passRate != null ? `${item.passRate}%` : '—'}
                            </span>
                          </td>
                          <td>
                            <PassFailBadge passed={item.isPassed} />
                          </td>
                          <td>
                            <button className="evd-btn-text" onClick={e => { e.stopPropagation(); navigate(`${detailPathBase}/${item.employeeId}`) }}>
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

export default CompetencyByFieldPage
