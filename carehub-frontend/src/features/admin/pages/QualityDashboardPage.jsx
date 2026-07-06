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

const RESULT_COLORS = {
  PASSED: '#16b889',
  FAILED_SCORE: '#f59e0b',
  FAILED_CRITICAL: '#ef4444',
  DRAFT: '#94a3b8',
  VOIDED: '#64748b',
}

const DEFAULT_DEPARTMENT = {
  id: 'all',
  name: 'Toàn viện',
}

function getApiData(response) {
  return response?.data?.data || null
}

function getPageContent(response) {
  const data = getApiData(response)
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

function getDashboardParams(selectedDepartment) {
  if (selectedDepartment === DEFAULT_DEPARTMENT.id) return {}
  return { departmentId: selectedDepartment }
}

function formatDateLabel(period) {
  if (!period) return 'Chưa rõ'
  const date = new Date(period)
  if (!Number.isFinite(date.getTime())) return period

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatPercent(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '0,0%'
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

function formatCount(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '0'
  return numberValue.toLocaleString('vi-VN')
}

function getPassedFromRate(submitted, passRate) {
  const submittedCount = Number(submitted) || 0
  const rate = Number(passRate) || 0
  return Math.round((submittedCount * rate) / 100)
}

function buildTrendData(trendResponse) {
  return (trendResponse?.items || []).map((item) => {
    const submitted = Number(item.submittedCount) || 0
    const passed = Number(item.passedCount) || 0
    const compliance = submitted > 0 ? (passed / submitted) * 100 : 0

    return {
      label: formatDateLabel(item.period),
      compliance: Number(compliance.toFixed(1)),
      qualityScore: Number((Number(item.averageConvertedScore) || 0).toFixed(2)),
      total: submitted,
      failed: Number(item.failedCount) || 0,
    }
  })
}

function buildFallbackTrendData(submissions) {
  const groups = new Map()

  submissions.forEach((submission) => {
    const date = getSubmittedAt(submission)
    const key = date ? date.toISOString().slice(0, 10) : 'unknown'
    const current = groups.get(key) || {
      key,
      label: formatDateLabel(date),
      submittedCount: 0,
      passedCount: 0,
      failedCount: 0,
      scores: [],
    }

    current.submittedCount += 1
    if (submission.result === 'PASSED') {
      current.passedCount += 1
    } else if (submission.result) {
      current.failedCount += 1
    }

    const score = Number(submission.convertedScore)
    if (Number.isFinite(score)) current.scores.push(score)
    groups.set(key, current)
  })

  return [...groups.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(-10)
    .map((item) => {
      const compliance = item.submittedCount > 0 ? (item.passedCount / item.submittedCount) * 100 : 0
      const averageScore = item.scores.length
        ? item.scores.reduce((total, score) => total + score, 0) / item.scores.length
        : 0

      return {
        period: item.key,
        submittedCount: item.submittedCount,
        passedCount: item.passedCount,
        failedCount: item.failedCount,
        averageConvertedScore: Number(averageScore.toFixed(2)),
        label: item.label,
        compliance: Number(compliance.toFixed(1)),
        qualityScore: Number(averageScore.toFixed(2)),
      }
    })
}

function buildResultData(summary, performanceItems) {
  const responses = summary?.responses || {}
  const submitted = Number(responses.submitted) || 0
  const draft = Number(responses.draft) || 0
  const voided = Number(responses.voided) || 0
  const passed = performanceItems.reduce((total, item) => total + (Number(item.passedCount) || 0), 0)
  const failedScore = performanceItems.reduce((total, item) => total + (Number(item.failedScoreCount) || 0), 0)
  const failedCritical = performanceItems.reduce((total, item) => total + (Number(item.failedCriticalCount) || 0), 0)
  const knownSubmitted = passed + failedScore + failedCritical
  const estimatedPassed = knownSubmitted > 0 ? passed : getPassedFromRate(submitted, responses.passRate)
  const estimatedFailed = Math.max(submitted - estimatedPassed, 0)

  return [
    { result: 'PASSED', name: 'Đạt', value: estimatedPassed },
    { result: 'FAILED_SCORE', name: 'Không đạt', value: knownSubmitted > 0 ? failedScore : estimatedFailed },
    { result: 'FAILED_CRITICAL', name: 'Cảnh báo đỏ', value: failedCritical },
    { result: 'DRAFT', name: 'Bản nháp', value: draft },
    { result: 'VOIDED', name: 'Đã hủy', value: voided },
  ].filter((item) => item.value > 0)
}

function buildPerformanceData(performanceItems) {
  return performanceItems
    .filter((item) => Number(item.responseCount) > 0 || Number(item.submittedCount) > 0)
    .map((item) => ({
      ...item,
      chartLabel: item.formTitle || item.formCode || `Form #${item.formId}`,
      compliance: Number(item.passRate) || 0,
      responseCount: Number(item.responseCount) || 0,
      averageScore: Number(item.averageConvertedScore) || 0,
      failedCritical: Number(item.failedCriticalCount) || 0,
      failedScore: Number(item.failedScoreCount) || 0,
    }))
    .sort((left, right) => right.responseCount - left.responseCount)
    .slice(0, 8)
}

function buildAlerts(performanceItems) {
  return performanceItems
    .filter((item) => (
      Number(item.failedCriticalCount) > 0
      || (Number(item.submittedCount) > 0 && Number(item.passRate) < WARNING_THRESHOLD)
    ))
    .sort((left, right) => {
      const criticalDiff = Number(right.failedCriticalCount) - Number(left.failedCriticalCount)
      if (criticalDiff !== 0) return criticalDiff
      return Number(left.passRate) - Number(right.passRate)
    })
    .slice(0, 6)
    .map((item) => {
      const criticalCount = Number(item.failedCriticalCount) || 0
      const isCritical = criticalCount > 0

      return {
        id: item.formId,
        tone: isCritical ? 'danger' : 'warning',
        title: isCritical ? 'Có tiêu chí trọng yếu không đạt' : 'Tỷ lệ tuân thủ dưới ngưỡng',
        description: item.formTitle || item.formCode || 'Bảng kiểm cần kiểm tra',
        meta: isCritical
          ? `${criticalCount} response cảnh báo đỏ · ${formatPercent(item.passRate)} đạt`
          : `${formatCount(item.submittedCount)} response · ${formatPercent(item.passRate)} đạt`,
      }
    })
}

function buildFallbackDashboard(submissions, forms) {
  const submitted = submissions.length
  const passed = submissions.filter((submission) => submission.result === 'PASSED').length
  const scores = submissions
    .map((submission) => Number(submission.convertedScore))
    .filter((score) => Number.isFinite(score))
  const averageConvertedScore = scores.length
    ? scores.reduce((total, score) => total + score, 0) / scores.length
    : 0
  const passRate = submitted > 0 ? (passed / submitted) * 100 : 0
  const groups = new Map()

  submissions.forEach((submission) => {
    const formId = submission.formId || submission.formTemplateId || submission.formVersionId || submission.id
    const current = groups.get(formId) || {
      formId,
      formCode: submission.formCode,
      formTitle: submission.title || submission.formTitle,
      currentVersionNumber: submission.versionNumber,
      responseCount: 0,
      submittedCount: 0,
      passedCount: 0,
      failedScoreCount: 0,
      failedCriticalCount: 0,
      scores: [],
      lastSubmittedAt: null,
    }

    current.responseCount += 1
    current.submittedCount += 1
    if (submission.result === 'PASSED') current.passedCount += 1
    if (submission.result === 'FAILED_SCORE') current.failedScoreCount += 1
    if (submission.result === 'FAILED_CRITICAL') current.failedCriticalCount += 1

    const score = Number(submission.convertedScore)
    if (Number.isFinite(score)) current.scores.push(score)

    const submittedAt = getSubmittedAt(submission)
    if (submittedAt && (!current.lastSubmittedAt || submittedAt > current.lastSubmittedAt)) {
      current.lastSubmittedAt = submittedAt
    }

    groups.set(formId, current)
  })

  const performanceItems = [...groups.values()].map((item) => {
    const itemPassRate = item.submittedCount > 0 ? (item.passedCount / item.submittedCount) * 100 : 0
    const itemAverageScore = item.scores.length
      ? item.scores.reduce((total, score) => total + score, 0) / item.scores.length
      : 0

    return {
      ...item,
      passRate: Number(itemPassRate.toFixed(2)),
      averageConvertedScore: Number(itemAverageScore.toFixed(4)),
      lastSubmittedAt: item.lastSubmittedAt?.toISOString() || null,
    }
  })

  return {
    summary: {
      forms: {
        published: forms.length,
      },
      assignments: {
        activeItems: 0,
      },
      responses: {
        totalInPeriod: submitted,
        submitted,
        draft: 0,
        voided: 0,
        passRate: Number(passRate.toFixed(2)),
        averageConvertedScore: Number(averageConvertedScore.toFixed(4)),
      },
    },
    trend: {
      bucket: 'DAY',
      items: buildFallbackTrendData(submissions),
    },
    performanceItems,
  }
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="quality-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey || entry.name}>
          <i style={{ background: entry.color }} />
          {entry.name}:{' '}
          {entry.dataKey === 'qualityScore' || entry.dataKey === 'averageScore'
            ? `${formatScore(entry.value)} điểm`
            : formatPercent(entry.value)}
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
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState(null)
  const [performanceItems, setPerformanceItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(DEFAULT_DEPARTMENT.id)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [noticeMessage, setNoticeMessage] = useState('')

  const loadDashboard = useCallback(async ({ refresh = false } = {}) => {
    const requestId = ++requestIdRef.current
    const dashboardParams = getDashboardParams(selectedDepartment)

    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setErrorMessage('')
    setNoticeMessage('')

    try {
      const departmentsResponse = await adminApi.getDepartments()
      const departmentData = departmentsResponse.data?.data
      const nextDepartments = Array.isArray(departmentData) ? departmentData : []

      let nextSummary = null
      let nextTrend = null
      let nextPerformanceItems = []
      let nextNotice = ''

      try {
        const [summaryResponse, trendResponse, performanceResponseItems] = await Promise.all([
          adminApi.getDashboardFormSummary(dashboardParams),
          adminApi.getDashboardFormTrend({ ...dashboardParams, bucket: 'DAY' }),
          fetchAllPages((params) => adminApi.getDashboardFormPerformance(params), {
            ...dashboardParams,
            sort: 'responseCount,desc',
          }),
        ])

        nextSummary = getApiData(summaryResponse)
        nextTrend = getApiData(trendResponse)
        nextPerformanceItems = performanceResponseItems
      } catch {
        const selectedDepartmentName = nextDepartments.find(
          (department) => String(department.id) === selectedDepartment,
        )?.name
        const [submissions, forms] = await Promise.all([
          fetchAllPages((params) => adminApi.getFormSubmissions(params), { status: 'SUBMITTED' }),
          fetchAllPages((params) => adminApi.getForms(params), { status: 'PUBLISHED' }),
        ])
        const scopedSubmissions = selectedDepartment === DEFAULT_DEPARTMENT.id
          ? submissions
          : submissions.filter((submission) => getSubmissionDepartmentName(submission) === selectedDepartmentName)
        const fallbackDashboard = buildFallbackDashboard(scopedSubmissions, forms)

        nextSummary = fallbackDashboard.summary
        nextTrend = fallbackDashboard.trend
        nextPerformanceItems = fallbackDashboard.performanceItems
        nextNotice = 'Dashboard API mới đang trả lỗi, tạm hiển thị dữ liệu dự phòng từ response đã nộp.'
      }

      if (requestId !== requestIdRef.current) return

      setSummary(nextSummary)
      setTrend(nextTrend)
      setPerformanceItems(nextPerformanceItems)
      setDepartments(nextDepartments)
      setNoticeMessage(nextNotice)
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setSummary(null)
      setTrend(null)
      setPerformanceItems([])
      setDepartments([])
      setNoticeMessage('')
      setErrorMessage(error?.response?.data?.message || 'Không thể tải dashboard chất lượng. Vui lòng thử lại.')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [selectedDepartment])

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

    return [DEFAULT_DEPARTMENT, ...apiDepartments]
  }, [departments])

  const trendData = useMemo(() => buildTrendData(trend), [trend])
  const performanceData = useMemo(() => buildPerformanceData(performanceItems), [performanceItems])
  const resultData = useMemo(() => buildResultData(summary, performanceItems), [performanceItems, summary])
  const alerts = useMemo(() => buildAlerts(performanceItems), [performanceItems])

  const metrics = useMemo(() => {
    const responses = summary?.responses || {}
    const forms = summary?.forms || {}
    const submitted = Number(responses.submitted) || 0
    const compliance = Number(responses.passRate) || 0
    const critical = performanceItems.reduce((total, item) => total + (Number(item.failedCriticalCount) || 0), 0)
    const hasResponses = submitted > 0
    const targetGap = hasResponses ? compliance - COMPLIANCE_TARGET : 0
    const targetGapAbs = Math.abs(targetGap)

    return {
      total: submitted,
      hasResponses,
      passed: getPassedFromRate(submitted, compliance),
      critical,
      compliance,
      averageScore: Number(responses.averageConvertedScore) || 0,
      targetGap,
      targetGapAbs,
      publishedForms: Number(forms.published) || 0,
      activeAssignments: Number(summary?.assignments?.activeItems) || 0,
      warningForms: performanceItems.filter((item) => (
        Number(item.submittedCount) > 0 && Number(item.passRate) < COMPLIANCE_TARGET
      )).length,
    }
  }, [performanceItems, summary])

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

          {noticeMessage && (
            <div className="quality-dashboard-alert quality-dashboard-alert--warning" role="status">
              <ExclamationCircleOutlined />
              {noticeMessage}
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
                  helper={`${formatCount(metrics.passed)}/${formatCount(metrics.total)} response đạt`}
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
                  tone={metrics.hasResponses && metrics.targetGap >= 0 ? 'success' : 'warning'}
                  value={metrics.hasResponses ? formatPercent(metrics.targetGapAbs) : '0,0%'}
                  helper={
                    metrics.hasResponses
                      ? `${metrics.targetGap >= 0 ? 'Vượt' : 'Thiếu'} so với mục tiêu ${COMPLIANCE_TARGET}%`
                      : 'Chưa có response để so sánh'
                  }
                />
                <QualityMetricCard
                  icon={<AlertOutlined />}
                  label="Cảnh báo đỏ"
                  tone="danger"
                  value={formatCount(metrics.critical)}
                  helper={`${metrics.warningForms} bảng kiểm dưới mục tiêu`}
                />
              </section>

              <section className="quality-dashboard-grid">
                <article className="quality-panel quality-panel--wide quality-panel--animated">
                  <header className="quality-panel__header">
                    <div>
                      <h2>Tỷ lệ tuân thủ theo thời gian</h2>
                      <p>Dữ liệu lấy từ dashboard API theo ngày và bộ lọc khoa đang chọn.</p>
                    </div>
                    <span>{formatCount(metrics.total)} response</span>
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
                      <p>Tổng hợp trạng thái response trong kỳ thống kê.</p>
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
                            <Cell fill={RESULT_COLORS[entry.result] || RESULT_COLORS.DRAFT} key={entry.result} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${formatCount(value)} response`, 'Số lượng']} />
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
                      <h2>So sánh tuân thủ theo bảng kiểm</h2>
                      <p>Hiển thị các bảng kiểm có response, kèm số response để nhìn mức độ sử dụng.</p>
                    </div>
                  </header>
                  {performanceData.length ? (
                    <ResponsiveContainer height={280} width="100%">
                      <ComposedChart
                        barCategoryGap={28}
                        data={performanceData}
                        margin={{ top: 34, right: 22, left: -14, bottom: 24 }}
                      >
                        <CartesianGrid stroke="#edf3f8" strokeDasharray="4 8" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="chartLabel"
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
                              ? [`${formatCount(value)} response`, name]
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
                          {performanceData.map((entry) => (
                            <Cell fill={entry.compliance >= COMPLIANCE_TARGET ? '#16b889' : '#f97316'} key={entry.formId} />
                          ))}
                        </Bar>
                        <Line
                          animationBegin={820}
                          animationDuration={1000}
                          dataKey="responseCount"
                          dot={{ fill: '#ffffff', r: 4, stroke: '#4d8dff', strokeWidth: 2 }}
                          name="Số response"
                          stroke="#4d8dff"
                          strokeWidth={2.5}
                          type="monotone"
                          yAxisId="total"
                        >
                          <LabelList
                            className="quality-line-label"
                            dataKey="responseCount"
                            formatter={(value) => `${value}`}
                            position="top"
                          />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="quality-empty-state">
                      <ApartmentOutlined />
                      <span>Chưa có bảng kiểm nào có response.</span>
                    </div>
                  )}
                </article>

                <article className="quality-panel quality-alert-panel">
                  <header className="quality-panel__header">
                    <div>
                      <h2>Danh sách cảnh báo đỏ</h2>
                      <p>Các bảng kiểm cần admin ưu tiên kiểm tra.</p>
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
                  <strong>{formatCount(metrics.publishedForms)}</strong>
                  <span>Bảng kiểm đã công bố</span>
                </article>
                <article>
                  <strong>{formatCount(metrics.activeAssignments)}</strong>
                  <span>Lượt phân quyền đang hiệu lực</span>
                </article>
                <article>
                  <strong>{formatCount(metrics.total)}</strong>
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
