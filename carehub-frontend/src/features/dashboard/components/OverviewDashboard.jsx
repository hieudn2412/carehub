import { useEffect, useRef, useState } from 'react'
import {
  AlertOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  FilterOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './OverviewDashboard.css'

const DOMAIN_META = {
  training: {
    eyebrow: 'GIỜ ĐÀO TẠO',
    title: 'Tiến độ giờ đào tạo',
    icon: <ClockCircleOutlined />,
    tone: 'blue',
  },
  exams: {
    eyebrow: 'BÀI KIỂM TRA & CHUYÊN MÔN',
    title: 'Điểm bài kiểm tra (lý thuyết)',
    icon: <BookOutlined />,
    tone: 'violet',
  },
  quality: {
    eyebrow: 'TUÂN THỦ & CHẤT LƯỢNG',
    title: 'Điểm checklist (thực hành)',
    icon: <SafetyCertificateOutlined />,
    tone: 'green',
  },
}

const numberFormatter = new Intl.NumberFormat('vi-VN')
const EMPTY_COMPLIANCE_CHART = []

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0)
}

function formatPercent(value) {
  const numeric = Number(value)
  return `${Number.isFinite(numeric) ? numeric.toFixed(1).replace('.', ',') : '0,0'}%`
}

function LoadingBlock() {
  return (
    <div className="overview-loading" aria-label="Đang tải dữ liệu">
      <span />
      <span />
      <span />
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, tone = 'neutral', onOpen }) {
  const Component = onOpen ? 'button' : 'article'

  return (
    <Component
      className={`overview-summary-card overview-summary-card--${tone}${onOpen ? ' overview-summary-card--interactive' : ''}`}
      onClick={onOpen}
      type={onOpen ? 'button' : undefined}
    >
      <span className="overview-summary-card__icon">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </Component>
  )
}

function DomainCard({ type, data, onOpen }) {
  const meta = DOMAIN_META[type]
  const total = Number(data.total) || 0
  const passed = Number(data.passed) || 0
  const failed = Number(data.failed) || 0
  const rate = Number.isFinite(Number(data.rate)) ? Number(data.rate) : 0
  const hasData = data.available !== false && total > 0

  return (
    <article className={`overview-domain overview-domain--${meta.tone}`}>
      <header className="overview-domain__header">
        <span className="overview-domain__icon">{meta.icon}</span>
        <div>
          <span>{meta.eyebrow}</span>
          <h2>{meta.title}</h2>
        </div>
        {onOpen && (
          <button type="button" onClick={onOpen}>Xem chi tiết</button>
        )}
      </header>

      {data.loading ? (
        <LoadingBlock />
      ) : !hasData ? (
        <div className="overview-domain__empty">
          <ExperimentOutlined />
          <strong>{data.emptyTitle || 'Chưa có dữ liệu trong phạm vi này'}</strong>
          <span>{data.emptyMessage || 'Dữ liệu sẽ xuất hiện khi hệ thống ghi nhận kết quả.'}</span>
        </div>
      ) : (
        <>
          <div className="overview-domain__metrics">
            <div><span>Tổng số</span><strong>{formatNumber(total)}</strong></div>
            <div><span>Đạt</span><strong className="is-success">{formatNumber(passed)}</strong></div>
            <div><span>Chưa đạt</span><strong className="is-danger">{formatNumber(failed)}</strong></div>
            <div><span>Tỷ lệ đạt</span><strong>{formatPercent(rate)}</strong></div>
          </div>
          <div className="overview-progress" aria-label={`Tỷ lệ đạt ${formatPercent(rate)}`}>
            <div className="overview-progress__labels">
              <span>Tiến độ đạt chuẩn</span>
              <strong>{formatPercent(rate)}</strong>
            </div>
            <div className="overview-progress__track">
              <span style={{ width: `${Math.max(0, Math.min(100, rate))}%` }} />
            </div>
          </div>
          <p className="overview-domain__note">{data.note}</p>
        </>
      )}
    </article>
  )
}

function formatScore(value) {
  if (value == null || value === '') return '—'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1).replace('.', ',') : '—'
}

function currentYearRange() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return { fromDate: `${year}-01-01`, toDate: `${year}-${month}-${day}` }
}

