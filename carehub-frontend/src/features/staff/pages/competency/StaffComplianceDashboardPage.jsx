import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AppShell from '../../../../shared/components/AppShell.jsx'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../../shared/components/EmptyState.jsx'
import { myCompetencyApi } from '../../../evaluation/api/myCompetencyApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../../evaluation/utils/documentQuestionUi.js'
import './StaffComplianceDashboardPage.css'

const today = () => {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const currentYear = () => new Date().getFullYear()
const defaultFrom = () => `${currentYear()}-01-01`

const percentageFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatPercent(value) {
  const numeric = Number(value)
  return percentageFormatter.format(Number.isFinite(numeric) ? numeric : 0)
}

function truncateLabel(value) {
  const text = String(value || 'Bảng kiểm')
  return text.length > 18 ? `${text.slice(0, 17)}…` : text
}

function SearchForm({ filters, onChange, onApply, onClear, dateError, mobile = false }) {
  return (
    <div className={`scd-search-form${mobile ? ' scd-search-form--mobile' : ''}`}>
      <label>
        <span>Tên bảng kiểm</span>
        <div className="scd-search-input">
          <SearchOutlined aria-hidden="true" />
          <input
            value={filters.q}
            onChange={event => onChange({ q: event.target.value })}
            onKeyDown={event => event.key === 'Enter' && onApply()}
            placeholder="Tìm tên bảng kiểm..."
            aria-label="Tìm tên bảng kiểm"
            data-mobile-search-autofocus={mobile ? true : undefined}
          />
        </div>
      </label>
      <label>
        <span>Từ ngày</span>
        <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={event => onChange({ dateFrom: event.target.value })} aria-label="Từ ngày tuân thủ" />
      </label>
      <label>
        <span>Đến ngày</span>
        <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} max={today()} onChange={event => onChange({ dateTo: event.target.value })} aria-label="Đến ngày tuân thủ" />
      </label>
      {dateError && <p className="scd-search-error" role="alert">{dateError}</p>}
      <div className="scd-search-actions">
        <button type="button" className="scd-button scd-button--ghost" onClick={onClear}>Xóa bộ lọc</button>
        <button type="button" className="scd-button scd-button--primary" onClick={onApply}>Áp dụng</button>
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, suffix, tone }) {
  return (
    <article className={`scd-summary-card scd-summary-card--${tone}`}>
      <span className="scd-summary-card__icon" aria-hidden="true">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}{suffix && <small>{suffix}</small>}</strong>
      </div>
    </article>
  )
}

