import { useState, useEffect, useCallback } from 'react'
import {
  TeamOutlined,
  TrophyOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  LoadingOutlined,
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
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { trainingApi } from '../../training/api/trainingApi'
import '../styles/QualityDashboardPage.css'

const PAGE_SIZE = 500

async function fetchAll(fetcher, baseParams = {}) {
  const first = await fetcher({ ...baseParams, page: 0, size: PAGE_SIZE })
  const firstData = first?.data?.data
  const content = firstData?.content || []
  const totalPages = firstData?.totalPages || 1
  if (totalPages <= 1) return content
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetcher({ ...baseParams, page: i + 1, size: PAGE_SIZE }),
    ),
  )
  return [...content, ...rest.flatMap(r => r?.data?.data?.content || [])]
}

const COMPLIANCE_COLORS = {
  COMPLIANT: '#16b889',
  NON_COMPLIANT: '#ef4444',
  AT_RISK: '#f59e0b',
  NOT_CONFIGURED: '#94a3b8',
}
const COMPLIANCE_LABEL = {
  COMPLIANT: 'Đạt',
  NON_COMPLIANT: 'Không đạt',
  AT_RISK: 'Đang theo dõi',
  NOT_CONFIGURED: 'Chưa áp dụng',
}

function MetricCard({ icon, label, value, tone }) {
  const tones = {
    primary: { bg: '#eff6ff', color: '#2563eb', iconBg: '#dbeafe' },
    success: { bg: '#ecfdf5', color: '#16b889', iconBg: '#d1fae5' },
    danger: { bg: '#fef2f2', color: '#ef4444', iconBg: '#fee2e2' },
    warning: { bg: '#fffbeb', color: '#f59e0b', iconBg: '#fef3c7' },
  }
  const t = tones[tone] || tones.primary
  return (
    <div className="qd-metric" style={{ background: t.bg, borderLeft: `4px solid ${t.color}` }}>
      <div className="qd-metric__icon" style={{ background: t.iconBg, color: t.color }}>{icon}</div>
      <div className="qd-metric__body">
        <span className="qd-metric__label">{label}</span>
        <span className="qd-metric__value" style={{ color: t.color }}>{value}</span>
      </div>
    </div>
  )
}