function ManagementKpiCard({ type, data, content, onOpen }) {
  const total = Number(data?.total) || 0
  const passed = Number(data?.passed) || 0
  const rate = Number(data?.rate) || 0
  const available = data?.available !== false
  const isScoreContent = type === 'exams' && ['knowledge', 'skill'].includes(content)
  const labels = {
    training: 'Đào tạo liên tục',
    quality: 'Tuân thủ chung',
    exams: 'Năng lực chuyên môn',
  }
  if (type === 'exams' && content === 'knowledge') labels.exams = 'Trung bình điểm kiểm tra kiến thức'
  if (type === 'exams' && content === 'skill') labels.exams = 'Trung bình điểm kiểm tra kỹ năng'
  if (type === 'exams' && content === 'classification') labels.exams = 'Phân loại năng lực'
  const primaryValue = type === 'exams' && content === 'knowledge'
    ? `TB ${formatScore(data?.knowledgeAverage)}/10`
    : type === 'exams' && content === 'skill'
      ? `TB ${formatScore(data?.skillAverage)}/10`
      : type === 'exams' && content === 'classification'
        ? `${formatNumber(passed)}/${formatNumber(total)} đạt`
    : type === 'training'
    ? '≥ 120h'
    : type === 'exams'
      ? data?.targetScore == null
        ? 'Điểm sàn theo từng khoa'
        : `Điểm sàn ≥ ${formatScore(data.targetScore)}/10`
      : `${formatNumber(passed)}/${formatNumber(total)}`
  const detail = type === 'training'
    ? 'Mục tiêu 5 năm'
    : type === 'quality'
      ? 'Trung bình từ đầu năm'
      : content === 'classification'
        ? Object.entries(data?.classificationCounts || {}).map(([label, count]) => `${label}: ${count}`).join(' · ') || 'Chưa có dữ liệu phân loại'
        : 'Mức năng lực yêu cầu'

  return (
    <button
      className={`overview-management-kpi overview-management-kpi--${type}`}
      disabled={!onOpen}
      onClick={onOpen}
      type="button"
    >
      <span className="overview-management-kpi__label">{labels[type]}</span>
      {available ? (
        <span className="overview-management-kpi__metrics">
          <strong>{primaryValue}</strong>
          <b>{isScoreContent ? `${formatNumber(total)} nhân viên` : formatPercent(rate)}</b>
        </span>
      ) : (
        <span className="overview-management-kpi__empty">Chưa có dữ liệu</span>
      )}
      <small>{detail}</small>
    </button>
  )
}

