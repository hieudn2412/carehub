import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApartmentOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  ImportOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import '../styles/AdminDashboard.css'

const NUMBER_FORMATTER = new Intl.NumberFormat('vi-VN')
const STATUS_COLORS = {
  ACTIVE: '#24b894',
  INACTIVE: '#f2b84b',
  LOCKED: '#f06b6b',
}
const TREND_ANIMATION = {
  begin: 500,
  accessDuration: 1050,
  checklistDuration: 1150,
  dotDuration: 220,
}

const TREND_DATA = {
  '7d': [
    { label: 'T2', access: 64, checklist: 32 },
    { label: 'T3', access: 82, checklist: 41 },
    { label: 'T4', access: 75, checklist: 52 },
    { label: 'T5', access: 108, checklist: 47 },
    { label: 'T6', access: 91, checklist: 61 },
    { label: 'T7', access: 122, checklist: 55 },
    { label: 'CN', access: 86, checklist: 38 },
  ],
  '30d': [
    { label: 'Tuần 1', access: 382, checklist: 186 },
    { label: 'Tuần 2', access: 426, checklist: 231 },
    { label: 'Tuần 3', access: 398, checklist: 267 },
    { label: 'Tuần 4', access: 471, checklist: 284 },
    { label: 'Hiện tại', access: 452, checklist: 306 },
  ],
  '90d': [
    { label: 'Tháng 4', access: 1430, checklist: 724 },
    { label: 'Tháng 5', access: 1588, checklist: 846 },
    { label: 'Tháng 6', access: 1714, checklist: 963 },
  ],
}

const SCHEDULE_ITEMS = [
  { time: '08:30', title: 'Kiểm tra dữ liệu đồng bộ', tone: 'mint' },
  { time: '10:00', title: 'Rà soát checklist lâm sàng', tone: 'blue' },
  { time: '14:00', title: 'Đối soát tài khoản khoa phòng', tone: 'purple' },
]

function formatNumber(value) {
  return NUMBER_FORMATTER.format(Number(value) || 0)
}

function getPageData(result) {
  return result?.status === 'fulfilled' ? result.value.data?.data : null
}

function getTotal(result, fallback = 0) {
  const value = Number(getPageData(result)?.totalElements)
  return Number.isFinite(value) ? value : fallback
}

function getImportContent(result) {
  const data = getPageData(result)
  return Array.isArray(data?.content) ? data.content : []
}

