import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  EyeOutlined,
  WarningFilled,
  CheckCircleFilled,
  ReloadOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../features/auth/utils/jwt.js'
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
      const response = await adminApi.getDepartments()
      const depts = apiData(response, [])
      setDepartments(depts)
      if (depts.length > 0 && !selectedDeptId) {
        setSelectedDeptId(String(depts[0].id))
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }, [showToast, selectedDeptId])

  const loadCategories = useCallback(async () => {
    try {
      const { questionCategoryApi } = await import('../api/questionCategoryApi.js')
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

  useEffect(() => { loadDepartments() }, [])
  useEffect(() => { loadCategories() }, [])
  useEffect(() => { if (selectedDeptId) loadData() }, [selectedDeptId])

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

  const Layout = isAdmin ? AdminSidebar : Sidebar
  const PageHeader = isAdmin ? AdminHeader : Header

  return (
    <div className="dashboard-layout">
      <Layout />
      <div className="dashboard-layout__content">
        <PageHeader breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Năng lực theo lĩnh vực' : undefined} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Năng lực theo lĩnh vực kiến thức</h1>
                  <p>Xem điểm trung bình và phân loại năng lực của điều dưỡng theo từng lĩnh vực chuyên môn</p>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              <section className="evd-panel" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                  <label style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Khoa:</label>
                  <select
                    value={selectedDeptId}
                    onChange={e => setSelectedDeptId(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <label style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginLeft: 8 }}>Lĩnh vực:</label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                  >
                    <option value="">Tất cả lĩnh vực</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <label style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginLeft: 8 }}>Từ:</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />

                  <label style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>Đến:</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }} />

                  <button className="evd-btn" onClick={loadData}>Áp dụng</button>
                </div>
              </section>

              {data && data.items && data.items.length > 0 && (
                <section className="evd-panel" style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, color: '#374151' }}>
                    <strong>{data.departmentName}</strong>
                    {data.categoryName && <> — <em>{data.categoryName}</em></>}
                    : {data.items.length} điều dưỡng có dữ liệu
                  </div>
                </section>
              )}

              <section className="evd-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="mgr-search-box" style={{ maxWidth: 300 }}>
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc mã NV..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
                  />
                  <SearchOutlined />
                </div>
              </section>

              <div className="evd-card" style={{ overflow: 'auto' }}>
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
                        <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                          Chưa có dữ liệu đánh giá cho lĩnh vực này trong khoảng thời gian đã chọn.
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
          </main>
        </div>
      </div>
    </div>
  )
}

export default CompetencyByFieldPage