function ComplianceTargetChart({ items = [], loading, onDetails }) {
  if (loading) {
    return <section className="overview-compliance-chart"><LoadingBlock /></section>
  }

  if (!items.length) {
    return (
      <section className="overview-compliance-chart overview-compliance-chart--empty">
        <ExperimentOutlined />
        <strong>Chưa có dữ liệu bảng kiểm trong phạm vi này</strong>
        <span>Biểu đồ sẽ xuất hiện khi hệ thống ghi nhận kết quả đánh giá.</span>
      </section>
    )
  }

  return (
    <section className="overview-compliance-chart" aria-label="Kết quả đạt được so với mục tiêu">
      <header>
        <div>
          <h2>Chất lượng chăm sóc</h2>
          <p>Kết quả đạt được so với mục tiêu.</p>
        </div>
        <div className="overview-compliance-chart__actions">
          <span>{items.length} bảng kiểm</span>
          <button type="button" onClick={onDetails}>Xem chi tiết <ArrowRightOutlined /></button>
        </div>
      </header>
      <div className="overview-compliance-chart__canvas">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 16, right: 18, left: 0, bottom: 74 }} barCategoryGap="55%" barGap={6}>
            <CartesianGrid stroke="#e7edf2" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-32}
              height={88}
              interval={0}
              textAnchor="end"
              tick={{ fill: '#556274', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: '#667085', fontSize: 11 }}
              tickLine={false}
              width={44}
            />
            <Tooltip
              formatter={(value, name) => [formatPercent(value), name]}
              labelFormatter={(label) => label}
              contentStyle={{ border: '1px solid #dce5ec', borderRadius: 8 }}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 12 }} />
            <Bar dataKey="target" name="Mục tiêu" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Bar dataKey="actual" name="Kết quả" fill="#0d8a78" radius={[4, 4, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function localDate(value, fallback) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : fallback
}

function complianceTrend(items = [], fromDate, toDate) {
  const today = new Date()
  const startDate = localDate(fromDate, new Date(today.getFullYear(), 0, 1))
  const endDate = localDate(toDate, today)
  const resultsByMonth = items.reduce((months, item) => {
    const month = String(item.period || '').slice(0, 7)
    if (!month) return months
    const current = months.get(month) || { total: 0, passed: 0 }
    current.total += Number(item.submittedCount) || 0
    current.passed += Number(item.passedCount) || 0
    months.set(month, current)
    return months
  }, new Map())
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  const timeline = []
  while (cursor <= endDate) {
    const year = cursor.getFullYear()
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const monthKey = `${year}-${month}`
    const result = resultsByMonth.get(monthKey)
    timeline.push({
      period: `${monthKey}-01`,
      rate: result?.total ? result.passed * 100 / result.total : null,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return timeline
}

function monthTicks(fromDate, toDate) {
  const today = new Date()
  const startDate = localDate(fromDate, new Date(today.getFullYear(), 0, 1))
  const endDate = localDate(toDate, today)
  const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const ticks = [format(startDate)]
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1)
  while (cursor <= endDate) {
    ticks.push(format(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return ticks
}

function monthLabel(value) {
  return `T${Number(String(value).slice(5, 7))}`
}

function ComplianceDetailCard({ item, trend, loading, fromDate, toDate }) {
  const hasTimeline = trend.some((point) => point.rate != null)
  return (
    <article className="overview-checklist-card">
      <h3 title={item.name}>{item.name}</h3>
      <div className="overview-checklist-card__metrics">
        <span><strong>{formatPercent(item.actual)}</strong><small>Tỷ lệ tuân thủ</small></span>
        <span><strong>{formatNumber(item.passed)}/{formatNumber(item.total)}</strong><small>Đạt / Tổng lượt</small></span>
        <span><strong>{formatPercent(item.target)}</strong><small>Tỷ lệ mục tiêu</small></span>
      </div>
      <div className="overview-checklist-card__sparkline" aria-label={`Xu hướng tuân thủ của ${item.name}`}>
        {loading ? <LoadingOutlined spin /> : hasTimeline ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 12, right: 10, bottom: 4, left: -12 }}>
              <defs>
                <linearGradient id={`compliance-area-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d8a78" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0d8a78" stopOpacity={0.015} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#edf1f4" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                axisLine={{ stroke: '#aab4c0' }}
                tick={{ fill: '#667085', fontSize: 9 }}
                tickLine={false}
                ticks={monthTicks(fromDate, toDate)}
                tickFormatter={monthLabel}
                interval={0}
                height={26}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value) => `${value}%`}
                axisLine={{ stroke: '#aab4c0' }}
                tick={{ fill: '#667085', fontSize: 9 }}
                tickLine={false}
                width={42}
              />
              <Tooltip
                formatter={(value) => [formatPercent(value), 'Kết quả']}
                labelFormatter={(label) => `Tháng ${Number(String(label).slice(5, 7))}/${String(label).slice(0, 4)}`}
                contentStyle={{ border: '1px solid #dce5ec', borderRadius: 8, fontSize: 11 }}
              />
              <ReferenceLine
                y={item.target}
                stroke="#d97706"
                strokeDasharray="5 4"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#0d8a78"
                strokeWidth={2.5}
                fill={`url(#compliance-area-${item.id})`}
                fillOpacity={1}
                dot={(props) => (props.payload.rate == null ? null : (
                  <circle cx={props.cx} cy={props.cy} r="3.5" fill="#fff" stroke="#0d8a78" strokeWidth="2.5" />
                ))}
                activeDot={{ r: 5, fill: '#fff', stroke: '#0d8a78', strokeWidth: 2.5 }}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : <span>Chưa đủ dữ liệu để hiển thị xu hướng</span>}
      </div>
      <div className="overview-checklist-card__legend" aria-hidden="true">
        <span><i className="is-actual" />Kết quả</span>
        <span><i className="is-target" />Mục tiêu</span>
      </div>
    </article>
  )
}

function ComplianceDetails({ items, trends, loading, fromDate, toDate, onBack }) {
  return (
    <section className="overview-checklist-details">
      <header>
        <button type="button" onClick={onBack}><ArrowLeftOutlined /> Quay lại biểu đồ</button>
        <div>
          <h2>Chi tiết tuân thủ theo bảng kiểm</h2>
          <p>Số liệu tính từ đầu năm đến thời điểm truy cập trong phạm vi đang chọn.</p>
        </div>
      </header>
      <div className="overview-checklist-details__grid">
        {items.map((item) => (
          <ComplianceDetailCard
            key={item.id}
            item={item}
            trend={trends[item.id] || []}
            loading={loading}
            fromDate={fromDate}
            toDate={toDate}
          />
        ))}
      </div>
    </section>
  )
}

export default function OverviewDashboard({
  role,
  profile,
  loading,
  error,
  filters,
  departments = [],
  onFilterChange,
  onExport,
  onNavigate,
  onSummaryOpen,
  summary,
  domains,
  complianceChart = EMPTY_COMPLIANCE_CHART,
  onLoadComplianceTrend,
  visibleDomains = ['training', 'exams', 'quality'],
}) {
  const isStaff = role === 'staff'
  const visibleTypes = visibleDomains.filter((type) => DOMAIN_META[type] && domains[type])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [showComplianceDetails, setShowComplianceDetails] = useState(false)
  const [complianceTrends, setComplianceTrends] = useState({})
  const [complianceTrendsLoading, setComplianceTrendsLoading] = useState(false)
  const complianceTrendRequestId = useRef(0)
  const defaultDates = currentYearRange()
  const activeFilterCount = [
    role === 'admin' && filters.departmentId,
    filters.employeeCode?.trim(),
    filters.content && filters.content !== 'all',
    filters.fromDate && filters.fromDate !== defaultDates.fromDate,
    filters.toDate && filters.toDate !== defaultDates.toDate,
  ].filter(Boolean).length
  const managementTypes = filters.content === 'training'
    ? ['training']
    : filters.content === 'compliance'
      ? ['quality']
      : ['knowledge', 'skill', 'classification'].includes(filters.content)
        ? ['exams']
        : ['training', 'quality', 'exams']
  const showComplianceSection = !filters.content || filters.content === 'all' || filters.content === 'compliance'
  const changeFilter = (key, value) => {
    complianceTrendRequestId.current += 1
    setShowComplianceDetails(false)
    setComplianceTrendsLoading(false)
    onFilterChange(key, value)
  }
  const resetFilters = () => {
    if (role === 'admin') changeFilter('departmentId', '')
    changeFilter('employeeCode', '')
    changeFilter('content', 'all')
    changeFilter('fromDate', defaultDates.fromDate)
    changeFilter('toDate', defaultDates.toDate)
  }

  useEffect(() => {
    if (isStaff) return
    complianceTrendRequestId.current += 1
    setShowComplianceDetails(false)
    setComplianceTrends({})
  }, [complianceChart, isStaff])

  const openComplianceDetails = async () => {
    setShowComplianceDetails(true)
    if (!onLoadComplianceTrend || !complianceChart.length) return
    const requestId = ++complianceTrendRequestId.current
    setComplianceTrendsLoading(true)
    const results = await Promise.allSettled(
      complianceChart.map((item) => onLoadComplianceTrend(item.id)),
    )
    if (requestId !== complianceTrendRequestId.current) return
    setComplianceTrends(Object.fromEntries(results.map((result, index) => [
      complianceChart[index].id,
      result.status === 'fulfilled'
        ? complianceTrend(result.value, filters.fromDate, filters.toDate)
        : [],
    ])))
    setComplianceTrendsLoading(false)
  }

  const closeComplianceDetails = () => {
    complianceTrendRequestId.current += 1
    setShowComplianceDetails(false)
    setComplianceTrendsLoading(false)
  }

  return (
    <div className={`overview-dashboard overview-dashboard--${role}`}>
      {!isStaff && (
        <section className="overview-filter-toolbar admin-control-toolbar" aria-label="Bộ lọc dashboard">
          <div className="admin-control-toolbar__main">
            <div className="admin-control-toolbar__controls">
              <button
                aria-controls="overview-dashboard-filter-panel"
                aria-expanded={isFilterOpen}
                className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                onClick={() => setIsFilterOpen((current) => !current)}
                type="button"
              >
                <FilterOutlined /> Bộ lọc
                {activeFilterCount > 0 && (
                  <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button className="overview-filter-reset" onClick={resetFilters} type="button">
                  Xóa bộ lọc
                </button>
              )}
            </div>
            {onExport && (
              <button className="overview-export" type="button" onClick={onExport}>
                <DownloadOutlined /> Xuất dữ liệu giờ đào tạo
              </button>
            )}
          </div>

          {isFilterOpen && (
            <div className="overview-filters overview-filters--scope overview-filter-panel" id="overview-dashboard-filter-panel">
              <label>
                <span>Khoa/Phòng</span>
                {role === 'admin' ? (
                  <SearchableSelect
                    value={filters.departmentId}
                    onChange={(value) => changeFilter('departmentId', value)}
                    ariaLabel="Tìm và chọn khoa/phòng"
                    placeholder="Toàn viện"
                    searchPlaceholder="Gõ tên khoa/phòng..."
                    options={[
                      { value: '', label: 'Toàn viện' },
                      ...departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                        searchText: department.code || department.departmentCode,
                      })),
                    ]}
                  />
                ) : (
                  <div className="overview-filter-static">{profile?.departmentName || 'Khoa của tôi'}</div>
                )}
              </label>
              <label>
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  max={filters.toDate}
                  onChange={(event) => changeFilter('fromDate', event.target.value)}
                />
              </label>
              <label>
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={filters.toDate}
                  min={filters.fromDate}
                  onChange={(event) => changeFilter('toDate', event.target.value)}
                />
              </label>
              <label>
                <span>Mã nhân viên</span>
                <input
                  type="search"
                  value={filters.employeeCode}
                  placeholder="Nhập mã nhân viên..."
                  onChange={(event) => changeFilter('employeeCode', event.target.value)}
                />
              </label>
              <label>
                <span>Nội dung</span>
                <select value={filters.content} onChange={(event) => changeFilter('content', event.target.value)}>
                  <option value="all">Tất cả nội dung</option>
                  <option value="training">Đào tạo liên tục</option>
                  <option value="compliance">Tỷ lệ tuân thủ chung</option>
                  <option value="knowledge">Trung bình điểm kiểm tra kiến thức</option>
                  <option value="skill">Trung bình điểm kiểm tra kỹ năng</option>
                  <option value="classification">Phân loại năng lực</option>
                </select>
              </label>
              <p className="overview-filter-hint">
                Tuân thủ và năng lực dùng toàn bộ khoảng ngày; đào tạo liên tục được tính tại mốc Đến ngày theo mục tiêu 5 năm.
              </p>
            </div>
          )}
        </section>
      )}

      {error && <div className="overview-error" role="alert"><AlertOutlined /> {error}</div>}

      {loading ? (
        isStaff && <section className="overview-summary overview-summary--loading"><LoadingBlock /></section>
      ) : isStaff ? (
        <section className="overview-summary">
          <SummaryCard
            icon={<TeamOutlined />}
            label={isStaff ? 'Hồ sơ theo dõi' : 'Tổng nhân viên'}
            value={formatNumber(summary.total)}
            detail={summary.totalDetail}
            tone="blue"
            onOpen={onSummaryOpen ? () => onSummaryOpen('total') : undefined}
          />
          <SummaryCard
            icon={<CheckCircleOutlined />}
            label="Đạt yêu cầu"
            value={formatNumber(summary.passed)}
            detail={summary.passedDetail}
            tone="green"
            onOpen={onSummaryOpen ? () => onSummaryOpen('passed') : undefined}
          />
          <SummaryCard
            icon={<AlertOutlined />}
            label="Chưa đạt"
            value={formatNumber(summary.failed)}
            detail={summary.failedDetail}
            tone="red"
            onOpen={onSummaryOpen ? () => onSummaryOpen('failed') : undefined}
          />
          <SummaryCard
            icon={<SafetyCertificateOutlined />}
            label="Tỷ lệ đạt"
            value={formatPercent(summary.rate)}
            detail={summary.rateDetail}
            tone="violet"
            onOpen={onSummaryOpen ? () => onSummaryOpen('rate') : undefined}
          />
        </section>
      ) : null}

      {isStaff ? (
        <section className="overview-domain-grid" aria-label="Các dashboard năng lực">
          {visibleTypes.map((type) => (
            <DomainCard
              key={type}
              type={type}
              data={{ ...domains[type], loading }}
              onOpen={domains[type].path ? () => onNavigate(domains[type].path) : undefined}
            />
          ))}
        </section>
      ) : (
        <>
          <section className="overview-management-kpis" aria-label="Chỉ số tổng quan">
            {managementTypes.map((type) => (
              <ManagementKpiCard
                key={type}
                type={type}
                data={domains[type]}
                content={filters.content}
                onOpen={domains[type]?.path ? () => onNavigate(domains[type].path) : undefined}
              />
            ))}
          </section>
          {showComplianceSection && (showComplianceDetails ? (
            <ComplianceDetails
              items={complianceChart}
              trends={complianceTrends}
              loading={complianceTrendsLoading}
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              onBack={closeComplianceDetails}
            />
          ) : (
            <ComplianceTargetChart
              items={complianceChart}
              loading={loading}
              onDetails={openComplianceDetails}
            />
          ))}
        </>
      )}

    </div>
  )
}
