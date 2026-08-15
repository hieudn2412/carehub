import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRightOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'
import { getRolesFromAccessToken } from '../../../../features/auth/utils/jwt.js'
import { tokenStorage } from '../../../../features/auth/services/tokenStorage.js'
import TrainingRecordTable from './components/TrainingRecordTable.jsx'
import TrainingSearchFilters from './components/TrainingSearchFilters.jsx'
import { formatTrainingDate } from './utils/trainingRecordFormatters.js'
import {
  formatChartHours,
  formatChartNumber,
  normalizeChartYears,
  truncateChartLabel,
} from './utils/trainingOverviewChart.js'
import {
  buildTrainingAllUrl,
  countActiveFilterGroups,
  createEmptyTrainingFilters,
  isDateRangeValid,
} from './utils/trainingRecordQuery.js'
import '../../styles/TrainingHours.css'

function getDashboardPath() {
  const roles = getRolesFromAccessToken(tokenStorage.getAccessToken())
  const isAdmin = roles.some(role => String(role).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(role => String(role).toUpperCase().includes('MANAGER'))

  return isAdmin
    ? '/admin/dashboard'
    : isManager
      ? '/manager/dashboard'
      : '/staff/dashboard'
}

function getComplianceState(statusData) {
  const configured = Boolean(statusData) && statusData.status !== 'NOT_CONFIGURED'
  const submittedHours = Number(statusData?.submittedHours || 0)
  const requiredHours = configured ? Number(statusData?.requiredHours ?? 0) : 0
  const compliant = requiredHours > 0 && submittedHours >= requiredHours
  const progress = requiredHours > 0
    ? Math.min(Math.round((submittedHours / requiredHours) * 100), 100)
    : 0

  return { configured, submittedHours, requiredHours, compliant, progress }
}

function OverviewCardState({ state = 'empty', className = '', children }) {
  const stateClassName = `th-overview-card__state th-overview-card__state--${state}`
  const role = state === 'error' ? 'alert' : 'status'

  return (
    <div className={`${stateClassName}${className ? ` ${className}` : ''}`} role={role}>
      {children}
    </div>
  )
}

function TrainingHoursChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const field = payload[0]?.payload
  return (
    <div className="th-overview-chart-tooltip">
      <strong>{field?.professionalFieldName || 'Chưa xác định'}</strong>
      <span>{formatChartHours(field?.submittedHours)}</span>
    </div>
  )
}

