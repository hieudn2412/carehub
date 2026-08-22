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
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import SearchableSelect from '../../../../shared/components/SearchableSelect.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'
import { getRolesFromAccessToken } from '../../../../shared/auth/jwt.js'
import { tokenStorage } from '../../../../shared/auth/tokenStorage.js'
import TrainingRecordTable from './components/TrainingRecordTable.jsx'
import { formatTrainingDate } from './utils/trainingRecordFormatters.js'
import {
  formatChartHours,
  formatChartNumber,
  normalizeChartYears,
  truncateChartLabel,
} from './utils/trainingOverviewChart.js'
import '../../../training/styles/TrainingHours.css'

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

function wrapMobileChartLabel(value, maxCharacters = 18) {
  const words = String(value || 'Chưa xác định').trim().split(/\s+/)
  return words.reduce((lines, word) => {
    const currentLine = lines.at(-1) || ''
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (!currentLine || candidate.length <= maxCharacters) {
      if (lines.length) lines[lines.length - 1] = candidate
      else lines.push(candidate)
    } else {
      lines.push(word)
    }
    return lines
  }, [])
}

function MobileChartTick({ x, y, payload }) {
  const lines = wrapMobileChartLabel(payload?.value)
  return (
    <g transform={`translate(${x},${y})`}>
      <text fill="#64748b" fontSize="9" textAnchor="middle">
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x="0" dy={index === 0 ? 12 : 11}>{line}</tspan>
        ))}
      </text>
    </g>
  )
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  ))
  const chartRequestIdRef = useRef(0)
  const latestRequestIdRef = useRef(0)

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

  const compliance = getComplianceState(statusData)
  const bannerClass = !compliance.configured
    ? 'th-compliance-banner--neutral'
    : compliance.compliant
      ? 'th-compliance-banner--success'
      : 'th-compliance-banner--warning'
  const chartMinWidth = isMobileViewport
    ? Math.max(330, chartFields.length * 150)
    : Math.max(640, chartFields.length * 92)

  return (
    <AppShell
      className="training-hours-overview-shell"
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
              <SearchableSelect
                value={String(chartYear)}
                onChange={val => setChartYear(Number(val))}
                ariaLabel="Năm biểu đồ"
                searchable={false}
                options={chartAvailableYears.map(year => ({ value: String(year), label: String(year) }))}
              />
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
                <ResponsiveContainer width="100%" height={isMobileViewport ? 170 : 300}>
                  <BarChart
                    data={chartFields}
                    margin={isMobileViewport
                      ? { top: 10, right: 8, bottom: 4, left: 0 }
                      : { top: 20, right: 20, bottom: 24, left: 4 }}
                    accessibilityLayer
                  >
                    <CartesianGrid stroke="#e8efed" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="professionalFieldName"
                      tickFormatter={isMobileViewport ? undefined : value => truncateChartLabel(value)}
                      interval={0}
                      angle={0}
                      textAnchor="middle"
                      height={isMobileViewport ? 58 : 64}
                      tick={isMobileViewport ? <MobileChartTick /> : { fill: '#64748b', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#dce7e4' }}
                    />
                    <YAxis
                      tickFormatter={formatChartNumber}
                      allowDecimals
                      width={isMobileViewport ? 36 : 50}
                      tick={{ fill: '#64748b', fontSize: isMobileViewport ? 10 : 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<TrainingHoursChartTooltip />} cursor={{ fill: 'rgba(26, 170, 132, 0.08)' }} />
                    <Bar
                      dataKey="submittedHours"
                      fill="#1aaa84"
                      radius={[7, 7, 0, 0]}
                      maxBarSize={isMobileViewport ? 36 : 58}
                    />
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

        {/* Thao tác chính của màn hình này là khai báo giờ, nên nút nằm ngay dưới thẻ tiến độ
            thay vì trong header thẻ hồ sơ — trên mobile người dùng không phải cuộn để thấy nó. */}
        <div className="th-overview-primary-action">
          <button
            type="button"
            className="th-btn-primary"
            onClick={() => navigate('/staff/training/new')}
          >
            <PlusOutlined /> Cập nhật giờ đào tạo
          </button>
        </div>

        <section className="th-overview-card th-overview-card--latest th-table-card" data-overview-section="latest" aria-labelledby="training-latest-title">
          <div className="th-overview-card__header">
            <div className="th-overview-card__header-copy">
              <span className="th-overview-card__eyebrow">Hồ sơ</span>
              <h2 className="th-overview-card__title" id="training-latest-title">
                Giờ đào tạo gần nhất
              </h2>
            </div>
            <div className="th-overview-card__actions">
              <button
                type="button"
                className="th-overview-link"
                onClick={() => navigate('/staff/training/all')}
              >
                Xem tất cả <ArrowRightOutlined />
              </button>
            </div>
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