function StaffComplianceDashboardPage() {
  const navigate = useNavigate()
  const [chartYear, setChartYear] = useState(currentYear())
  const [chart, setChart] = useState(null)
  const [overview, setOverview] = useState(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [chartError, setChartError] = useState('')
  const [overviewError, setOverviewError] = useState('')
  const [draftFilters, setDraftFilters] = useState({ q: '', dateFrom: defaultFrom(), dateTo: today() })
  const [dateError, setDateError] = useState('')

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError('')
    try {
      setOverview(apiData(await myCompetencyApi.getComplianceOverview({ fromDate: defaultFrom(), toDate: today() }), null))
    } catch (error) {
      setOverviewError(apiErrorMessage(error))
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const loadChart = useCallback(async () => {
    setChartLoading(true)
    setChartError('')
    try {
      setChart(apiData(await myCompetencyApi.getComplianceChart({ year: chartYear }), null))
    } catch (error) {
      setChartError(apiErrorMessage(error))
    } finally {
      setChartLoading(false)
    }
  }, [chartYear])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { loadChart() }, [loadChart])

  const summary = overview || {}
  const totalEvaluations = Number(summary.totalEvaluations || 0)
  const complianceRate = Number(summary.complianceRate || 0)
  const availableYears = chart?.availableYears?.length ? chart.availableYears : [currentYear()]
  const latest = summary.latest
  const chartData = useMemo(() => (chart?.items || []).map(item => ({
    ...item,
    label: truncateLabel(item.formName),
  })), [chart])

  const updateFilters = values => setDraftFilters(current => ({ ...current, ...values }))
  const clearFilters = () => {
    setDraftFilters({ q: '', dateFrom: defaultFrom(), dateTo: today() })
    setDateError('')
  }
  const applyFilters = () => {
    if (draftFilters.dateFrom && draftFilters.dateTo && draftFilters.dateFrom > draftFilters.dateTo) {
      setDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return false
    }
    setDateError('')
    const params = new URLSearchParams()
    if (draftFilters.q.trim()) params.set('q', draftFilters.q.trim())
    if (draftFilters.dateFrom) params.set('dateFrom', draftFilters.dateFrom)
    if (draftFilters.dateTo) params.set('dateTo', draftFilters.dateTo)
    navigate(`/staff/competency/all?${params.toString()}`)
    return true
  }

  const mobileSearch = ({ close }) => (
    <SearchForm
      filters={draftFilters}
      onChange={updateFilters}
      onClear={clearFilters}
      onApply={() => { if (applyFilters()) close() }}
      dateError={dateError}
      mobile
    />
  )

  const retryOverview = () => loadOverview()
  const retryChart = () => loadChart()

  return (
    <AppShell
      title="Tuân thủ quy trình, quy định"
      className="staff-compliance-dashboard-shell"
      breadcrumbs={[{ label: 'Tuân thủ quy trình, quy định' }]}
      mobileSearch={{
        title: 'Tìm kiếm bảng kiểm',
        ariaLabel: 'Mở tìm kiếm bảng kiểm tuân thủ',
        activeCount: Number(Boolean(draftFilters.q))
          + Number(Boolean(draftFilters.dateFrom && draftFilters.dateFrom !== defaultFrom()))
          + Number(Boolean(draftFilters.dateTo && draftFilters.dateTo !== today())),
        renderContent: mobileSearch,
      }}
    >
      <div className="scd-page">
        <section className="scd-toolbar" aria-label="Bộ lọc tuân thủ cá nhân">
          <div className="scd-toolbar__title">
            <span>Đánh giá tuân thủ cá nhân</span>
            <strong>{defaultFrom()} → {today()}</strong>
          </div>
          <SearchForm filters={draftFilters} onChange={updateFilters} onClear={clearFilters} onApply={applyFilters} dateError={dateError} />
        </section>

        <section className="scd-summary-grid" aria-label="Tổng quan tuân thủ" data-compliance-section="summary">
          {overviewLoading ? <div className="scd-state scd-state--wide"><LoadingState label="Đang tải tổng quan tuân thủ..." /></div> : overviewError ? (
            <div className="scd-state scd-state--wide" role="alert"><span>{overviewError}</span><button type="button" onClick={retryOverview}><ReloadOutlined /> Thử lại</button></div>
          ) : (
            <>
              <SummaryCard tone="total" icon={<SafetyCertificateOutlined />} label="Tổng số lượt được chấm" value={totalEvaluations} />
              <SummaryCard tone="rate" icon={<CheckCircleFilled />} label="Tỷ lệ tuân thủ" value={formatPercent(complianceRate)} suffix="%" />
            </>
          )}
        </section>

        <section className="scd-chart-card" aria-labelledby="scd-chart-title" data-compliance-section="chart">
          <header className="scd-section-header">
            <div>
              <span className="scd-eyebrow">Theo bảng kiểm</span>
              <h2 id="scd-chart-title">Tỷ lệ tuân thủ và mục tiêu</h2>
              <p>Màu xanh là mục tiêu, màu vàng là tỷ lệ tuân thủ của bạn.</p>
            </div>
            <label className="scd-year-select">
              <span>Năm biểu đồ</span>
              <select value={chartYear} onChange={event => setChartYear(Number(event.target.value))} aria-label="Năm biểu đồ tuân thủ">
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </header>
          {chartLoading ? <div className="scd-chart-state"><LoadingState label="Đang tải biểu đồ..." /></div> : chartError ? (
            <div className="scd-chart-state scd-chart-state--error" role="alert"><span>{chartError}</span><button type="button" onClick={retryChart}><ReloadOutlined /> Thử lại</button></div>
          ) : !chartData.length ? <div className="scd-chart-state"><EmptyState>Chưa có lượt chấm trong năm {chartYear}.</EmptyState></div> : (
            <div className="scd-chart-scroll">
              <div className="scd-chart-inner" style={{ minWidth: Math.max(620, chartData.length * 100) }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 14, right: 18, left: 0, bottom: 62 }}
                    barGap={0}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5eeeb" />
                    <XAxis dataKey="label" interval={0} angle={-32} textAnchor="end" height={72} tick={{ fontSize: 11, fill: '#647b74' }} />
                    <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 11, fill: '#647b74' }} />
                    <Tooltip formatter={(value, name) => [`${formatPercent(value)}%`, name === 'targetPercent' ? 'Mục tiêu' : 'Tuân thủ']} labelFormatter={(_, payload) => payload?.[0]?.payload?.formName || ''} />
                    <Bar dataKey="targetPercent" name="Mục tiêu" fill="#1677c8" radius={[4, 4, 0, 0]} barSize={34} />
                    <Bar dataKey="complianceRate" name="Tuân thủ" fill="#e6a21a" radius={[4, 4, 0, 0]} barSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        <section className="scd-latest-card" aria-labelledby="scd-latest-title" data-compliance-section="latest">
          <header className="scd-section-header">
            <div>
              <span className="scd-eyebrow">Mới nhất</span>
              <h2 id="scd-latest-title">Bảng kiểm được chấm gần nhất</h2>
            </div>
            <button type="button" className="scd-view-all" onClick={() => navigate('/staff/competency/all')}>Xem toàn bộ <ArrowRightOutlined /></button>
          </header>
          {overviewLoading ? <div className="scd-latest-state"><LoadingState label="Đang tải bảng kiểm gần nhất..." /></div> : overviewError ? <div className="scd-latest-state" role="alert">Không thể tải bảng kiểm gần nhất.</div> : !latest ? <div className="scd-latest-state"><EmptyState>Chưa có lượt chấm trong năm hiện tại.</EmptyState></div> : (
            <div className="scd-latest-content">
              <div className="scd-latest-icon"><BarChartOutlined /></div>
              <div className="scd-latest-main"><strong>{latest.formName}</strong><span>Chấm gần nhất: {formatDateTime(latest.latestEvaluatedAt)}</span></div>
              <div className="scd-latest-metric"><span>Lượt giám sát</span><strong>{latest.evaluationCount || 0}</strong></div>
              <div className="scd-latest-metric"><span>Tỷ lệ tuân thủ</span><strong>{formatPercent(latest.complianceRate)}%</strong></div>
              <div className="scd-latest-metric"><span>Mục tiêu</span><strong>{formatPercent(latest.targetPercent)}%</strong><small>{latest.targetSource === 'DEFAULT' ? 'Mặc định hệ thống' : 'Theo bảng kiểm'}</small></div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}

export default StaffComplianceDashboardPage
