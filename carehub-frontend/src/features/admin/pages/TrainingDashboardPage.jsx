import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircleOutlined,
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
import AppShell from '../../../shared/components/AppShell.jsx'
import { staffApi } from '../../staff/api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import '../styles/TrainingDashboardPage.css'

const PAGE_SIZE = 100
const today = new Date().toISOString().slice(0, 10)

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
  return {
    id: item.employeeId,
    code: item.employeeCode || '',
    name: item.employeeName || '',
    departmentName: item.departmentName || 'Chưa xác định',
    positionName: item.positionName || item.jobPositionName || '',
    requiredHours: Number(item.requiredHours) || 0,
    completedHours: Number(item.submittedHours) || 0,
    missingHours: Number(item.remainingHours) || 0,
    complianceStatus: item.complianceStatus === 'COMPLIANT' ? 'COMPLIANT' : 'NON_COMPLIANT',
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
    row.requiredHours,
    row.missingHours,
    {
      COMPLIANT: 'Đạt',
      NON_COMPLIANT: 'Chưa đạt',
    }[row.complianceStatus] || row.complianceStatus,
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
    asOf: today,
    status: '',
  })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
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

  const loadData = useCallback(async () => {
    if (isManager && !managerDepartmentId) return
    setLoading(true)
    setError('')

    try {
      const response = await trainingApi.getTrainingDashboardSummary({
        departmentId: isManager
          ? managerDepartmentId
          : filters.departmentId || undefined,
        professionalFieldId: filters.professionalFieldId || undefined,
        complianceStatus: filters.status || undefined,
        asOf: filters.asOf || undefined,
      })
      setSummary(responsePayload(response))
    } catch {
      setSummary(null)
      setError('Không thể tải thống kê giờ đào tạo từ máy chủ.')
    } finally {
      setLoading(false)
    }
  }, [filters.asOf, filters.departmentId, filters.professionalFieldId, filters.status, isManager, managerDepartmentId])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const totals = summary?.totals || {}
  const metrics = {
    total: Number(totals.employeeCount) || 0,
    configured: Number(totals.configuredCount) || 0,
    notConfigured: Number(totals.notConfiguredCount) || 0,
    completed: Number(totals.compliantCount) || 0,
    atRisk: Number(totals.atRiskCount) || 0,
    incomplete: Number(totals.nonCompliantCount) || 0,
    totalHours: Number(totals.submittedHours) || 0,
    totalTarget: Number(totals.requiredHours) || 0,
    remainingHours: Number(totals.remainingHours) || 0,
    rate: Number(totals.complianceRate) || 0,
  }

  const departmentData = useMemo(() => {
    return (summary?.byDepartment || [])
      .map((item) => ({
        name: item.departmentName || 'Chưa xác định',
        total: Number(item.employeeCount) || 0,
        rate: Number(item.complianceRate) || 0,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 12)
  }, [summary])

  const completionData = [
    { name: 'Đạt', value: metrics.completed, color: '#10a77d' },
    { name: 'Chưa đạt', value: metrics.total - metrics.completed, color: '#ef4444' },
  ]

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const rows = await fetchAll({
        departmentId: isManager ? managerDepartmentId : filters.departmentId || undefined,
        professionalFieldId: filters.professionalFieldId || undefined,
        complianceStatus: filters.status || undefined,
        asOf: filters.asOf || undefined,
      })
      exportCsv(rows.map(normalizeEmployee))
    } catch {
      setError('Không thể tải danh sách nhân viên để xuất báo cáo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="training-dashboard">
      <section className="training-dashboard__hero">
        <div>
          <span>VIETDUC CARE TRAINING</span>
          <h1>Dashboard giờ đào tạo</h1>
          <p>
            {isManager
              ? `Theo dõi mức độ đáp ứng chuẩn đào tạo của nhân sự ${profile?.departmentName ? `tại ${profile.departmentName}` : 'trong khoa quản lý'}.`
              : 'Theo dõi mức độ đáp ứng chuẩn giờ đào tạo đang áp dụng trên toàn viện hoặc theo từng khoa.'}
          </p>
        </div>
        <button type="button" onClick={handleExport} disabled={loading || exporting || metrics.total === 0}>
          {exporting ? <LoadingOutlined spin /> : <DownloadOutlined />} {exporting ? 'Đang chuẩn bị...' : 'Xuất danh sách theo bộ lọc'}
        </button>
      </section>

      <section className="training-dashboard__filters" aria-label="Bộ lọc dashboard giờ đào tạo">
        <label>
          <span>Khoa/Phòng</span>
          {isManager ? (
            <div>{profile?.departmentName || 'Khoa của tôi'}</div>
          ) : (
            <SearchableSelect
              value={filters.departmentId}
              onChange={(value) => setFilters((current) => ({ ...current, departmentId: value }))}
              options={[
                { value: '', label: 'Toàn viện' },
                ...departments.map((department) => ({ value: department.id, label: department.name })),
              ]}
              placeholder="Toàn viện"
              searchPlaceholder="Tìm tên khoa/phòng..."
              ariaLabel="Tìm và chọn khoa/phòng"
            />
          )}
        </label>
        <label>
          <span>Lĩnh vực chuyên môn</span>
          <SearchableSelect
            value={filters.professionalFieldId}
            onChange={(value) => setFilters((current) => ({ ...current, professionalFieldId: value }))}
            options={[
              { value: '', label: 'Tất cả lĩnh vực' },
              ...professionalFields.map((field) => ({ value: field.id, label: field.name })),
            ]}
            placeholder="Tất cả lĩnh vực"
            searchPlaceholder="Tìm tên lĩnh vực..."
            ariaLabel="Tìm và chọn lĩnh vực chuyên môn"
          />
        </label>
        <label>
          <span>Tính đến ngày</span>
          <input type="date" value={filters.asOf} max={today} onChange={(event) => setFilters((current) => ({ ...current, asOf: event.target.value }))} />
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="COMPLIANT">Đạt</option>
            <option value="NON_COMPLIANT">Chưa đạt</option>
          </select>
        </label>
      </section>

      {error && <div className="training-dashboard__alert"><ExclamationCircleOutlined /> {error}</div>}

      {loading ? (
        <div className="training-dashboard__loading"><LoadingOutlined spin /> Đang tải thống kê đào tạo...</div>
      ) : (
        <>
          <section className="training-dashboard__kpis">
            <MetricCard icon={<TeamOutlined />} label="Tổng nhân viên" value={metrics.total.toLocaleString('vi-VN')} detail="Theo bộ lọc đang chọn" tone="blue" />
            <MetricCard icon={<CheckCircleOutlined />} label="Đạt" value={metrics.completed.toLocaleString('vi-VN')} detail={`${metrics.rate.toFixed(1).replace('.', ',')}% nhân viên`} tone="green" />
            <MetricCard icon={<ExclamationCircleOutlined />} label="Chưa đạt" value={(metrics.total - metrics.completed).toLocaleString('vi-VN')} detail="Cần theo dõi tiến độ" tone="red" />
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
                <header><h2>Phân bố Đạt/Chưa đạt</h2><span>{metrics.rate.toFixed(1).replace('.', ',')}%</span></header>
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
                  <div className="training-dashboard__empty training-dashboard__empty--compact">Chưa có dữ liệu theo khoa trong phạm vi này.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={310}>
                    <BarChart data={departmentData} margin={{ top: 24, right: 12, left: 0, bottom: 48 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e6edf4" />
                      <XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={(value) => [`${value}%`, 'Tỷ lệ hoàn thành']} />
                      <Bar dataKey="rate" radius={[7, 7, 0, 0]} maxBarSize={46}>
                        {departmentData.map((entry) => <Cell key={entry.name} fill={entry.rate >= 80 ? '#10a77d' : '#ef4444'} />)}
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
    <AppShell
      title={isManager ? 'Dashboard giờ đào tạo' : undefined}
      breadcrumbs={isManager ? undefined : [{ label: 'Dashboard & Báo cáo' }, { label: 'Dashboard giờ đào tạo' }]}
    >
      <DashboardContent role={role} />
    </AppShell>
  )
}
