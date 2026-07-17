import { useState, useEffect, useCallback } from 'react'
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

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))
  const [sortColumn, setSortColumn] = useState('overallScore')
  const [sortDirection, setSortDirection] = useState('desc')

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'

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
          showToast('Không thể xác định khoa/phòng của bạn', 'error')
        }
      }
    }
    init()
  }, [])

  const loadData = useCallback(async () => {
    if (!departmentId) return
    setLoading(true)
    try {
      const response = await competencyApi.getSummary({
        departmentId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [departmentId, fromDate, toDate, showToast])

  useEffect(() => {
    if (departmentId) loadData()
  }, [departmentId, fromDate, toDate])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    { label: 'Tổng hợp năng lực' },
  ]

  const Layout = isAdmin ? AdminSidebar : Sidebar
  const PageHeader = isAdmin ? AdminHeader : Header

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortedItems = () => {
    if (!data?.items) return []
    const items = [...data.items]
    items.sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      const aNum = typeof aVal === 'number' ? aVal : (parseFloat(aVal) || 0)
      const bNum = typeof bVal === 'number' ? bVal : (parseFloat(bVal) || 0)
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })
    return items
  }

  const sortIcon = (column) => {
    if (sortColumn !== column) return <span style={{ marginLeft: 4, color: '#d1d5db' }}><CaretUpOutlined style={{ fontSize: 10 }} /></span>
    return sortDirection === 'asc'
      ? <CaretUpOutlined style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }} />
      : <CaretDownOutlined style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }} />
  }

  const buildDistribution = () => {
    if (!data?.items) return []
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

  return (
    <div className="dashboard-layout">
      <Layout />
      <div className="dashboard-layout__content">
        <PageHeader breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Tổng hợp năng lực' : undefined} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Tổng hợp năng lực chuyên môn</h1>
                  <p>Điểm kiến thức + kỹ năng thực hành của Điều dưỡng trong khoa</p>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              <section className="evd-filter-bar" style={{
                display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
                marginBottom: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 8,
              }}>
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Khoa/phòng</label>
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200 }}>
                      <option value="">-- Chọn khoa --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Trọng số</label>
                  <span style={{ fontSize: 13, color: '#374151', padding: '6px 0' }}>
                    Kiến thức: {knowledgeWeight}% · Kỹ năng: {skillWeight}%
                  </span>
                </div>
              </section>

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
                    ) : !data || !data.items || data.items.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                          Chưa có đủ dữ liệu kiến thức và kỹ năng để tổng hợp năng lực cho khoa này.
                        </td>
                      </tr>
                    ) : (
                      getSortedItems().map((item, idx) => {
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
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default CompetencySummaryPage
