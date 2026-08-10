import { useEffect, useState } from 'react'
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
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(1).replace('.', ',') : '—'
}

function ManagementKpiCard({ type, data, onOpen }) {
  const total = Number(data?.total) || 0
  const passed = Number(data?.passed) || 0
  const rate = Number(data?.rate) || 0
  const available = data?.available !== false
  const labels = {
    training: 'Đào tạo liên tục',
    quality: 'Tuân thủ chung',
    exams: 'Đạt năng lực chuyên môn',
  }
  const primaryValue = type === 'training'
    ? '≥ 120h'
    : type === 'exams'
      ? `TB ${formatScore(data?.overallAverage)}/10`
      : `${formatNumber(passed)}/${formatNumber(total)}`
  const detail = type === 'training'
    ? 'Chuẩn đào tạo liên tục'
    : type === 'quality'
      ? 'Theo điểm sàn và điểm liệt'
      : `Từ 01/01 đến hôm nay · Lý thuyết ${formatScore(data?.knowledgeAverage)} · Kỹ năng ${formatScore(data?.skillAverage)}${data?.targetScore == null ? ' · Theo ngưỡng từng khoa' : ` · Ngưỡng ${formatScore(data.targetScore)}`}`

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
          <b>{formatPercent(rate)}</b>
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
    <section className="overview-compliance-chart" aria-label="So sánh mục tiêu và thực tế theo bảng kiểm">
      <header>
        <div>
          <h2>Mức độ tuân thủ theo bảng kiểm</h2>
          <p>So sánh mục tiêu đang áp dụng với tỷ lệ thực tế đạt được.</p>
        </div>
        <div className="overview-compliance-chart__actions">
          <span>{items.length} bảng kiểm</span>
          <button type="button" onClick={onDetails}>Xem chi tiết <ArrowRightOutlined /></button>
        </div>
      </header>
      <div className="overview-compliance-chart__canvas">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} margin={{ top: 16, right: 18, left: 0, bottom: 74 }} barGap={4}>
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
            <Bar dataKey="target" name="Mục tiêu" fill="#d4d9df" radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Bar dataKey="actual" name="Thực tế đạt được" fill="#0d8a78" radius={[4, 4, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function complianceTrend(items = []) {
  const resultsByPeriod = new Map(items.map((item) => [item.period, {
    total: Number(item.submittedCount) || 0,
    passed: Number(item.passedCount) || 0,
  }]))
  const today = new Date()
  const year = today.getFullYear()
  const cursor = new Date(year, 0, 1)
  const timeline = []
  let cumulativeTotal = 0
  let cumulativePassed = 0
  while (cursor <= today) {
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const day = String(cursor.getDate()).padStart(2, '0')
    const period = `${year}-${month}-${day}`
    const result = resultsByPeriod.get(period)
    cumulativeTotal += result?.total || 0
    cumulativePassed += result?.passed || 0
    timeline.push({
      period,
      rate: cumulativeTotal ? cumulativePassed * 100 / cumulativeTotal : null,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return timeline
}

function monthTicks() {
  const today = new Date()
  const year = today.getFullYear()
  return Array.from({ length: today.getMonth() + 1 }, (_, index) => (
    `${year}-${String(index + 1).padStart(2, '0')}-01`
  ))
}

function monthLabel(value) {
  return `T${Number(String(value).slice(5, 7))}`
}

function dateLabel(value) {
  const [year, month, day] = String(value).split('-')
  return `${day}/${month}/${year}`
}

function ComplianceDetailCard({ item, trend, loading }) {
  const hasTimeline = trend.length > 0
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
            <LineChart data={trend} margin={{ top: 12, right: 10, bottom: 4, left: -12 }}>
              <CartesianGrid stroke="#edf1f4" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                axisLine={{ stroke: '#aab4c0' }}
                tick={{ fill: '#667085', fontSize: 9 }}
                tickLine={false}
                ticks={monthTicks()}
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
                formatter={(value) => [formatPercent(value), 'Tỷ lệ tuân thủ']}
                labelFormatter={(label) => `Ngày ${dateLabel(label)}`}
                contentStyle={{ border: '1px solid #dce5ec', borderRadius: 8, fontSize: 11 }}
              />
              <ReferenceLine
                y={item.target}
                stroke="#d97706"
                strokeDasharray="5 4"
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#0d8a78"
                strokeWidth={2}
                dot={(props) => (props.payload.rate == null ? null : (
                  <circle cx={props.cx} cy={props.cy} r="2.5" fill="#0d8a78" />
                ))}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : <span>Chưa đủ dữ liệu để hiển thị xu hướng</span>}
      </div>
      <div className="overview-checklist-card__legend" aria-hidden="true">
        <span><i className="is-actual" />Tuân thủ thực tế</span>
        <span><i className="is-target" />Mục tiêu</span>
      </div>
    </article>
  )
}

function ComplianceDetails({ items, trends, loading, onBack }) {
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
  complianceChart = [],
  onLoadComplianceTrend,
  visibleDomains = ['training', 'exams', 'quality'],
}) {
  const isStaff = role === 'staff'
  const visibleTypes = visibleDomains.filter((type) => DOMAIN_META[type] && domains[type])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [showComplianceDetails, setShowComplianceDetails] = useState(false)
  const [complianceTrends, setComplianceTrends] = useState({})
  const [complianceTrendsLoading, setComplianceTrendsLoading] = useState(false)
  const activeFilterCount = [
    role === 'admin' && filters.departmentId,
  ].filter(Boolean).length

  useEffect(() => {
    setShowComplianceDetails(false)
    setComplianceTrends({})
  }, [complianceChart])

  const openComplianceDetails = async () => {
    setShowComplianceDetails(true)
    if (!onLoadComplianceTrend || !complianceChart.length) return
    setComplianceTrendsLoading(true)
    const results = await Promise.allSettled(
      complianceChart.map((item) => onLoadComplianceTrend(item.id)),
    )
    setComplianceTrends(Object.fromEntries(results.map((result, index) => [
      complianceChart[index].id,
      result.status === 'fulfilled' ? complianceTrend(result.value) : [],
    ])))
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
                    onChange={(value) => onFilterChange('departmentId', value)}
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
            {['training', 'quality', 'exams'].map((type) => (
              <ManagementKpiCard
                key={type}
                type={type}
                data={domains[type]}
                onOpen={domains[type]?.path ? () => onNavigate(domains[type].path) : undefined}
              />
            ))}
          </section>
          {showComplianceDetails ? (
            <ComplianceDetails
              items={complianceChart}
              trends={complianceTrends}
              loading={complianceTrendsLoading}
              onBack={() => setShowComplianceDetails(false)}
            />
          ) : (
            <ComplianceTargetChart
              items={complianceChart}
              loading={loading}
              onDetails={openComplianceDetails}
            />
          )}
        </>
      )}

    </div>
  )
}