function TrainingHoursOverviewScreen() {
  const navigate = useNavigate()
  const dashboardPath = getDashboardPath()
  const [statusData, setStatusData] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [chartYear, setChartYear] = useState(() => new Date().getFullYear())
  const [chartAvailableYears, setChartAvailableYears] = useState(() => [new Date().getFullYear()])
  const [chartFields, setChartFields] = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartError, setChartError] = useState('')
  const [latestRecord, setLatestRecord] = useState(null)
  const [latestLoading, setLatestLoading] = useState(true)
  const [latestError, setLatestError] = useState('')
  const [overviewSearch, setOverviewSearch] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState(createEmptyTrainingFilters)
  const [filterOptions, setFilterOptions] = useState({ activityTypes: [], professionalFields: [] })
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false)
  const [filterOptionsError, setFilterOptionsError] = useState('')
  const [filterDateError, setFilterDateError] = useState('')
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  ))
  const chartRequestIdRef = useRef(0)
  const latestRequestIdRef = useRef(0)
  const filterControlRef = useRef(null)

  const loadStatus = useCallback(() => {
    setStatusLoading(true)
    setStatusError('')
    trainingApi.getMyTrainingStatus()
      .then(response => setStatusData(response.data?.data || null))
      .catch(() => setStatusError('Không thể tải tiến độ giờ đào tạo.'))
      .finally(() => setStatusLoading(false))
  }, [])

  const loadChart = useCallback(async (year) => {
    const requestId = chartRequestIdRef.current + 1
    chartRequestIdRef.current = requestId
    setChartLoading(true)
    setChartError('')

    try {
      const response = await trainingApi.getMyProfessionalFieldHours({ year })
      if (requestId !== chartRequestIdRef.current) return

      const chartData = response.data?.data || {}
      setChartFields(Array.isArray(chartData.fields) ? chartData.fields : [])
      setChartAvailableYears(normalizeChartYears(chartData.availableYears, year))
    } catch {
      if (requestId !== chartRequestIdRef.current) return
      setChartFields([])
      setChartError('Không thể tải biểu đồ giờ đào tạo.')
    } finally {
      if (requestId === chartRequestIdRef.current) {
        setChartLoading(false)
      }
    }
  }, [])

  const loadLatestRecord = useCallback(async () => {
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId
    setLatestLoading(true)
    setLatestError('')

    try {
      const profileResponse = await staffApi.getProfile()
      const employeeId = profileResponse.data?.data?.id
      if (employeeId == null) {
        throw new Error('Employee profile is missing')
      }

      const recordsResponse = await trainingApi.listRecords({
        employeeId,
        workflowStatus: 'SUBMITTED',
        page: 0,
        size: 1,
        sort: 'submittedAt,desc',
      })
      if (requestId !== latestRequestIdRef.current) return

      const records = recordsResponse.data?.data?.content
      setLatestRecord(Array.isArray(records) ? (records[0] || null) : null)
    } catch {
      if (requestId !== latestRequestIdRef.current) return
      setLatestRecord(null)
      setLatestError('Không thể tải hồ sơ giờ đào tạo gần nhất.')
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLatestLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    loadChart(chartYear)
    return () => {
      chartRequestIdRef.current += 1
    }
  }, [chartYear, loadChart])

  useEffect(() => {
    loadLatestRecord()
    return () => {
      latestRequestIdRef.current += 1
    }
  }, [loadLatestRecord])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleViewportChange = event => setIsMobileViewport(event.matches)
    setIsMobileViewport(mediaQuery.matches)
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handleViewportChange)
    else mediaQuery.addListener?.(handleViewportChange)

    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', handleViewportChange)
      else mediaQuery.removeListener?.(handleViewportChange)
    }
  }, [])

  useEffect(() => {
    if (!isFilterOpen) return undefined

    const handlePointerDown = event => {
      if (!filterControlRef.current?.contains(event.target)) {
        setIsFilterOpen(false)
        setFilterDateError('')
      }
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
        setFilterDateError('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFilterOpen])

  const loadFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true)
    setFilterOptionsError('')
    try {
      const response = await trainingApi.getRecordOptions()
      const data = response.data?.data || {}
      setFilterOptions({
        activityTypes: Array.isArray(data.activityTypes) ? data.activityTypes : [],
        professionalFields: Array.isArray(data.professionalFields) ? data.professionalFields : [],
      })
    } catch {
      setFilterOptionsError('Không thể tải danh sách bộ lọc.')
    } finally {
      setFilterOptionsLoading(false)
    }
  }, [])

  const compliance = getComplianceState(statusData)
  const bannerClass = !compliance.configured
    ? 'th-compliance-banner--neutral'
    : compliance.compliant
      ? 'th-compliance-banner--success'
      : 'th-compliance-banner--warning'
  const chartMinWidth = Math.max(640, chartFields.length * 92)

  const handleOverviewSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return

    const query = overviewSearch.trim()
    navigate(buildTrainingAllUrl({ q: query, page: 1 }))
  }

  const handleFilterToggle = () => {
    const nextOpen = !isFilterOpen
    setIsFilterOpen(nextOpen)
    if (nextOpen && !filterOptionsLoading && !filterOptionsError && !filterOptions.activityTypes.length && !filterOptions.professionalFields.length) {
      loadFilterOptions()
    }
    if (!nextOpen) setFilterDateError('')
  }

  const handleApplyFilters = () => {
    if (!isDateRangeValid(filterDraft.dateFrom, filterDraft.dateTo)) {
      setFilterDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return
    }

    navigate(buildTrainingAllUrl({ ...filterDraft, page: 1 }))
    setFilterDateError('')
    setIsFilterOpen(false)
  }

  const handleClearFilters = () => {
    setFilterDraft(createEmptyTrainingFilters())
    setFilterDateError('')
  }

  const handleMobileApplyFilters = (close) => {
    if (!isDateRangeValid(filterDraft.dateFrom, filterDraft.dateTo)) {
      setFilterDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return
    }

    navigate(buildTrainingAllUrl({ ...filterDraft, q: overviewSearch.trim(), page: 1 }))
    setFilterDateError('')
    close()
  }

  const renderMobileSearch = ({ close }) => (
    <TrainingSearchFilters
      searchValue={overviewSearch}
      onSearchChange={setOverviewSearch}
      onSearchKeyDown={event => {
        if (event.key === 'Enter') handleMobileApplyFilters(close)
      }}
      filters={filterDraft}
      onFilterChange={setFilterDraft}
      filterOptions={filterOptions}
      filterOptionsLoading={filterOptionsLoading}
      filterOptionsError={filterOptionsError}
      onRetryOptions={loadFilterOptions}
      dateError={filterDateError}
      onClear={handleClearFilters}
      onApply={() => handleMobileApplyFilters(close)}
    />
  )

  const mobileSearchActiveCount = (overviewSearch.trim() ? 1 : 0) + countActiveFilterGroups(filterDraft)

  return (
    <AppShell
      className="training-hours-overview-shell"
      mobileSearch={{
        title: 'Tìm kiếm giờ đào tạo',
        ariaLabel: 'Mở tìm kiếm và bộ lọc giờ đào tạo',
        activeCount: mobileSearchActiveCount,
        onOpen: () => {
          if (!filterOptionsLoading && !filterOptionsError && !filterOptions.activityTypes.length && !filterOptions.professionalFields.length) {
            loadFilterOptions()
          }
        },
        renderContent: renderMobileSearch,
      }}
      breadcrumbs={[
        { label: 'Tổng quan', link: dashboardPath },
        { label: 'Giờ đào tạo liên tục' },
      ]}
    >
      <div className="training-page training-page--overview">
        <section className="th-overview-card th-overview-card--chart th-table-card" data-overview-section="chart" aria-labelledby="training-chart-title">
          <div className="th-overview-card__header">
            <div className="th-overview-card__header-copy">
              <span className="th-overview-card__eyebrow">Tổng hợp</span>
              <h1 className="th-overview-card__title" id="training-chart-title">
                Giờ đào tạo theo lĩnh vực
              </h1>
              <p className="th-overview-card__description">
                Theo dõi tổng số giờ đã nộp theo từng lĩnh vực chuyên môn.
              </p>
            </div>
            <label className="th-overview-year-select">
              <span>Năm biểu đồ</span>
              <select
                value={chartYear}
                onChange={event => setChartYear(Number(event.target.value))}
                aria-label="Năm biểu đồ"
              >
                {chartAvailableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
          {chartLoading ? (
            <OverviewCardState state="loading" className="th-overview-card__state--chart">
              <span className="th-overview-loading-dot" aria-hidden="true" />
              <p>Đang tải biểu đồ...</p>
            </OverviewCardState>
          ) : chartError ? (
            <OverviewCardState state="error" className="th-overview-card__state--chart">
              <p>{chartError}</p>
              <button type="button" className="th-retry-btn" onClick={() => loadChart(chartYear)}>
                <ReloadOutlined /> Thử lại biểu đồ
              </button>
            </OverviewCardState>
          ) : chartFields.length === 0 ? (
            <OverviewCardState state="empty" className="th-overview-card__state--chart">
              <p>Chưa có dữ liệu biểu đồ trong năm {chartYear}.</p>
              <span>Biểu đồ chỉ tổng hợp những hồ sơ đã nộp.</span>
            </OverviewCardState>
          ) : (
            <div className="th-overview-chart-scroll">
              <div
                className="th-overview-chart-canvas"
                style={{ minWidth: chartMinWidth }}
                role="img"
                aria-label={`Biểu đồ giờ đào tạo theo lĩnh vực năm ${chartYear}`}
              >
                <ResponsiveContainer width="100%" height={isMobileViewport ? 196 : 300}>
                  <BarChart
                    data={chartFields}
                    margin={{ top: 20, right: 20, bottom: 24, left: 4 }}
                    accessibilityLayer
                  >
                    <CartesianGrid stroke="#e8efed" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="professionalFieldName"
                      tickFormatter={value => truncateChartLabel(value)}
                      interval={0}
                      angle={isMobileViewport ? -45 : 0}
                      textAnchor={isMobileViewport ? 'end' : 'middle'}
                      height={isMobileViewport ? 62 : 64}
                      tick={{ fill: '#64748b', fontSize: isMobileViewport ? 10 : 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#dce7e4' }}
                    />
                    <YAxis
                      tickFormatter={formatChartNumber}
                      allowDecimals
                      width={50}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<TrainingHoursChartTooltip />} cursor={{ fill: 'rgba(26, 170, 132, 0.08)' }} />
                    <Bar dataKey="submittedHours" fill="#1aaa84" radius={[7, 7, 0, 0]} maxBarSize={58} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        <section className={`th-compliance-banner th-overview-progress ${bannerClass}`} data-overview-section="progress" aria-labelledby="training-overview-title">
          <div className="th-compliance-banner__left">
            <h2 className="th-page-title" id="training-overview-title">Giờ đào tạo liên tục</h2>
            <p className="th-page-subtitle">Tiến độ và cập nhật đào tạo cá nhân</p>
          </div>
          <div className="th-compliance-banner__right">
            {statusLoading ? (
              <span className="th-compliance-label" role="status">Đang tải tiến độ...</span>
            ) : statusError ? (
              <div className="th-overview-inline-error" role="alert">
                <span>{statusError}</span>
                <button type="button" className="th-overview-inline-error__retry" onClick={loadStatus}>
                  <ReloadOutlined /> Thử lại
                </button>
              </div>
            ) : compliance.configured ? (
              <>
                <div className="th-compliance-ring" aria-label={`Đã hoàn thành ${compliance.progress}%`}>
                  <svg viewBox="0 0 36 36" className="th-ring-svg" aria-hidden="true">
                    <path
                      className="th-ring-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="th-ring-fill"
                      strokeDasharray={`${compliance.progress}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="th-ring-value">{compliance.progress}%</span>
                </div>
                <span className={`th-compliance-status th-compliance-status--${compliance.compliant ? 'success' : 'warning'}`}>
                  {compliance.compliant ? 'Đạt' : 'Thiếu'}
                </span>
                <div className="th-compliance-stats">
                  <span className="th-compliance-total">
                    {compliance.submittedHours} <small>/ {compliance.requiredHours}h</small>
                  </span>
                  <span className="th-compliance-label">
                    {compliance.compliant
                      ? 'Đã hoàn thành mục tiêu'
                      : `Còn thiếu ${Math.max(compliance.requiredHours - compliance.submittedHours, 0)} giờ`}
                  </span>
                </div>
              </>
            ) : (
              <div className="th-compliance-stats">
                <span className="th-compliance-status th-compliance-status--neutral">Không áp dụng</span>
                <span className="th-compliance-label">Phòng ban không thuộc diện giờ đào tạo</span>
              </div>
            )}
          </div>
        </section>

        <section className="th-overview-toolbar th-table-card" ref={filterControlRef} data-overview-section="tools" aria-label="Tìm kiếm và thao tác giờ đào tạo">
          <div className="th-overview-search">
            <SearchOutlined className="th-overview-search__icon" aria-hidden="true" />
            <input
              value={overviewSearch}
              onChange={event => setOverviewSearch(event.target.value)}
              onKeyDown={handleOverviewSearchKeyDown}
              className="th-overview-search__input"
              placeholder="Tìm theo nội dung đào tạo..."
              aria-label="Tìm theo nội dung đào tạo"
            />
          </div>
          <button
            type="button"
            className="th-overview-filter-btn"
            onClick={handleFilterToggle}
            aria-label="Mở bộ lọc giờ đào tạo"
            aria-controls="training-overview-filter-panel"
            aria-expanded={isFilterOpen}
          >
            <FilterOutlined aria-hidden="true" /> Bộ lọc
            {countActiveFilterGroups(filterDraft) > 0 && (
              <span className="th-filter-active-count" aria-label={`${countActiveFilterGroups(filterDraft)} điều kiện đang chọn`}>
                {countActiveFilterGroups(filterDraft)}
              </span>
            )}
          </button>
          <button type="button" className="th-btn-primary" onClick={() => navigate('/staff/training/new')}>
            <PlusOutlined /> Cập nhật giờ đào tạo
          </button>
          <button type="button" className="th-overview-link" onClick={() => navigate('/staff/training/all')}>
            Xem danh sách tất cả <ArrowRightOutlined />
          </button>
          {isFilterOpen && (
            <div className="th-overview-filter-panel" id="training-overview-filter-panel" role="region" aria-label="Bộ lọc giờ đào tạo">
              <div className="th-overview-filter-panel__header">
                <strong>Bộ lọc giờ đào tạo</strong>
                <span>{countActiveFilterGroups(filterDraft)} điều kiện đang chọn</span>
              </div>
              {filterOptionsLoading ? (
                <div className="th-overview-filter-panel__state" role="status">Đang tải tùy chọn lọc...</div>
              ) : filterOptionsError ? (
                <div className="th-overview-filter-panel__state th-overview-filter-panel__state--error" role="alert">
                  <span>{filterOptionsError}</span>
                  <button type="button" className="th-retry-btn" onClick={loadFilterOptions}>Thử lại</button>
                </div>
              ) : (
                <div className="th-overview-filter-panel__grid">
                  <label>
                    <span>Trạng thái</span>
                    <select
                      value={filterDraft.status}
                      onChange={event => setFilterDraft(current => ({ ...current, status: event.target.value }))}
                      aria-label="Bộ lọc trạng thái"
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="SUBMITTED">Đã nộp</option>
                      <option value="DRAFT">Nháp</option>
                      <option value="CANCELLED">Đã hủy</option>
                    </select>
                  </label>
                  <label>
                    <span>Từ ngày</span>
                    <input
                      type="date"
                      value={filterDraft.dateFrom}
                      onChange={event => setFilterDraft(current => ({ ...current, dateFrom: event.target.value }))}
                      aria-label="Bộ lọc từ ngày"
                    />
                  </label>
                  <label>
                    <span>Đến ngày</span>
                    <input
                      type="date"
                      value={filterDraft.dateTo}
                      onChange={event => setFilterDraft(current => ({ ...current, dateTo: event.target.value }))}
                      aria-label="Bộ lọc đến ngày"
                    />
                  </label>
                  <label>
                    <span>Lĩnh vực chuyên môn</span>
                    <select
                      value={filterDraft.professionalFieldId}
                      onChange={event => setFilterDraft(current => ({ ...current, professionalFieldId: event.target.value }))}
                      aria-label="Bộ lọc lĩnh vực chuyên môn"
                    >
                      <option value="">Tất cả lĩnh vực</option>
                      {filterOptions.professionalFields.map(option => (
                        <option key={option.id} value={option.id}>{option.name || option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Hình thức đào tạo</span>
                    <select
                      value={filterDraft.activityTypeId}
                      onChange={event => setFilterDraft(current => ({ ...current, activityTypeId: event.target.value }))}
                      aria-label="Bộ lọc hình thức đào tạo"
                    >
                      <option value="">Tất cả hình thức</option>
                      {filterOptions.activityTypes.map(option => (
                        <option key={option.id} value={option.id}>{option.name || option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {filterDateError && <p className="th-overview-filter-panel__error" role="alert">{filterDateError}</p>}
              <div className="th-overview-filter-panel__actions">
                <button type="button" className="th-overview-filter-panel__clear" onClick={handleClearFilters}>Xóa bộ lọc</button>
                <button type="button" className="th-btn-primary" onClick={handleApplyFilters}>Áp dụng</button>
              </div>
            </div>
          )}
        </section>

        <section className="th-overview-card th-overview-card--latest th-table-card" data-overview-section="latest" aria-labelledby="training-latest-title">
          <div className="th-overview-card__header">
            <div className="th-overview-card__header-copy">
              <span className="th-overview-card__eyebrow">Hồ sơ</span>
              <h2 className="th-overview-card__title" id="training-latest-title">
                Giờ đào tạo gần nhất
              </h2>
            </div>
            <button type="button" className="th-overview-link th-overview-latest-mobile-link" onClick={() => navigate('/staff/training/all')}>
              Xem tất cả <ArrowRightOutlined />
            </button>
          </div>
          {latestLoading ? (
            <OverviewCardState state="loading" className="th-overview-card__state--latest">
              <span className="th-overview-loading-dot" aria-hidden="true" />
              <p>Đang tải hồ sơ gần nhất...</p>
            </OverviewCardState>
          ) : latestError ? (
            <OverviewCardState state="error" className="th-overview-card__state--latest">
              <p>{latestError}</p>
              <button type="button" className="th-retry-btn" onClick={loadLatestRecord}>
                <ReloadOutlined /> Thử lại hồ sơ gần nhất
              </button>
            </OverviewCardState>
          ) : !latestRecord ? (
            <OverviewCardState state="empty" className="th-overview-card__state--latest">
              <p>Chưa có hồ sơ giờ đào tạo đã nộp.</p>
              <span>Hồ sơ gần nhất sẽ xuất hiện sau khi bạn nộp thành công.</span>
            </OverviewCardState>
          ) : (
            isMobileViewport ? (
              <article className="th-overview-latest-card">
                <dl>
                  <div><dt>Nội dung</dt><dd>{latestRecord.title || '-'}</dd></div>
                  <div><dt>Thời gian</dt><dd>{formatTrainingDate(latestRecord.startDate)}</dd></div>
                  <div><dt>Lĩnh vực</dt><dd>{latestRecord.professionalFieldName || 'Chưa xác định'}</dd></div>
                  <div><dt>Số giờ</dt><dd>{latestRecord.declaredHours ?? 0} giờ</dd></div>
                  <div><dt>Trạng thái</dt><dd><span className="th-badge th-badge--success">Đã nộp</span></dd></div>
                </dl>
                <button type="button" className="th-btn-primary th-overview-latest-card__view" onClick={() => navigate(`/staff/training/${latestRecord.id}`)}>
                  Xem chi tiết
                </button>
              </article>
            ) : (
              <div className="th-overview-latest-table">
                <TrainingRecordTable
                  records={[latestRecord]}
                  columns={['date', 'title', 'hours', 'submitted', 'actions']}
                  actions={['view']}
                  onView={record => navigate(`/staff/training/${record.id}`)}
                />
              </div>
            )
          )}
        </section>
      </div>
    </AppShell>
  )
}

export default TrainingHoursOverviewScreen