function TrainingDashboardPage() {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    trainingApi.getDepartments()
      .then(res => {
        const depts = res?.data?.data || []
        setDepartments(depts)
      })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { departmentId: departmentId || undefined }
      const data = await fetchAll(trainingApi.getEmployeeTrainingStatuses, params)
      setEmployees(data.map(e => ({
        id: e.employeeId,
        code: e.employeeCode,
        name: e.employeeName,
        departmentName: e.departmentName || '—',
        requiredHours: parseFloat(e.requiredHours) || 0,
        submittedHours: parseFloat(e.submittedHours) || 0,
        progressPct: parseFloat(e.progressPercentage) || 0,
        compliance: e.complianceStatus,
      })))
    } catch {
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => { loadData() }, [loadData])

  const configured = employees.filter(e => e.compliance !== 'NOT_CONFIGURED')
  const compliant = employees.filter(e => e.compliance === 'COMPLIANT').length
  const nonCompliant = employees.filter(e => e.compliance === 'NON_COMPLIANT' || e.compliance === 'AT_RISK').length
  const totalHours = employees.reduce((s, e) => s + e.submittedHours, 0)

  const distribution = (() => {
    const buckets = { '0-25%': 0, '25-50%': 0, '50-75%': 0, '75-100%': 0, '>100%': 0 }
    configured.forEach(e => {
      if (e.progressPct >= 100) buckets['>100%']++
      else if (e.progressPct >= 75) buckets['75-100%']++
      else if (e.progressPct >= 50) buckets['50-75%']++
      else if (e.progressPct >= 25) buckets['25-50%']++
      else buckets['0-25%']++
    })
    return Object.entries(buckets).map(([name, count]) => ({ name, count }))
  })()

  const byDepartment = (() => {
    const map = {}
    configured.forEach(e => {
      const dept = e.departmentName || '—'
      if (!map[dept]) map[dept] = { total: 0, compliant: 0 }
      map[dept].total++
      if (e.compliance === 'COMPLIANT') map[dept].compliant++
    })
    return Object.entries(map)
      .map(([name, { total, compliant }]) => ({ name, rate: total > 0 ? Math.round((compliant / total) * 100) : 0, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
  })()

  const topDeficient = [...employees]
    .filter(e => e.compliance === 'NON_COMPLIANT' || e.compliance === 'AT_RISK')
    .sort((a, b) => (b.requiredHours - b.submittedHours) - (a.requiredHours - a.submittedHours))
    .slice(0, 10)

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Dashboard đào tạo' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qd-page">
              <div className="qd-header">
                <div>
                  <h1 className="qd-header__title">Dashboard đào tạo</h1>
                  <p className="qd-header__sub">Tổng quan về tình hình giờ đào tạo toàn viện</p>
                </div>
                <button className="qd-btn qd-btn--ghost" onClick={loadData} disabled={loading}>
                  {loading ? <LoadingOutlined spin /> : <ReloadOutlined />} Tải lại
                </button>
              </div>

              <div className="qd-filters" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200 }}>
                  <option value="">Toàn viện</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - i
                    return <option key={y} value={y}>{y}</option>
                  })}
                </select>
              </div>

              <div className="qd-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <MetricCard icon={<TeamOutlined />} label="NV được áp dụng" value={configured.length} tone="primary" />
                <MetricCard icon={<TrophyOutlined />} label="NV đạt chuẩn" value={compliant} tone="success" />
                <MetricCard icon={<ExclamationCircleOutlined />} label="NV chưa đạt" value={nonCompliant} tone="danger" />
                <MetricCard icon={<ClockCircleOutlined />} label="Tổng giờ đã nộp" value={totalHours.toLocaleString()} tone="warning" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div className="qd-panel">
                  <h3 className="qd-panel__title">Phân bố mức độ hoàn thành</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={distribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                        label={({ name, count }) => `${name}: ${count}`}>
                        {distribution.map((_, i) => (
                          <Cell key={i} fill={['#ef4444', '#f59e0b', '#3b82f6', '#16b889', '#6366f1'][i] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => [`${v} NV`, 'Số lượng']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="qd-panel">
                  <h3 className="qd-panel__title">Tỷ lệ đạt theo khoa</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byDepartment} layout="vertical" margin={{ left: 120, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={115} />
                      <Tooltip formatter={v => [`${v}%`, 'Tỷ lệ đạt']} />
                      <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={20}>
                        {byDepartment.map((entry, i) => (
                          <Cell key={i} fill={entry.rate >= 80 ? '#16b889' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="qd-panel">
                <h3 className="qd-panel__title">Top 10 nhân viên thiếu giờ nhiều nhất</h3>
                <table className="qd-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mã NV</th>
                      <th>Họ tên</th>
                      <th>Khoa</th>
                      <th>Giờ yêu cầu</th>
                      <th>Giờ đã nộp</th>
                      <th>Thiếu</th>
                      <th>Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDeficient.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Không có dữ liệu</td></tr>
                    ) : topDeficient.map((e, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><code style={{ fontSize: 12 }}>{e.code || '—'}</code></td>
                        <td style={{ fontWeight: 500 }}>{e.name || '—'}</td>
                        <td>{e.departmentName}</td>
                        <td>{e.requiredHours.toFixed(0)}</td>
                        <td>{e.submittedHours.toFixed(0)}</td>
                        <td style={{ color: '#ef4444', fontWeight: 600 }}>{Math.max(0, e.requiredHours - e.submittedHours).toFixed(0)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, e.progressPct)}%`, height: '100%', background: '#ef4444', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{e.progressPct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
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

export default TrainingDashboardPage
