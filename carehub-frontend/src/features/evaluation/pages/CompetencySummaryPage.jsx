import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrophyOutlined,
  SearchOutlined,
  ReloadOutlined,
  WarningFilled,
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  CaretUpOutlined,
  CaretDownOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../features/auth/utils/jwt.js'
import '../styles/EvaluationDashboardPage.css'

function CompetencySummaryPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [reportType, setReportType] = useState('summary') // 'summary', 'field', 'technique'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))

  // Field specific states
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')

  // Technique specific states
  const [forms, setForms] = useState([])
  const [selectedFormId, setSelectedFormId] = useState('')

  // Search filter
  const [searchTerm, setSearchTerm] = useState('')

  // Sorting
  const [sortColumn, setSortColumn] = useState('overallScore')
  const [sortDirection, setSortDirection] = useState('desc')

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'
  const detailPathField = isAdmin ? '/admin/evaluation/competency-by-field' : '/manager/competency-by-field'

  const loadCategories = useCallback(async () => {
    try {
      const { questionCategoryApi } = await import('../api/questionCategoryApi.js')
      const response = await questionCategoryApi.listCategories()
      setCategories(apiData(response, []))
    } catch {
      setCategories([])
    }
  }, [])

  const loadFormList = useCallback(async () => {
    try {
      const formListResponse = await import('../api/questionCategoryApi.js')
      const fRes = await formListResponse.questionCategoryApi.getAllCategories()
      const categoriesList = apiData(fRes, [])
      setForms(categoriesList.map(c => ({ id: c.id, title: c.name || c.categoryName })))
    } catch {
      setForms([])
    }
  }, [])

  useEffect(() => {
    async function init() {
      if (isAdmin) {
        try {
          const res = await adminApi.getDepartments()
          const depts = apiData(res, [])
          setDepartments(depts)
          if (depts.length > 0) setDepartmentId(String(depts[0].id))
        } catch { /* ignore */ }
      } else {
        try {
          const res = await staffApi.getProfile()
          const profile = res.data?.data
          if (profile?.departmentId) {
            setDepartmentId(String(profile.departmentId))
            setDepartments([{ id: profile.departmentId, name: profile.departmentName || 'Khoa của tôi' }])
          }
        } catch {
          showToast('Không tìm thấy khoa/phòng của bạn', 'error')
        }
      }
    }
    init()
    loadCategories()
    loadFormList()
  }, [isAdmin, showToast, loadCategories, loadFormList])

  const loadData = useCallback(async () => {
    if (!departmentId) return
    setLoading(true)
    setData(null)
    try {
      if (reportType === 'summary') {
        const response = await competencyApi.getSummary({
          departmentId,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        })
        setData(apiData(response, null))
      } else if (reportType === 'field') {
        const params = {
          departmentId,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }
        if (selectedCategory) {
          params.categoryId = selectedCategory
        }
        const response = await competencyApi.getByField(params)
        setData(apiData(response, null))
      } else if (reportType === 'technique') {
        const response = await competencyApi.getByTechnique(
          departmentId,
          selectedFormId || null,
          fromDate,
          toDate
        )
        setData(apiData(response, null))
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [reportType, departmentId, fromDate, toDate, selectedCategory, selectedFormId, showToast])

  useEffect(() => {
    if (departmentId) {
      loadData()
    }
  }, [departmentId, reportType, fromDate, toDate, selectedCategory, selectedFormId, loadData])

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const sortIcon = (column) => {
    if (sortColumn !== column) return <span style={{ marginLeft: 4, color: '#d1d5db' }}><CaretUpOutlined style={{ fontSize: 10 }} /></span>
    return sortDirection === 'asc'
      ? <CaretUpOutlined style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }} />
      : <CaretDownOutlined style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }} />
  }

  const buildDistribution = () => {
    if (reportType !== 'summary' || !data?.items) return []
    const counts = {}
    data.items.forEach(item => {
      const label = item.competencyLabel || 'Chưa xếp loại'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => {
        const item = data.items.find(i => (i.competencyLabel || 'Chưa xếp loại') === name)
        return {
          name,
          count,
          fill: item?.colorHex || '#6b7280',
        }
      })
      .sort((a, b) => b.count - a.count)
  }

  const distribution = buildDistribution()
  const knowledgeWeight = data?.knowledgeWeight ? parseFloat(data.knowledgeWeight) * 100 : 50
  const skillWeight = data?.skillWeight ? parseFloat(data.skillWeight) * 100 : 50

  const filteredItems = data?.items
    ? data.items.filter(item =>
        !searchTerm ||
        (item.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  const getSortedSummaryItems = () => {
    const items = [...filteredItems]
    items.sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      const aNum = typeof aVal === 'number' ? aVal : (parseFloat(aVal) || 0)
      const bNum = typeof bVal === 'number' ? bVal : (parseFloat(bVal) || 0)
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })
    return items
  }

  const complianceTarget = data?.complianceTarget || 80.0
  const belowCount = data?.items ? data.items.filter(i => i.belowTarget).length : 0
  const totalCount = data?.items ? data.items.length : 0

  const Layout = isAdmin ? AdminSidebar : Sidebar
  const PageHeader = isAdmin ? AdminHeader : Header

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    {
      label: reportType === 'summary' ? 'Tổng hợp năng lực'
        : reportType === 'field' ? 'Năng lực theo lĩnh vực'
        : 'Tuân thủ kỹ thuật'
    },
  ]

  const pageTitle = reportType === 'summary' ? 'Tổng hợp năng lực'
    : reportType === 'field' ? 'Năng lực theo lĩnh vực'
    : 'Tuân thủ kỹ thuật'

  return (
    <div className="dashboard-layout">
      <Layout />
      <div className="dashboard-layout__content">
        <PageHeader breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? pageTitle : undefined} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Dashboard Đánh giá Năng lực</h1>
                  <p>Theo dõi chỉ số chuyên môn, quy trình kỹ thuật và xếp loại năng lực điều dưỡng</p>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              {/* Segmented Control Filter for Dashboard Screen */}
              <section className="evd-panel" style={{ padding: '8px 12px', marginBottom: 16, display: 'inline-flex', background: '#f3f4f6', borderRadius: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { key: 'summary', label: 'Tổng hợp năng lực' },
                    { key: 'field', label: 'Năng lực theo lĩnh vực' },
                    { key: 'technique', label: 'Tuân thủ kỹ thuật' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setReportType(tab.key)
                        setSearchTerm('')
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: reportType === tab.key ? '#ffffff' : 'transparent',
                        color: reportType === tab.key ? '#2563eb' : '#4b5563',
                        boxShadow: reportType === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Filters panel */}
              <section className="evd-filter-bar" style={{
                display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
                marginBottom: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 8,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Khoa/phòng</label>
                  <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 180 }}>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Từ ngày</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Đến ngày</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                </div>

                {reportType === 'field' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Lĩnh vực</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 180 }}>
                      <option value="">Tất cả lĩnh vực</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {reportType === 'technique' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Kỹ thuật</label>
                    <select value={selectedFormId} onChange={(e) => setSelectedFormId(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200 }}>
                      <option value="">-- Tất cả kỹ thuật --</option>
                      {forms.map(f => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {reportType === 'summary' && data && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Trọng số</label>
                    <span style={{ fontSize: 13, color: '#374151', padding: '6px 0' }}>
                      Kiến thức: {knowledgeWeight}% — Kỹ năng: {skillWeight}%
                    </span>
                  </div>
                )}
              </section>

              {/* REPORT TYPE: 1. SUMMARY VIEW */}
              {reportType === 'summary' && (
                <>
                  {data && distribution.length > 0 && (
                    <section className="evd-panel" style={{ padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                        Phân bố mức phân loại — {data.departmentName || 'Khoa đã chọn'}
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={distribution} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 13, fill: '#374151' }} width={100} />
                          <Tooltip
                            formatter={(value) => [`${value} Điều dưỡng`, 'Số lượng']}
                            contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
                          />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                            {distribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
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
                          <th>STT</th>
                          <th>Mã NV</th>
                          <th>Họ tên</th>
                          {isAdmin && <th>Khoa</th>}
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('knowledgeAverage')}>
                            Điểm TB kiến thức{sortIcon('knowledgeAverage')}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('skillAverage')}>
                            Điểm TB kỹ năng{sortIcon('skillAverage')}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('overallScore')}>
                            Tổng điểm{sortIcon('overallScore')}
                          </th>
                          <th>Phân loại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                              Đang tải dữ liệu...
                            </td>
                          </tr>
                        ) : !data || filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                              Chưa có dữ liệu năng lực cho khoa này.
                            </td>
                          </tr>
                        ) : (
                          getSortedSummaryItems().map((item, idx) => {
                            const isNotCompetent = item.competencyLevel === 'NOT_COMPETENT'
                            const isBeginner = item.competencyLevel === 'BEGINNER'
                            const rowClass = isNotCompetent ? 'evd-row--danger' : (isBeginner ? 'evd-row--warning' : '')
                            return (
                              <tr key={idx} className={rowClass}>
                                <td>{idx + 1}</td>
                                <td><code style={{ fontSize: 12 }}>{item.employeeCode || '—'}</code></td>
                                <td style={{ fontWeight: 500 }}>{item.employeeName || '—'}</td>
                                {isAdmin && <td style={{ color: '#6b7280' }}>{data.departmentName || '—'}</td>}
                                <td>{formatNumber(item.knowledgeAverage)}</td>
                                <td>{formatNumber(item.skillAverage)}</td>
                                <td style={{ fontWeight: 700 }}>{formatNumber(item.overallScore)}</td>
                                <td>
                                  <span className="evd-badge" style={{
                                    backgroundColor: (item.colorHex || '#6b7280') + '20',
                                    color: item.colorHex || '#6b7280',
                                  }}>
                                    {item.isPassed
                                      ? <CheckCircleFilled style={{ marginRight: 4 }} />
                                      : isNotCompetent
                                        ? <CloseCircleFilled style={{ marginRight: 4 }} />
                                        : <WarningFilled style={{ marginRight: 4 }} />}
                                    {item.competencyLabel || '—'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* REPORT TYPE: 2. FIELD VIEW */}
              {reportType === 'field' && (
                <>
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
                              Chưa có dữ liệu đánh giá cho lĩnh vực này.
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => (
                            <tr
                              key={item.employeeId}
                              className={!item.isPassed ? 'evd-row--danger' : ''}
                              style={{ cursor: 'pointer' }}
                              onClick={() => navigate(`${detailPathField}/${item.employeeId}`)}
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
                                <button className="evd-btn-text" onClick={e => { e.stopPropagation(); navigate(`${detailPathField}/${item.employeeId}`) }}>
                                  <EyeOutlined />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* REPORT TYPE: 3. TECHNIQUE VIEW */}
              {reportType === 'technique' && (
                <>
                  {data && (
                    <section className="evd-panel" style={{
                      padding: 16, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                        Mục tiêu tuân thủ: <span style={{ color: '#2563eb' }}>{complianceTarget}%</span>
                      </div>
                      {totalCount > 0 && (
                        <div style={{ fontSize: 14, color: '#6b7280' }}>
                          {totalCount} Điều dưỡng —{' '}
                          <span style={{ color: belowCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                            {belowCount} dưới mục tiêu
                          </span>
                        </div>
                      )}
                      {totalCount === 0 && data && (
                        <div style={{ fontSize: 14, color: '#9ca3af' }}>
                          Chưa có dữ liệu tuân thủ kỹ thuật trong khoảng thời gian đã chọn.
                        </div>
                      )}
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
                          <th>STT</th>
                          <th>Mã NV</th>
                          <th>Họ tên</th>
                          {isAdmin && <th>Khoa</th>}
                          <th>Số lần ĐG</th>
                          <th>Điểm TB</th>
                          <th>Tỷ lệ đạt</th>
                          <th>Mục tiêu</th>
                          <th>Phân loại</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                              Đang tải dữ liệu...
                            </td>
                          </tr>
                        ) : filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                              {!departmentId ? 'Vui lòng chọn khoa/phòng.' : 'Chưa có dữ liệu tuân thủ kỹ thuật.'}
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => (
                            <tr key={idx} className={item.belowTarget ? 'evd-row--danger' : (!item.isPassed ? 'evd-row--warning' : '')}>
                              <td>{idx + 1}</td>
                              <td><code style={{ fontSize: 12 }}>{item.employeeCode}</code></td>
                              <td style={{ fontWeight: 500 }}>{item.employeeName}</td>
                              {isAdmin && <td style={{ color: '#6b7280' }}>{item.departmentName || data?.departmentName || '—'}</td>}
                              <td>{item.evaluationCount}</td>
                              <td>{formatNumber(item.averageScore)}</td>
                              <td>
                                <span style={{ color: (item.passRate || 0) < complianceTarget ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                                  {item.passRate != null ? `${item.passRate}%` : '—'}
                                </span>
                              </td>
                              <td>
                                {item.belowTarget ? (
                                  <span style={{ color: '#dc2626', fontSize: 12 }}>
                                    <ExclamationCircleFilled style={{ marginRight: 4 }} />
                                    {'<'} {complianceTarget}%
                                  </span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: 12 }}>
                                    <CheckCircleFilled style={{ marginRight: 4 }} />Đạt
                                  </span>
                                )}
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
                                <button
                                  className="evd-btn-text"
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
                                  style={{ padding: '4px 10px', fontSize: 13 }}
                                >
                                  <EyeOutlined style={{ marginRight: 4 }} />Xem
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default CompetencySummaryPage
