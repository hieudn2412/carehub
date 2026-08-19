import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  EyeOutlined,
  WarningFilled,
  CheckCircleFilled,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import AdminFilterDisclosure from '../../../shared/components/AdminFilterDisclosure.jsx'
import '../styles/EvaluationDashboardPage.css'

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
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
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
          setSelectedDeptId(current => current || String(depts[0].id))
        }
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
      setSelectedDeptId(String(profile.departmentId))
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
    if (!selectedDeptId) return
    setLoading(true)
    try {
      const params = {
        departmentId: selectedDeptId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      const response = await competencyApi.getByField(params)
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedDeptId, selectedCategory, fromDate, toDate, showToast])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDepartments()
      loadCategories()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDepartments, loadCategories])

  useEffect(() => {
    if (!selectedDeptId) return undefined
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [selectedDeptId, loadData])

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
                    <AdminFilterDisclosure activeCount={Number(Boolean(selectedCategory)) + Number(Boolean(fromDate)) + Number(Boolean(toDate))}>
                      <label className="admin-control-toolbar__field">
                        <span>Khoa/phòng</span>
                        <div>
                          <SearchableSelect
                            value={selectedDeptId}
                            onChange={setSelectedDeptId}
                            disabled={!isAdmin}
                            options={departments.map((department) => ({ value: department.id, label: department.name }))}
                            placeholder="Chọn khoa/phòng"
                            searchPlaceholder="Tìm tên khoa/phòng..."
                            ariaLabel="Tìm và chọn khoa/phòng"
                          />
                        </div>
                      </label>
                      <label className="admin-control-toolbar__field">
                        <span>Lĩnh vực chuyên môn</span>
                        <div>
                          <SearchableSelect
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={[
                              { value: '', label: 'Tất cả lĩnh vực' },
                              ...categories.map((category) => ({ value: category.id, label: category.name })),
                            ]}
                            placeholder="Tất cả lĩnh vực"
                            searchPlaceholder="Tìm tên lĩnh vực..."
                            ariaLabel="Tìm và chọn lĩnh vực"
                          />
                        </div>
                      </label>
                      <label className="admin-control-toolbar__field">
                        <span>Từ ngày</span>
                        <input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} />
                      </label>
                      <label className="admin-control-toolbar__field">
                        <span>Đến ngày</span>
                        <input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} />
                      </label>
                      <button className="evd-btn" type="button" onClick={loadData}>Áp dụng</button>
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
                            <span className="evd-badge" style={{
                              backgroundColor: (item.colorHex || '#6b7280') + '20',
                              color: item.colorHex || '#6b7280',
                            }}>
                              {item.isPassed ? <CheckCircleFilled style={{ marginRight: 4 }} /> : <WarningFilled style={{ marginRight: 4 }} />}
                              {item.competencyLabel || '—'}
                            </span>
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