function formatTime(value) {
  if (!value) {
    return '--:--'
  }

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(value) {
  if (!value) {
    return 'Chưa xác định'
  }

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ChartSkeleton({ compact = false }) {
  return (
    <div className={`admin-chart-skeleton ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      <span className="admin-chart-skeleton__line is-short" />
      <span className="admin-chart-skeleton__line" />
      <div className="admin-chart-skeleton__plot">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} style={{ height: `${32 + ((index * 17) % 58)}%` }} />
        ))}
      </div>
    </div>
  )
}

function EmptyWidget({ children }) {
  return (
    <div className="admin-widget-empty">
      <FileDoneOutlined />
      <span>{children}</span>
    </div>
  )
}

function AnimatedAreaDot({
  begin,
  color,
  cx,
  cy,
  duration,
  index,
  totalPoints,
}) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    return null
  }

  const progress = totalPoints > 1 ? index / (totalPoints - 1) : 1
  const delay = begin + duration * progress

  return (
    <circle
      aria-hidden="true"
      className="admin-area-dot"
      cx={cx}
      cy={cy}
      fill="#ffffff"
      r="3.5"
      stroke={color}
      strokeWidth="2.25"
      style={{
        '--admin-dot-delay': `${Math.round(delay)}ms`,
        '--admin-dot-duration': `${TREND_ANIMATION.dotDuration}ms`,
      }}
    />
  )
}

function MetricCard({ icon, label, value, detail, tone, loading }) {
  if (loading) {
    return (
      <article className="admin-metric-card is-loading" aria-label={`Đang tải ${label}`}>
        <span className="admin-skeleton admin-skeleton--icon" />
        <span className="admin-skeleton admin-skeleton--label" />
        <span className="admin-skeleton admin-skeleton--value" />
        <span className="admin-skeleton admin-skeleton--detail" />
      </article>
    )
  }

  return (
    <article className={`admin-metric-card admin-metric-card--${tone}`}>
      <div className="admin-metric-card__top">
        <span className="admin-metric-card__icon">{icon}</span>
        <span className="admin-trend is-live">
          <CheckCircleOutlined />
          Trực tiếp
        </span>
      </div>
      <p>{label}</p>
      <strong>{formatNumber(value)}</strong>
      <span className="admin-metric-card__detail">{detail}</span>
    </article>
  )
}

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="admin-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          <i style={{ background: entry.color }} />
          {entry.name}: {formatNumber(entry.value)}
        </span>
      ))}
    </div>
  )
}

function buildCalendarDays(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const requestIdRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [trendReady, setTrendReady] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  ))
  const [refreshing, setRefreshing] = useState(false)
  const [warningMessage, setWarningMessage] = useState('')
  const [period, setPeriod] = useState('7d')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)

  const loadDashboard = useCallback(async ({ refresh = false } = {}) => {
    const requestId = ++requestIdRef.current
    if (refresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setWarningMessage('')

    const requests = [
      adminApi.getUsers({ page: 0, size: 1 }),
      adminApi.getUsers({ page: 0, size: 1, status: 'ACTIVE' }),
      adminApi.getUsers({ page: 0, size: 1, status: 'INACTIVE' }),
      adminApi.getUsers({ page: 0, size: 1, status: 'LOCKED' }),
      adminApi.getDepartments(),
      adminApi.getForms({ page: 0, size: 1 }),
      adminApi.getForms({ page: 0, size: 1, status: 'PUBLISHED' }),
      adminApi.getForms({ page: 0, size: 1, status: 'DRAFT' }),
      adminApi.getForms({ page: 0, size: 1, status: 'RETIRED' }),
      adminApi.getImportLogs({ page: 0, size: 6, sort: 'createdAt,desc' }),
    ]

    const [results] = await Promise.all([
      Promise.allSettled(requests),
      new Promise((resolve) => window.setTimeout(resolve, refresh ? 250 : 420)),
    ])

    if (requestId !== requestIdRef.current) {
      return
    }

    const failedCount = results.filter((result) => result.status === 'rejected').length
    const departments = getPageData(results[4])
    const imports = getImportContent(results[9])

    setDashboardData({
      accounts: getTotal(results[0]),
      activeAccounts: getTotal(results[1]),
      inactiveAccounts: getTotal(results[2]),
      lockedAccounts: getTotal(results[3]),
      departments: Array.isArray(departments) ? departments.length : 0,
      forms: getTotal(results[5]),
      publishedForms: getTotal(results[6]),
      draftForms: getTotal(results[7]),
      retiredForms: getTotal(results[8]),
      imports,
    })
    setLastUpdated(new Date())
    setWarningMessage(
      failedCount
        ? `Có ${failedCount} nguồn dữ liệu chưa phản hồi. Widget liên quan tạm hiển thị trạng thái rỗng.`
        : '',
    )
    setLoading(false)
    setRefreshing(false)
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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionPreference = (event) => setReduceMotion(event.matches)
    const revealTimer = window.setTimeout(
      () => setTrendReady(true),
      mediaQuery.matches ? 0 : 260,
    )

    mediaQuery.addEventListener('change', handleMotionPreference)

    return () => {
      window.clearTimeout(revealTimer)
      mediaQuery.removeEventListener('change', handleMotionPreference)
    }
  }, [])

  const statusData = useMemo(() => {
    if (!dashboardData) {
      return []
    }

    return [
      { key: 'ACTIVE', name: 'Hoạt động', value: dashboardData.activeAccounts },
      { key: 'INACTIVE', name: 'Ngưng hoạt động', value: dashboardData.inactiveAccounts },
      { key: 'LOCKED', name: 'Đã khóa', value: dashboardData.lockedAccounts },
    ]
  }, [dashboardData])

  const filteredStatusData = selectedStatus === 'ALL'
    ? statusData
    : statusData.filter((item) => item.key === selectedStatus)
  const selectedStatusTotal = filteredStatusData.reduce(
    (total, item) => total + item.value,
    0,
  )
  const selectedStatusLabel = selectedStatus === 'ALL'
    ? 'Tài khoản'
    : filteredStatusData[0]?.name || 'Tài khoản'

  const importChartData = useMemo(
    () => (dashboardData?.imports || []).slice(0, 6).reverse().map((item, index) => ({
      label: `Đợt ${index + 1}`,
      success: (item.insertedRows || 0) + (item.updatedRows || 0),
      failed: item.failedRows || 0,
    })),
    [dashboardData],
  )

  const today = useMemo(() => new Date(), [])
  const calendarDays = useMemo(() => buildCalendarDays(today), [today])
  const monthLabel = today.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  const trendPointCount = TREND_DATA[period].length

  return (
    <div className="dashboard-layout admin-dashboard-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader title="Tổng quan quản trị" />

        <main className="admin-dashboard-main">
          <section className="admin-dashboard-hero">
            <div>
              <span className="admin-dashboard-hero__eyebrow">VietDuc Care</span>
              <h1>Trung tâm điều hành chất lượng</h1>
              <p>
                Theo dõi tài khoản, checklist và hoạt động dữ liệu trong một giao diện thống nhất.
              </p>
            </div>
            <div className="admin-dashboard-hero__actions">
              <div className="admin-last-updated">
                <ClockCircleOutlined />
                <span>
                  Cập nhật {lastUpdated
                    ? lastUpdated.toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'đang tải'}
                </span>
              </div>
              <button
                className="admin-refresh-button"
                disabled={refreshing}
                onClick={() => loadDashboard({ refresh: true })}
                type="button"
              >
                <ReloadOutlined spin={refreshing} />
                {refreshing ? 'Đang đồng bộ' : 'Làm mới'}
              </button>
            </div>
          </section>

          {warningMessage && (
            <div className="admin-dashboard-warning" role="status">
              <WarningOutlined />
              {warningMessage}
            </div>
          )}

          <section className="admin-metric-grid" aria-label="Chỉ số tổng quan">
            <MetricCard
              detail={`${formatNumber(dashboardData?.activeAccounts)} đang hoạt động`}
              icon={<TeamOutlined />}
              label="Tổng tài khoản"
              loading={loading}
              tone="navy"
              value={dashboardData?.accounts}
            />
            <MetricCard
              detail="Đơn vị trong hệ thống"
              icon={<ApartmentOutlined />}
              label="Khoa phòng"
              loading={loading}
              tone="mint"
              value={dashboardData?.departments}
            />
            <MetricCard
              detail={`${formatNumber(dashboardData?.publishedForms)} đang hoạt động`}
              icon={<FileDoneOutlined />}
              label="Biểu mẫu checklist"
              loading={loading}
              tone="violet"
              value={dashboardData?.forms}
            />
            <MetricCard
              detail={`${formatNumber(dashboardData?.lockedAccounts)} tài khoản đang khóa`}
              icon={<SafetyCertificateOutlined />}
              label="Tài khoản an toàn"
              loading={loading}
              tone="coral"
              value={(dashboardData?.accounts || 0) - (dashboardData?.lockedAccounts || 0)}
            />
          </section>

          <section className="admin-dashboard-grid">
            <article className="admin-widget admin-widget--trend">
              <header className="admin-widget__header">
                <div>
                  <h2>Nhịp hoạt động hệ thống</h2>
                  <p>Lượt truy cập và checklist được xử lý</p>
                </div>
                <div className="admin-segmented" aria-label="Khoảng thời gian">
                  {[
                    ['7d', '7 ngày'],
                    ['30d', '30 ngày'],
                    ['90d', '90 ngày'],
                  ].map(([value, label]) => (
                    <button
                      aria-pressed={period === value}
                      className={period === value ? 'is-active' : ''}
                      key={value}
                      onClick={() => setPeriod(value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </header>
              <div className="admin-widget__legend">
                <span><i className="is-navy" /> Lượt truy cập</span>
                <span><i className="is-mint" /> Checklist xử lý</span>
              </div>
              <div className="admin-chart-area" aria-busy={!trendReady}>
                {!trendReady ? (
                  <ChartSkeleton />
                ) : (
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={TREND_DATA[period]} margin={{ left: -18, right: 8, top: 12 }}>
                      <defs>
                        <linearGradient id="accessGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#183b5b" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#183b5b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="checklistGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#4fd1b5" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#4fd1b5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#edf1f4" strokeDasharray="4 4" vertical={false} />
                      <XAxis axisLine={false} dataKey="label" tick={{ fill: '#8a98a8', fontSize: 12 }} tickLine={false} />
                      <YAxis axisLine={false} tick={{ fill: '#8a98a8', fontSize: 12 }} tickLine={false} />
                      <Tooltip content={<DashboardTooltip />} cursor={{ stroke: '#b7c4cf', strokeDasharray: '4 4' }} />
                      <Area
                        activeDot={{ r: 5, strokeWidth: 3 }}
                        animationBegin={TREND_ANIMATION.begin}
                        animationDuration={TREND_ANIMATION.accessDuration}
                        animationEasing="ease-out"
                        className="admin-area-series admin-area-series--access"
                        dataKey="access"
                        dot={(props) => (
                          <AnimatedAreaDot
                            {...props}
                            begin={TREND_ANIMATION.begin}
                            color="#183b5b"
                            duration={TREND_ANIMATION.accessDuration}
                            totalPoints={trendPointCount}
                          />
                        )}
                        fill="url(#accessGradient)"
                        fillOpacity={1}
                        isAnimationActive={!reduceMotion}
                        key={`access-${period}`}
                        name="Lượt truy cập"
                        stroke="#183b5b"
                        strokeWidth={2.5}
                        type="monotone"
                      />
                      <Area
                        activeDot={{ r: 5, strokeWidth: 3 }}
                        animationBegin={TREND_ANIMATION.begin + 40}
                        animationDuration={TREND_ANIMATION.checklistDuration}
                        animationEasing="ease-out"
                        className="admin-area-series admin-area-series--checklist"
                        dataKey="checklist"
                        dot={(props) => (
                          <AnimatedAreaDot
                            {...props}
                            begin={TREND_ANIMATION.begin + 40}
                            color="#4fd1b5"
                            duration={TREND_ANIMATION.checklistDuration}
                            totalPoints={trendPointCount}
                          />
                        )}
                        fill="url(#checklistGradient)"
                        fillOpacity={1}
                        isAnimationActive={!reduceMotion}
                        key={`checklist-${period}`}
                        name="Checklist xử lý"
                        stroke="#4fd1b5"
                        strokeWidth={2.5}
                        type="monotone"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              {trendReady && (
                <p className="admin-chart-note">
                  Dữ liệu xu hướng đang được mô phỏng cho đến khi backend cung cấp API lịch sử.
                </p>
              )}
            </article>

            <article className="admin-widget admin-widget--status">
              <header className="admin-widget__header">
                <div>
                  <h2>Trạng thái tài khoản</h2>
                  <p>Bấm vào chú thích để lọc biểu đồ</p>
                </div>
              </header>
              <div className="admin-donut-wrap">
                {loading ? (
                  <ChartSkeleton compact />
                ) : (
                  <>
                    <ResponsiveContainer height={220} width="100%">
                      <PieChart>
                        <Pie
                          cornerRadius={7}
                          data={filteredStatusData}
                          dataKey="value"
                          innerRadius={65}
                          nameKey="name"
                          outerRadius={88}
                          paddingAngle={4}
                          stroke="none"
                        >
                          {filteredStatusData.map((item) => (
                            <Cell fill={STATUS_COLORS[item.key]} key={item.key} />
                          ))}
                        </Pie>
                        <Tooltip content={<DashboardTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="admin-donut-center">
                      <strong>{formatNumber(selectedStatusTotal)}</strong>
                      <span>{selectedStatusLabel}</span>
                    </div>
                  </>
                )}
              </div>
              {!loading && (
                <div className="admin-status-legend">
                  <button
                    className={selectedStatus === 'ALL' ? 'is-active' : ''}
                    onClick={() => setSelectedStatus('ALL')}
                    type="button"
                  >
                    Tất cả
                  </button>
                  {statusData.map((item) => (
                    <button
                      className={selectedStatus === item.key ? 'is-active' : ''}
                      key={item.key}
                      onClick={() => setSelectedStatus(item.key)}
                      type="button"
                    >
                      <i style={{ background: STATUS_COLORS[item.key] }} />
                      <span>{item.name}</span>
                      <strong>{formatNumber(item.value)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </article>

            <article className="admin-widget admin-widget--imports">
              <header className="admin-widget__header">
                <div>
                  <h2>Chất lượng import dữ liệu</h2>
                  <p>Số dòng thành công và lỗi theo các đợt gần nhất</p>
                </div>
                <button
                  className="admin-widget-link"
                  onClick={() => navigate('/admin/system/import-logs')}
                  type="button"
                >
                  Xem lịch sử <RightOutlined />
                </button>
              </header>
              <div className="admin-widget__legend">
                <span><i className="is-mint" /> Thành công</span>
                <span><i className="is-coral" /> Có lỗi</span>
              </div>
              <div className="admin-chart-area is-short">
                {loading ? (
                  <ChartSkeleton compact />
                ) : importChartData.length === 0 ? (
                  <EmptyWidget>Chưa có lịch sử import để hiển thị.</EmptyWidget>
                ) : (
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart barGap={5} data={importChartData} margin={{ left: -18, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#edf1f4" strokeDasharray="4 4" vertical={false} />
                      <XAxis axisLine={false} dataKey="label" tick={{ fill: '#8a98a8', fontSize: 11 }} tickLine={false} />
                      <YAxis axisLine={false} tick={{ fill: '#8a98a8', fontSize: 11 }} tickLine={false} />
                      <Tooltip content={<DashboardTooltip />} cursor={{ fill: '#f5f8fa' }} />
                      <Bar dataKey="success" fill="#4fd1b5" name="Thành công" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="failed" fill="#f07a78" name="Có lỗi" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <aside className="admin-widget admin-widget--calendar">
              <header className="admin-widget__header">
                <div>
                  <h2>Lịch vận hành</h2>
                  <p className="admin-calendar-month">{monthLabel}</p>
                </div>
                <span className="admin-calendar-date">{today.getDate()}</span>
              </header>
              <div className="admin-calendar-weekdays">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="admin-calendar-days">
                {calendarDays.map((day, index) => (
                  <span
                    className={day === today.getDate() ? 'is-today' : ''}
                    key={`${day || 'empty'}-${index}`}
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div className="admin-schedule">
                {SCHEDULE_ITEMS.map((item) => (
                  <div className={`admin-schedule__item is-${item.tone}`} key={item.time}>
                    <time>{item.time}</time>
                    <span>{item.title}</span>
                  </div>
                ))}
              </div>
            </aside>

            <article className="admin-widget admin-widget--activity">
              <header className="admin-widget__header">
                <div>
                  <h2>Import gần đây</h2>
                  <p>Trạng thái các tệp dữ liệu mới nhất</p>
                </div>
              </header>
              {loading ? (
                <div className="admin-activity-skeleton">
                  {Array.from({ length: 4 }, (_, index) => (
                    <span className="admin-skeleton" key={index} />
                  ))}
                </div>
              ) : dashboardData?.imports.length === 0 ? (
                <EmptyWidget>Chưa có tệp dữ liệu nào được import.</EmptyWidget>
              ) : (
                <div className="admin-activity-list">
                  {(dashboardData?.imports || []).slice(0, 5).map((item) => {
                    const failed = Number(item.failedRows) || 0
                    const isSuccess = failed === 0 && item.status !== 'FAILED'
                    return (
                      <button
                        className="admin-activity-item"
                        key={item.id}
                        onClick={() => navigate('/admin/system/import-logs')}
                        type="button"
                      >
                        <span className={`admin-activity-item__icon ${isSuccess ? 'is-success' : 'is-warning'}`}>
                          {isSuccess ? <CheckCircleOutlined /> : <WarningOutlined />}
                        </span>
                        <span className="admin-activity-item__content">
                          <strong>{item.sourceFile || 'Tệp dữ liệu'}</strong>
                          <small>
                            {formatNumber((item.insertedRows || 0) + (item.updatedRows || 0))} thành công
                            {failed ? ` · ${formatNumber(failed)} lỗi` : ''}
                          </small>
                        </span>
                        <time title={formatDateTime(item.createdAt)}>
                          {formatTime(item.createdAt)}
                        </time>
                      </button>
                    )
                  })}
                </div>
              )}
            </article>

            <article className="admin-widget admin-widget--quick-actions">
              <header className="admin-widget__header">
                <div>
                  <h2>Thao tác nhanh</h2>
                  <p>Đi đến các công việc quản trị thường dùng</p>
                </div>
              </header>
              <div className="admin-quick-actions">
                <button onClick={() => navigate('/admin/accounts')} type="button">
                  <span className="is-mint"><TeamOutlined /></span>
                  <div><strong>Quản lý tài khoản</strong><small>Thêm và phân quyền người dùng</small></div>
                  <RightOutlined />
                </button>
                <button onClick={() => navigate('/admin/quality/checklists/new')} type="button">
                  <span className="is-blue"><PlusOutlined /></span>
                  <div><strong>Tạo checklist</strong><small>Khởi tạo biểu mẫu đánh giá mới</small></div>
                  <RightOutlined />
                </button>
                <button onClick={() => navigate('/admin/form-imports/new')} type="button">
                  <span className="is-purple"><ImportOutlined /></span>
                  <div><strong>Import Google Form</strong><small>Đưa biểu mẫu có sẵn vào hệ thống</small></div>
                  <RightOutlined />
                </button>
                <button onClick={() => navigate('/training/employees')} type="button">
                  <span className="is-blue"><BookOutlined /></span>
                  <div><strong>Quản lý giờ đào tạo NV</strong><small>Theo dõi và kiểm tra giờ đào tạo nhân viên</small></div>
                  <RightOutlined />
                </button>
                <button onClick={() => navigate('/staff/training')} type="button">
                  <span className="is-mint"><ClockCircleOutlined /></span>
                  <div><strong>Giờ đào tạo của tôi</strong><small>Xem và nộp giờ đào tạo cá nhân</small></div>
                  <RightOutlined />
                </button>
                <button onClick={() => navigate('/admin/accounts')} type="button">
                  <span className="is-coral"><LockOutlined /></span>
                  <div><strong>Tài khoản bị khóa</strong><small>Kiểm tra và mở khóa tài khoản</small></div>
                  <RightOutlined />
                </button>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}
