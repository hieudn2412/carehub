import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AdminSidebar from '../components/AdminSidebar.jsx'
import AdminHeader from '../components/AdminHeader.jsx'
import Sidebar from '../../staff/components/sidebar.jsx'
import Header from '../../staff/components/Header.jsx'
import { staffApi } from '../../staff/api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import '../styles/TrainingDashboardPage.css'

const PAGE_SIZE = 500
const TARGET_HOURS = 120

function responsePayload(response) {
  return response?.data?.data || {}
}

async function fetchAll(baseParams) {
  const firstResponse = await trainingApi.getEmployeeTrainingStatuses({
    ...baseParams,
    page: 0,
    size: PAGE_SIZE,
  })
  const firstPage = responsePayload(firstResponse)
  const content = Array.isArray(firstPage.content) ? firstPage.content : []
  const totalPages = Number(firstPage.totalPages) || 1

  if (totalPages <= 1) return content

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      trainingApi.getEmployeeTrainingStatuses({
        ...baseParams,
        page: index + 1,
        size: PAGE_SIZE,
      })
    )),
  )

  return [
    ...content,
    ...remaining.flatMap((response) => responsePayload(response).content || []),
  ]
}

function normalizeEmployee(item) {
  const completedHours = Number(item.submittedHours) || 0
  return {
    id: item.employeeId,
    code: item.employeeCode || '',
    name: item.employeeName || '',
    departmentName: item.departmentName || 'Chưa xác định',
    positionName: item.positionName || item.jobPositionName || '',
    completedHours,
    missingHours: Math.max(0, TARGET_HOURS - completedHours),
    completed: completedHours >= TARGET_HOURS,
  }
}

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function exportCsv(rows) {
  const headers = ['Mã nhân viên', 'Họ tên', 'Khoa/Phòng', 'Chức danh', 'Giờ hoàn thành', 'Mục tiêu', 'Còn thiếu', 'Trạng thái']
  const lines = rows.map((row) => [
    row.code,
    row.name,
    row.departmentName,
    row.positionName,
    row.completedHours,
    TARGET_HOURS,
    row.missingHours,
    row.completed ? 'Đủ giờ' : 'Chưa đủ giờ',
  ].map(escapeCsv).join(','))
  const csvContent = [headers.map(escapeCsv).join(','), ...lines].join('\n')
  const blob = new Blob([String.fromCharCode(0xfeff), csvContent], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gio-dao-tao-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function MetricCard({ icon, label, value, detail, tone }) {
  return (
    <article className={`training-kpi training-kpi--${tone}`}>
      <span className="training-kpi__icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function DashboardContent({ role }) {
  const isManager = role === 'manager'
  const [profile, setProfile] = useState(null)
  const [departments, setDepartments] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [filters, setFilters] = useState({
    departmentId: '',
    professionalFieldId: '',
    fromDate: '',
    toDate: '',
    status: '',
  })
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const managerDepartmentId = profile?.departmentId || ''

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      isManager ? staffApi.getProfile() : trainingApi.getDepartments(),
      trainingApi.getRecordOptions(),
    ]).then(([scopeResult, optionsResult]) => {
      if (cancelled) return
      if (scopeResult.status === 'fulfilled') {
        if (isManager) {
          const managerProfile = responsePayload(scopeResult.value)
          setProfile(managerProfile)
          if (!managerProfile?.departmentId) {
            setError('Tài khoản Manager chưa được gán khoa/phòng nên không thể xem dashboard.')
            setLoading(false)
          }
        }
        else {
          const data = responsePayload(scopeResult.value)
          setDepartments(Array.isArray(data) ? data : data.content || [])
        }
      }
      if (optionsResult.status === 'fulfilled') {
        setProfessionalFields(responsePayload(optionsResult.value).professionalFields || [])
      }
    })
    return () => { cancelled = true }
  }, [isManager])

  const rangeUnsupported = Boolean(filters.fromDate || filters.toDate)

  const loadData = useCallback(async () => {
    if (isManager && !managerDepartmentId) return
    setLoading(true)
    setError('')

    if (rangeUnsupported) {
      setEmployees([])
      setError('Backend chưa hỗ trợ lọc trạng thái giờ đào tạo theo khoảng fromDate/toDate. API hiện chỉ hỗ trợ ảnh chụp tại một ngày bằng tham số asOf.')
      setLoading(false)
      return
    }

    try {
      const rows = await fetchAll({
        departmentId: isManager
          ? managerDepartmentId
          : filters.departmentId || undefined,
        professionalFieldId: filters.professionalFieldId || undefined,
        asOf: new Date().toISOString().slice(0, 10),
      })
      setEmployees(rows.map(normalizeEmployee))
    } catch {
      setEmployees([])
      setError('Không thể tải thống kê giờ đào tạo từ máy chủ.')
    } finally {
      setLoading(false)
    }
  }, [filters.departmentId, filters.professionalFieldId, isManager, managerDepartmentId, rangeUnsupported])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    if (filters.status === 'COMPLETED') return employee.completed
    if (filters.status === 'INCOMPLETE') return !employee.completed
    return true
  }), [employees, filters.status])

  const metrics = useMemo(() => {
    const completed = filteredEmployees.filter((employee) => employee.completed).length
    const incomplete = filteredEmployees.length - completed
    const totalHours = filteredEmployees.reduce((sum, employee) => sum + employee.completedHours, 0)
    const totalTarget = filteredEmployees.length * TARGET_HOURS
    return {
      total: filteredEmployees.length,
      completed,
      incomplete,
      totalHours,
      totalTarget,
      rate: filteredEmployees.length ? completed * 100 / filteredEmployees.length : 0,
    }
  }, [filteredEmployees])

  const departmentData = useMemo(() => {
    const groups = new Map()
    filteredEmployees.forEach((employee) => {
      const current = groups.get(employee.departmentName) || { total: 0, completed: 0 }
      current.total += 1
      if (employee.completed) current.completed += 1
      groups.set(employee.departmentName, current)
    })
    return [...groups.entries()]
      .map(([name, value]) => ({
        name,
        total: value.total,
        rate: value.total ? Math.round(value.completed * 1000 / value.total) / 10 : 0,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 12)
  }, [filteredEmployees])

  const completionData = [
    { name: 'Đủ 120 giờ', value: metrics.completed, color: '#10a77d' },
    { name: 'Chưa đủ 120 giờ', value: metrics.incomplete, color: '#ef4444' },
  ]

  return (
    <div className="training-dashboard">
      <section className="training-dashboard__hero">
        <div>
          <span>VIETDUC CARE TRAINING</span>
          <h1>Dashboard giờ đào tạo</h1>
          <p>
            {isManager
              ? `Theo dõi tiến độ 120 giờ của nhân sự ${profile?.departmentName ? `tại ${profile.departmentName}` : 'trong khoa quản lý'}.`
              : 'Theo dõi tiến độ hoàn thành 120 giờ đào tạo trên toàn viện hoặc theo từng khoa.'}
          </p>
        </div>
        <button type="button" onClick={() => exportCsv(filteredEmployees)} disabled={loading || filteredEmployees.length === 0}>
          <DownloadOutlined /> Xuất danh sách theo bộ lọc
        </button>
      </section>

      <section className="training-dashboard__filters" aria-label="Bộ lọc dashboard giờ đào tạo">
        <label>
          <span>Khoa/Phòng</span>
          {isManager ? (
            <div>{profile?.departmentName || 'Khoa của tôi'}</div>
          ) : (
            <select value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}>
              <option value="">Toàn viện</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          )}
        </label>
        <label>
          <span>Lĩnh vực chuyên môn</span>
          <select value={filters.professionalFieldId} onChange={(event) => setFilters((current) => ({ ...current, professionalFieldId: event.target.value }))}>
            <option value="">Tất cả lĩnh vực</option>
            {professionalFields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
          </select>
        </label>
        <label>
          <span>Từ ngày</span>
          <input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} />
        </label>
        <label>
          <span>Đến ngày</span>
          <input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} />
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="COMPLETED">Đủ 120 giờ</option>
            <option value="INCOMPLETE">Chưa đủ 120 giờ</option>
          </select>
        </label>
      </section>

      {error && <div className="training-dashboard__alert"><ExclamationCircleOutlined /> {error}</div>}

      {loading ? (
        <div className="training-dashboard__loading"><LoadingOutlined spin /> Đang tải thống kê đào tạo...</div>
      ) : (
        <>
          <section className="training-dashboard__kpis">
            <MetricCard icon={<TeamOutlined />} label="Nhân viên trong phạm vi" value={metrics.total.toLocaleString('vi-VN')} detail="Theo bộ lọc đang chọn" tone="blue" />
            <MetricCard icon={<CheckCircleOutlined />} label="Đã đủ 120 giờ" value={metrics.completed.toLocaleString('vi-VN')} detail={`${metrics.rate.toFixed(1).replace('.', ',')}% nhân viên hoàn thành`} tone="green" />
            <MetricCard icon={<ExclamationCircleOutlined />} label="Chưa đủ 120 giờ" value={metrics.incomplete.toLocaleString('vi-VN')} detail="Cần tiếp tục bổ sung giờ" tone="red" />
            <MetricCard icon={<ClockCircleOutlined />} label="Tổng giờ hoàn thành" value={metrics.totalHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} detail={`Mục tiêu cộng dồn ${metrics.totalTarget.toLocaleString('vi-VN')} giờ`} tone="amber" />
          </section>

          {metrics.total === 0 ? (
            <section className="training-dashboard__empty">
              <SafetyCertificateOutlined />
              <strong>Chưa có dữ liệu đào tạo phù hợp</strong>
              <span>Dữ liệu sẽ hiển thị khi backend trả kết quả theo phạm vi bộ lọc.</span>
            </section>
          ) : (
            <section className="training-dashboard__charts">
              <article className="training-chart-card">
                <header><h2>Tiến độ hoàn thành 120 giờ</h2><span>{metrics.rate.toFixed(1).replace('.', ',')}%</span></header>
                <ResponsiveContainer width="100%" height={270}>
                  <PieChart>
                    <Pie data={completionData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={102} paddingAngle={2} stroke="none">
                      {completionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} nhân viên`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="training-chart-card__legend">
                  {completionData.map((entry) => <span key={entry.name}><i style={{ background: entry.color }} />{entry.name}: <b>{entry.value}</b></span>)}
                </div>
              </article>

              <article className="training-chart-card training-chart-card--wide">
                <header><h2>Tỷ lệ hoàn thành theo khoa</h2><span>Tối đa 12 khoa</span></header>
                {departmentData.length === 0 ? (
                  <div className="training-dashboard__empty training-dashboard__empty--compact">Backend chưa trả dữ liệu khoa trong phạm vi này.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={310}>
                    <BarChart data={departmentData} margin={{ top: 24, right: 12, left: 0, bottom: 48 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e6edf4" />
                      <XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Tỷ lệ hoàn thành']} />
                      <Bar dataKey="rate" radius={[7, 7, 0, 0]} maxBarSize={46}>
                        {departmentData.map((entry) => <Cell key={entry.name} fill={entry.rate >= 100 ? '#10a77d' : '#ef4444'} />)}
                        <LabelList dataKey="rate" position="top" formatter={(value) => `${value}%`} fill="#334155" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </article>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default function TrainingDashboardPage({ role = 'admin' }) {
  const isManager = role === 'manager'
  return (
    <div className="dashboard-layout training-dashboard-page">
      {isManager ? <Sidebar /> : <AdminSidebar />}
      <div className="dashboard-layout__content">
        {isManager
          ? <Header title="Dashboard giờ đào tạo" />
          : <AdminHeader breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Dashboard giờ đào tạo' }]} />}
        <div className={isManager ? 'dashboard-layout__body' : 'dashboard-root'}>
          {isManager ? <DashboardContent role={role} /> : <main className="dashboard-body"><DashboardContent role={role} /></main>}
        </div>
      </div>
    </div>
  )
}
