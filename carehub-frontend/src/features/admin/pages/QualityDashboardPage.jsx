import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import { adminApi } from '../api/adminApi'
import '../styles/QualityDashboardPage.css'

const COMPLIANCE_TARGET = 90
const WARNING_THRESHOLD = 80
const PAGE_SIZE = 100

const RESULT_LABELS = {
  PASSED: 'Đạt',
  FAILED_SCORE: 'Không đạt điểm',
  FAILED_CRITICAL: 'Không đạt tiêu chí trọng yếu',
}

const RESULT_COLORS = {
  PASSED: '#16b889',
  FAILED_SCORE: '#f59e0b',
  FAILED_CRITICAL: '#ef4444',
  UNGRADED: '#94a3b8',
}

const DEFAULT_DEPARTMENT = {
  id: 'all',
  name: 'Toàn viện',
}

function getPageContent(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function getPageTotalPages(response) {
  const totalPages = Number(response?.data?.data?.totalPages)
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1
}

async function fetchAllPages(fetcher, baseParams = {}) {
  const firstResponse = await fetcher({ ...baseParams, page: 0, size: PAGE_SIZE })
  const firstContent = getPageContent(firstResponse)
  const totalPages = getPageTotalPages(firstResponse)

  if (totalPages <= 1) return firstContent

  const restResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetcher({ ...baseParams, page: index + 1, size: PAGE_SIZE }),
    ),
  )

  return [...firstContent, ...restResponses.flatMap((response) => getPageContent(response))]
}

function normalizeText(value) {
  return String(value || '').trim()
}

function getDepartmentName(department) {
  if (!department) return ''
  if (typeof department === 'string') return normalizeText(department)
  return normalizeText(department.name || department.departmentName || department.title)
}

function getSubmissionDepartmentName(submission) {
  return (
    getDepartmentName(submission?.subject?.department)
    || normalizeText(submission?.subject?.departmentName)
    || normalizeText(submission?.departmentName)
    || 'Chưa xác định'
  )
}

function getSubmittedAt(submission) {
  const dateValue = submission?.submittedAt || submission?.updatedAt || submission?.createdAt
  const date = dateValue ? new Date(dateValue) : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

function formatDateLabel(date) {
  if (!date) return 'Chưa rõ'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return 'Chưa rõ thời gian'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatPercent(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '0%'
  return `${numberValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`
}

function formatScore(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '--'
  return numberValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function getComplianceRate(items) {
  if (!items.length) return 0
  const passed = items.filter((item) => item.result === 'PASSED').length
  return (passed / items.length) * 100
}

function getAverageScore(items) {
  const scores = items
    .map((item) => Number(item.convertedScore))
    .filter((score) => Number.isFinite(score))

  if (!scores.length) return null
  return scores.reduce((total, score) => total + score, 0) / scores.length
}

function getResultLabel(result) {
  return RESULT_LABELS[result] || 'Chưa chấm'
}

function buildTrendData(submissions) {
  const groups = new Map()

  submissions.forEach((submission) => {
    const date = getSubmittedAt(submission)
    const key = date ? date.toISOString().slice(0, 10) : 'unknown'
    const current = groups.get(key) || {
      key,
      label: formatDateLabel(date),
      submissions: [],
    }

    current.submissions.push(submission)
    groups.set(key, current)
  })

  return [...groups.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(-10)
    .map((group) => ({
      label: group.label,
      compliance: Number(getComplianceRate(group.submissions).toFixed(1)),
      qualityScore: Number((getAverageScore(group.submissions) || 0).toFixed(2)),
      total: group.submissions.length,
    }))
}

function buildDepartmentData(submissions) {
  const groups = new Map()

  submissions.forEach((submission) => {
    const departmentName = getSubmissionDepartmentName(submission)
    const current = groups.get(departmentName) || []
    current.push(submission)
    groups.set(departmentName, current)
  })

  return [...groups.entries()]
    .map(([departmentName, items]) => ({
      departmentName,
      compliance: Number(getComplianceRate(items).toFixed(1)),
      qualityScore: Number((getAverageScore(items) || 0).toFixed(2)),
      total: items.length,
      failed: items.filter((item) => item.result && item.result !== 'PASSED').length,
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8)
}

function buildResultData(submissions) {
  const counts = submissions.reduce((accumulator, submission) => {
    const key = submission.result || 'UNGRADED'
    accumulator[key] = (accumulator[key] || 0) + 1
    return accumulator
  }, {})

  return Object.entries(counts).map(([result, value]) => ({
    result,
    name: getResultLabel(result),
    value,
  }))
}

function buildAlerts(submissions, departmentData) {
  const criticalAlerts = submissions
    .filter((submission) => submission.result === 'FAILED_CRITICAL')
    .slice(0, 5)
    .map((submission) => ({
      id: `critical-${submission.id}`,
      tone: 'danger',
      title: 'Không đạt tiêu chí trọng yếu',
      description: submission.subject?.fullName || submission.formTitle || 'Response cần kiểm tra',
      meta: `${getSubmissionDepartmentName(submission)} · ${formatDateTime(submission.submittedAt || submission.updatedAt)}`,
    }))

  const departmentAlerts = departmentData
    .filter((department) => department.total > 0 && department.compliance < WARNING_THRESHOLD)
    .slice(0, 4)
    .map((department) => ({
      id: `department-${department.departmentName}`,
      tone: 'warning',
      title: `${department.departmentName} dưới ngưỡng cảnh báo`,
      description: `Tỷ lệ tuân thủ ${formatPercent(department.compliance)}`,
      meta: `${department.total} response · ${department.failed} không đạt`,
    }))

  return [...criticalAlerts, ...departmentAlerts].slice(0, 6)
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="quality-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey || entry.name}>
          <i style={{ background: entry.color }} />
          {entry.name}: {entry.dataKey === 'qualityScore' ? formatScore(entry.value) : formatPercent(entry.value)}
        </span>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="quality-dashboard-skeleton" aria-label="Đang tải dashboard chất lượng">
      {Array.from({ length: 4 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  )
}

function QualityMetricCard({ icon, tone, label, value, helper }) {
  return (
    <article className={`quality-kpi-card quality-kpi-card--${tone}`}>
      <span className="quality-kpi-card__icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  )
}

function QualityDashboardPage() {
  const requestIdRef = useRef(0)
  const [submissions, setSubmissions] = useState([])
  const [departments, setDepartments] = useState([])
  const [forms, setForms] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(DEFAULT_DEPARTMENT.id)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadDashboard = useCallback(async ({ refresh = false } = {}) => {
    const requestId = ++requestIdRef.current

    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setErrorMessage('')

    try {
      const [nextSubmissions, departmentsResponse, nextForms] = await Promise.all([
        fetchAllPages((params) => adminApi.getFormSubmissions(params), { status: 'SUBMITTED' }),
        adminApi.getDepartments(),
        fetchAllPages((params) => adminApi.getForms(params), { status: 'PUBLISHED' }),
      ])

      if (requestId !== requestIdRef.current) return

      const departmentData = departmentsResponse.data?.data
      setSubmissions(nextSubmissions)
      setDepartments(Array.isArray(departmentData) ? departmentData : [])
      setForms(nextForms)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setSubmissions([])
      setDepartments([])
      setForms([])
      setErrorMessage(error?.response?.data?.message || 'Không thể tải dashboard chất lượng. Vui lòng thử lại.')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      requestIdRef.current += 1
    }
  }, [loadDashboard])

  const departmentOptions = useMemo(() => {
    const apiDepartments = departments
      .map((department) => ({
        id: String(department.id ?? getDepartmentName(department)),
        name: getDepartmentName(department),
      }))
      .filter((department) => department.name)

    const submissionDepartments = [...new Set(submissions.map(getSubmissionDepartmentName))]
      .filter(Boolean)
      .map((name) => ({ id: name, name }))

    const optionMap = new Map()
    ;[...apiDepartments, ...submissionDepartments].forEach((department) => {
      if (!optionMap.has(department.name)) {
        optionMap.set(department.name, department)
      }
    })

    return [DEFAULT_DEPARTMENT, ...optionMap.values()]
  }, [departments, submissions])

  const filteredSubmissions = useMemo(() => {
    if (selectedDepartment === DEFAULT_DEPARTMENT.id) return submissions
    const selectedOption = departmentOptions.find((department) => department.id === selectedDepartment)
    const selectedName = selectedOption?.name || selectedDepartment

    return submissions.filter((submission) => getSubmissionDepartmentName(submission) === selectedName)
  }, [departmentOptions, selectedDepartment, submissions])

  const departmentData = useMemo(() => buildDepartmentData(submissions), [submissions])
  const scopedDepartmentData = useMemo(() => buildDepartmentData(filteredSubmissions), [filteredSubmissions])
  const trendData = useMemo(() => buildTrendData(filteredSubmissions), [filteredSubmissions])
  const resultData = useMemo(() => buildResultData(filteredSubmissions), [filteredSubmissions])
  const alerts = useMemo(() => buildAlerts(filteredSubmissions, scopedDepartmentData), [filteredSubmissions, scopedDepartmentData])

  const metrics = useMemo(() => {
    const compliance = getComplianceRate(filteredSubmissions)
    const averageScore = getAverageScore(filteredSubmissions)
    const passed = filteredSubmissions.filter((item) => item.result === 'PASSED').length
    const critical = filteredSubmissions.filter((item) => item.result === 'FAILED_CRITICAL').length
    const targetGap = compliance - COMPLIANCE_TARGET

    return {
      total: filteredSubmissions.length,
      passed,
      critical,
      compliance,
      averageScore,
      targetGap,
    }
  }, [filteredSubmissions])

  const departmentsUnderTarget = departmentData.filter((department) => department.compliance < COMPLIANCE_TARGET)

  return (
    <div className="dashboard-layout quality-dashboard-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          breadcrumbs={[
            { label: 'Dashboard & Báo cáo' },
            { label: 'Dashboard chất lượng' },
          ]}
        />

        <main className="quality-dashboard">
          <section className="quality-dashboard-hero">
            <div>
              <span>VietDuc Care Quality Center</span>
              <h1>Dashboard chất lượng chăm sóc</h1>
              <p>Theo dõi tuân thủ quy trình kỹ thuật, điểm chất lượng và cảnh báo đỏ theo toàn viện hoặc từng khoa.</p>
            </div>
            <div className="quality-dashboard-hero__actions">
              <label>
                <ApartmentOutlined />
                <select
                  value={selectedDepartment}
                  onChange={(event) => setSelectedDepartment(event.target.value)}
                >
                  {departmentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={refreshing} onClick={() => loadDashboard({ refresh: true })} type="button">
                {refreshing ? <LoadingOutlined /> : <ReloadOutlined />}
                Làm mới
              </button>
            </div>
          </section>

          {errorMessage && (
            <div className="quality-dashboard-alert" role="alert">
              <ExclamationCircleOutlined />
              {errorMessage}
            </div>
          )}

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <section className="quality-kpi-grid">
                <QualityMetricCard
                  icon={<SafetyCertificateOutlined />}
                  label="Tỷ lệ tuân thủ"
                  tone="primary"
                  value={formatPercent(metrics.compliance)}
                  helper={`${metrics.passed}/${metrics.total} response đạt`}
                />
                <QualityMetricCard
                  icon={<BarChartOutlined />}
                  label="Điểm chất lượng"
                  tone="success"
                  value={`${formatScore(metrics.averageScore)} điểm`}
                  helper="Điểm quy đổi trung bình"
                />
                <QualityMetricCard
                  icon={<RiseOutlined />}
                  label="So với mục tiêu"
                  tone={metrics.targetGap >= 0 ? 'success' : 'warning'}
                  value={`${metrics.targetGap >= 0 ? '+' : ''}${formatPercent(metrics.targetGap)}`}
                  helper={`Mục tiêu tuân thủ ${COMPLIANCE_TARGET}%`}
                />
                <QualityMetricCard
                  icon={<AlertOutlined />}
                  label="Cảnh báo đỏ"
                  tone="danger"
                  value={metrics.critical}
                  helper={`${departmentsUnderTarget.length} khoa dưới mục tiêu`}
                />
              </section>

              <section className="quality-dashboard-grid">
                <article className="quality-panel quality-panel--wide quality-panel--animated">
                  <header className="quality-panel__header">
                    <div>
                      <h2>Tỷ lệ tuân thủ theo thời gian</h2>
                      <p>Đường tuân thủ được vẽ từ trái sang phải khi mở dashboard.</p>
                    </div>
                    <span>{filteredSubmissions.length} response</span>
                  </header>

                  {trendData.length ? (
                    <ResponsiveContainer height={260} width="100%">
                      <AreaChart data={trendData} margin={{ top: 16, right: 20, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="complianceGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#16b889" stopOpacity={0.24} />
                            <stop offset="100%" stopColor="#16b889" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="scoreGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e6edf5" strokeDasharray="4 6" vertical={false} />
                        <XAxis axisLine={false} dataKey="label" tickLine={false} />
                        <YAxis
                          axisLine={false}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                          tickLine={false}
                          yAxisId="rate"
                        />
                        <YAxis
                          axisLine={false}
                          orientation="right"
                          tickFormatter={(value) => formatScore(value)}
                          tickLine={false}
                          width={48}
                          yAxisId="score"
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Area
                          animationBegin={450}
                          animationDuration={1200}
                          dataKey="compliance"
                          fill="url(#complianceGradient)"
                          name="Tỷ lệ tuân thủ"
                          stroke="#16b889"
                          strokeWidth={3}
                          type="monotone"
                          yAxisId="rate"
                        />
                        <Area
                          animationBegin={650}
                          animationDuration={1200}
                          dataKey="qualityScore"
                          fill="url(#scoreGradient)"
                          name="Điểm chất lượng"
                          stroke="#2563eb"
                          strokeWidth={3}
                          type="monotone"
                          yAxisId="score"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="quality-empty-state">
                      <FieldTimeOutlined />
                      <span>Chưa có dữ liệu response để vẽ biểu đồ.</span>
                    </div>
                  )}
                </article>

                <article className="quality-panel">
                  <header className="quality-panel__header">
                    <div>
                      <h2>Phân bố kết quả</h2>
                      <p>Đạt, không đạt điểm và không đạt tiêu chí trọng yếu.</p>
                    </div>
                  </header>
                  {resultData.length ? (
                    <ResponsiveContainer height={218} width="100%">
                      <PieChart>
                        <Pie
                          animationBegin={700}
                          animationDuration={900}
                          cx="50%"
                          cy="50%"
                          data={resultData}
                          dataKey="value"
                          innerRadius={62}
                          outerRadius={88}
                          paddingAngle={1.5}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {resultData.map((entry) => (
                            <Cell fill={RESULT_COLORS[entry.result] || RESULT_COLORS.UNGRADED} key={entry.result} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="quality-empty-state">
                      <CheckCircleOutlined />
                      <span>Chưa có kết quả đánh giá.</span>
                    </div>
                  )}
                </article>

                <article className="quality-panel quality-panel--wide">
                  <header className="quality-panel__header">
                    <div>
                      <h2>So sánh tuân thủ theo khoa</h2>
                      <p>Ưu tiên hiển thị các khoa có nhiều response nhất.</p>
                    </div>
                  </header>
                  {departmentData.length ? (
                    <ResponsiveContainer height={280} width="100%">
                      <ComposedChart
                        barCategoryGap={28}
                        data={departmentData}
                        margin={{ top: 34, right: 22, left: -14, bottom: 24 }}
                      >
                        <CartesianGrid stroke="#edf3f8" strokeDasharray="4 8" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="departmentName"
                          interval={0}
                          tick={{ fill: '#475569', fontSize: 11 }}
                          tickLine={false}
                          tickMargin={12}
                        />
                        <YAxis
                          axisLine={false}
                          domain={[0, 100]}
                          tick={{ fill: '#8190a5', fontSize: 12 }}
                          tickFormatter={(value) => `${value}%`}
                          tickLine={false}
                          yAxisId="rate"
                        />
                        <YAxis
                          axisLine={false}
                          orientation="right"
                          tick={{ fill: '#8190a5', fontSize: 12 }}
                          tickLine={false}
                          yAxisId="total"
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(15, 159, 122, 0.06)' }}
                          formatter={(value, name) => (
                            name === 'Số response'
                              ? [`${value} response`, name]
                              : [formatPercent(value), name]
                          )}
                        />
                        <Legend />
                        <Bar
                          animationBegin={650}
                          animationDuration={900}
                          background={{ fill: '#eef5f8', radius: [10, 10, 0, 0] }}
                          barSize={34}
                          dataKey="compliance"
                          name="Tỷ lệ tuân thủ"
                          radius={[10, 10, 0, 0]}
                          yAxisId="rate"
                        >
                          <LabelList
                            className="quality-bar-label"
                            dataKey="compliance"
                            formatter={(value) => formatPercent(value)}
                            position="top"
                          />
                          {departmentData.map((entry) => (
                            <Cell fill={entry.compliance >= COMPLIANCE_TARGET ? '#16b889' : '#f97316'} key={entry.departmentName} />
                          ))}
                        </Bar>
                        <Line
                          animationBegin={820}
                          animationDuration={1000}
                          dataKey="total"
                          dot={{ fill: '#ffffff', r: 4, stroke: '#4d8dff', strokeWidth: 2 }}
                          name="Số response"
                          stroke="#4d8dff"
                          strokeWidth={2.5}
                          type="monotone"
                          yAxisId="total"
                        >
                          <LabelList
                            className="quality-line-label"
                            dataKey="total"
                            formatter={(value) => `${value}`}
                            position="top"
                          />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="quality-empty-state">
                      <ApartmentOutlined />
                      <span>Chưa có dữ liệu theo khoa.</span>
                    </div>
                  )}
                </article>

                <article className="quality-panel quality-alert-panel">
                  <header className="quality-panel__header">
                    <div>
                      <h2>Danh sách cảnh báo đỏ</h2>
                      <p>Các điểm cần admin ưu tiên xử lý.</p>
                    </div>
                  </header>

                  {alerts.length ? (
                    <div className="quality-alert-list">
                      {alerts.map((alert) => (
                        <article className={`quality-alert-item quality-alert-item--${alert.tone}`} key={alert.id}>
                          <span><ExclamationCircleOutlined /></span>
                          <div>
                            <strong>{alert.title}</strong>
                            <p>{alert.description}</p>
                            <small>{alert.meta}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="quality-empty-state">
                      <CheckCircleOutlined />
                      <span>Không có cảnh báo đỏ trong phạm vi đang xem.</span>
                    </div>
                  )}
                </article>
              </section>

              <section className="quality-dashboard-footer">
                <article>
                  <strong>{forms.length}</strong>
                  <span>Bảng kiểm đã công bố</span>
                </article>
                <article>
                  <strong>{departmentOptions.length - 1}</strong>
                  <span>Khoa/phòng có dữ liệu</span>
                </article>
                <article>
                  <strong>{filteredSubmissions.length}</strong>
                  <span>Response trong phạm vi lọc</span>
                </article>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default QualityDashboardPage
