import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  TrophyOutlined,
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
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import { evaluationDashboardApi } from '../api/evaluationDashboardApi.js'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import { currentYearDateRange, validateHistoricalDateRange } from '../../../shared/utils/dateRange.js'
import '../styles/EvaluationDashboardPage.css'

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatNumber(value, digits = 0) {
  const number = numberOrNull(value)
  return number === null
    ? '—'
    : number.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatPercent(value) {
  const number = numberOrNull(value)
  return number === null ? '—' : `${(number * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

function unwrapList(response) {
  const data = apiData(response, [])
  if (Array.isArray(data)) return data
  return Array.isArray(data?.content) ? data.content : []
}

const DEFAULT_EVALUATION_DASHBOARD_DATES = currentYearDateRange()
const DEFAULT_EVALUATION_DASHBOARD_FILTERS = {
  departmentId: '',
  employeeId: '',
  fromDate: DEFAULT_EVALUATION_DASHBOARD_DATES.fromDate,
  paperId: '',
  professionalFieldId: '',
  resultStatus: '',
  toDate: DEFAULT_EVALUATION_DASHBOARD_DATES.toDate,
}

/**
 * Thân trang Dashboard lý thuyết, tách khỏi AppShell để nhúng được vào tab
 * "Dashboard lý thuyết" của trang Năng lực chuyên môn.
 */
export function EvaluationDashboardContent({ role = 'admin' }) {
  const isManager = role === 'manager'
  const { showToast } = useToast()
  const [departments, setDepartments] = useState([])
  const [papers, setPapers] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [summary, setSummary] = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [filters, setFilters] = useState(DEFAULT_EVALUATION_DASHBOARD_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_EVALUATION_DASHBOARD_FILTERS)

  useEffect(() => {
    let active = true
    async function loadOptions() {
      try {
        if (isManager) {
          const [assignmentResponse, profileResponse] = await Promise.all([
            examAssignmentApi.listManagerAssignments({}),
            staffApi.getProfile(),
          ])
          if (!active) return

          const assignmentItems = unwrapList(assignmentResponse)
          const managerProfile = apiData(profileResponse, null)
          const paperMap = new Map()
          const fieldMap = new Map()

          assignmentItems.forEach((assignment) => {
            if (assignment.examPaperId) {
              paperMap.set(String(assignment.examPaperId), {
                id: assignment.examPaperId,
                code: assignment.examPaperCode,
                name: assignment.examPaperName || assignment.name,
              })
            }
            if (assignment.professionalFieldId) {
              fieldMap.set(String(assignment.professionalFieldId), {
                id: assignment.professionalFieldId,
                code: assignment.professionalFieldCode,
                name: assignment.professionalFieldName,
              })
            }
          })

          setPapers([...paperMap.values()])
          setProfessionalFields([...fieldMap.values()])
          if (managerProfile?.departmentId) {
            const managerDepartmentId = String(managerProfile.departmentId)
            setDepartments([{
              id: managerProfile.departmentId,
              name: managerProfile.departmentName || 'Khoa của tôi',
            }])
            setFilters((current) => ({
              ...current,
              departmentId: managerDepartmentId,
            }))
            setAppliedFilters((current) => ({
              ...current,
              departmentId: managerDepartmentId,
            }))
          } else {
            setError('Tài khoản Quản lý cấp Khoa chưa được gán khoa/phòng.')
          }
          return
        }

        const [paperResponse, optionResponse, departmentResponse] = await Promise.all([
          examPaperApi.listExamPapers({}),
          trainingApi.getRecordOptions(),
          adminApi.getDepartments(),
        ])
        if (!active) return
        setPapers(unwrapList(paperResponse))
        setProfessionalFields(apiData(optionResponse, {}).professionalFields || [])
        setDepartments(unwrapList(departmentResponse))
      } catch (requestError) {
        if (!active) return
        setError(apiErrorMessage(requestError))
      }
    }
    loadOptions()
    return () => { active = false }
  }, [isManager])

  const loadDashboard = useCallback(async () => {
    if (isManager && !appliedFilters.departmentId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const params = {
      fromDate: appliedFilters.fromDate ? `${appliedFilters.fromDate}T00:00:00` : undefined,
      toDate: appliedFilters.toDate ? `${appliedFilters.toDate}T23:59:59` : undefined,
      departmentId: appliedFilters.departmentId || undefined,
      paperId: appliedFilters.paperId || undefined,
      professionalFieldId: appliedFilters.professionalFieldId || undefined,
    }
    try {
      const response = await evaluationDashboardApi.getExamOverview({
        ...params,
        employeeId: appliedFilters.employeeId || undefined,
        resultStatus: appliedFilters.resultStatus || undefined,
      })
      const data = apiData(response, null)
      setOverview(data)
      setSummary(data?.attempts || null)
    } catch (requestError) {
      const status = requestError?.response?.status || requestError?.status
      const message = isManager && (status === 401 || status === 403)
        ? 'Bạn chưa được cấp quyền xem tổng hợp điểm bài kiểm tra.'
        : apiErrorMessage(requestError)
      setError(message)
      setOverview(null)
      setSummary(null)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [
    appliedFilters.departmentId,
    appliedFilters.employeeId,
    appliedFilters.fromDate,
    appliedFilters.paperId,
    appliedFilters.professionalFieldId,
    appliedFilters.resultStatus,
    appliedFilters.toDate,
    isManager,
    showToast,
  ])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const paperRows = useMemo(() => overview?.byPaper || [], [overview])
  const fieldChartData = useMemo(() => (overview?.byProfessionalField || []).map((item) => ({
    name: item.professionalFieldName || 'Chưa xác định',
    score: Number(item.averageScore) || 0,
    attempts: Number(item.gradedAttempts) || 0,
  })).slice(0, 12), [overview])
  const paperChartData = useMemo(() => paperRows.map((item) => ({
    name: item.paperName || item.paperCode,
    score: Number(item.averageScore) || 0,
    attempts: Number(item.gradedAttempts) || 0,
  })).slice(0, 12), [paperRows])
  const completed = numberOrNull(summary?.gradedAttempts)
  const passed = numberOrNull(summary?.passedAttempts)
  const failed = numberOrNull(summary?.failedAttempts)
  const activeFilterCount = [
    appliedFilters.fromDate !== DEFAULT_EVALUATION_DASHBOARD_FILTERS.fromDate,
    appliedFilters.toDate !== DEFAULT_EVALUATION_DASHBOARD_FILTERS.toDate,
    !isManager && appliedFilters.departmentId,
    appliedFilters.paperId,
    appliedFilters.professionalFieldId,
    appliedFilters.employeeId,
    appliedFilters.resultStatus,
  ].filter(Boolean).length

  function resetFilters() {
    const managerDepartmentId = isManager
      ? String(departments[0]?.id || filters.departmentId || appliedFilters.departmentId || '')
      : ''
    const nextFilters = {
      ...DEFAULT_EVALUATION_DASHBOARD_FILTERS,
      departmentId: managerDepartmentId,
    }
    setFilters(nextFilters)
    setAppliedFilters(nextFilters)
    setFilterError('')
  }

  function applyFilters() {
    const dateError = validateHistoricalDateRange(filters.fromDate, filters.toDate)
    if (dateError) {
      setFilterError(dateError)
      return
    }
    setFilterError('')
    setAppliedFilters({ ...filters })
    setIsFilterOpen(false)
  }

  return (
        <div className="exam-dashboard">
          <AppliedFilterToolbar
            activeCount={activeFilterCount}
            ariaLabel="Bộ lọc dashboard năng lực chuyên môn"
            className="exam-dashboard__toolbar"
            errorMessage={filterError}
            isOpen={isFilterOpen}
            onApply={applyFilters}
            onReset={resetFilters}
            onToggle={() => {
              setFilterError('')
              setIsFilterOpen((current) => !current)
            }}
            panelClassName="exam-dashboard__filter-panel"
            panelId="exam-dashboard-filter-panel"
            showFilter
          >
                <Filter label="Từ ngày"><KeyboardDatePicker allowInvalidValue value={filters.fromDate} max={filters.toDate || DEFAULT_EVALUATION_DASHBOARD_DATES.toDate} onChange={(val) => { setFilterError(''); setFilters({ ...filters, fromDate: val }) }} /></Filter>
                <Filter label="Đến ngày"><KeyboardDatePicker allowInvalidValue value={filters.toDate} min={filters.fromDate || undefined} max={DEFAULT_EVALUATION_DASHBOARD_DATES.toDate} onChange={(val) => { setFilterError(''); setFilters({ ...filters, toDate: val }) }} /></Filter>
                <FilterSelectField
                    label="Khoa/phòng"
                    value={filters.departmentId}
                    disabled={isManager}
                    onChange={(value) => setFilters({ ...filters, departmentId: value })}
                    placeholder={isManager ? 'Khoa của tôi' : 'Toàn viện'}
                    searchable
                    searchPlaceholder="Gõ tên khoa/phòng..."
                    options={[
                      ...(!isManager ? [{ value: '', label: 'Toàn viện' }] : []),
                      ...departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                        searchText: department.code || department.departmentCode,
                      })),
                    ]}
                />
                <FilterSelectField
                    label="Bài kiểm tra"
                    value={filters.paperId}
                    onChange={(value) => setFilters({ ...filters, paperId: value })}
                    placeholder="Tất cả bài kiểm tra"
                    searchable
                    searchPlaceholder="Gõ tên bài kiểm tra..."
                    options={[
                      { value: '', label: 'Tất cả bài kiểm tra' },
                      ...papers.map((paper) => ({
                        value: paper.id,
                        label: paper.name || paper.code,
                        description: paper.name && paper.code ? paper.code : '',
                        searchText: paper.code,
                      })),
                    ]}
                />
                <FilterSelectField
                    label="Lĩnh vực chuyên môn"
                    value={filters.professionalFieldId}
                    onChange={(value) => setFilters({ ...filters, professionalFieldId: value })}
                    placeholder="Tất cả lĩnh vực"
                    searchable
                    searchPlaceholder="Gõ tên lĩnh vực..."
                    options={[
                      { value: '', label: 'Tất cả lĩnh vực' },
                      ...professionalFields.map((field) => ({
                        value: field.id,
                        label: field.name,
                        searchText: field.code,
                      })),
                    ]}
                />
                <FilterSelectField
                    label="Nhân viên"
                    value={filters.employeeId}
                    onChange={(value) => setFilters({ ...filters, employeeId: value })}
                    placeholder="Tất cả nhân viên"
                    searchable
                    searchPlaceholder="Gõ tên hoặc mã nhân viên..."
                    options={[
                      { value: '', label: 'Tất cả nhân viên' },
                      ...(overview?.employees || []).map((employee) => ({
                        value: employee.id,
                        label: employee.name,
                        description: employee.employeeCode,
                        searchText: employee.employeeCode,
                      })),
                    ]}
                />
                <FilterSelectField
                  label="Trạng thái kết quả"
                  value={filters.resultStatus}
                  onChange={(value) => setFilters({ ...filters, resultStatus: value })}
                  options={[{ value: '', label: 'Tất cả kết quả' }, { value: 'PASSED', label: 'Đạt' }, { value: 'FAILED', label: 'Không đạt' }]}
                  placeholder="Tất cả kết quả"
                />
          </AppliedFilterToolbar>

          {error && <div className="exam-dashboard__notice exam-dashboard__notice--error"><InfoCircleOutlined /> {error}</div>}

          {loading ? (
            <div className="exam-dashboard__loading"><LoadingOutlined spin /><span>Đang tải kết quả bài kiểm tra...</span></div>
          ) : (
            <>
              <section className="exam-dashboard__metrics">
                <Metric icon={<FileTextOutlined />} label="Đợt kiểm tra" value={overview?.assignmentCount} detail="Số đợt trong phạm vi" />
                <Metric icon={<FileDoneOutlined />} label="Lượt được phân công" value={overview?.targetCount} detail="Nhân viên × đợt kiểm tra" />
                <Metric icon={<FileDoneOutlined />} label="Đã hoàn thành" value={completed} detail="Lượt đã nộp/chấm" tone="success" />
                <Metric icon={<ClockCircleOutlined />} label="Chưa bắt đầu" value={overview?.notStartedCount} detail="Chưa từng mở bài" tone="warning" />
                <Metric icon={<CheckCircleOutlined />} label="Đạt" value={passed} detail="Lượt đạt" tone="success" />
                <Metric icon={<CloseCircleOutlined />} label="Không đạt" value={failed} detail="Lượt không đạt" tone="danger" />
                <Metric icon={<TrophyOutlined />} label="Tỷ lệ đạt" value={formatPercent(summary?.passRate)} raw detail="Trên số lượt đã chấm" />
                <Metric icon={<BarChartOutlined />} label="Điểm trung bình" value={`${formatNumber(summary?.averageScore, 2)}/10`} raw detail="Điểm bài kiểm tra (thang 10)" />
              </section>

              <section className="exam-dashboard__analytics">
                <article className="exam-dashboard__panel">
                  <header><div><h2>Điểm trung bình theo lĩnh vực chuyên môn</h2><p>Tính trên các lượt đã chấm trong phạm vi bộ lọc.</p></div></header>
                  <DashboardBarChart data={fieldChartData} />
                </article>
                <article className="exam-dashboard__panel">
                  <header><div><h2>Điểm trung bình theo từng bài kiểm tra</h2><p>Hiển thị tối đa 12 bài trong phạm vi đang chọn.</p></div></header>
                  <DashboardBarChart data={paperChartData} />
                </article>
              </section>

            </>
          )}
        </div>
  )
}

/** Trang độc lập; route cũ vẫn dùng để không phá link đã lưu. */
function EvaluationDashboardPage({ role = 'admin' }) {
  const pageTitle = 'Dashboard lý thuyết'
  const isManager = role === 'manager'
  return (
    <AppShell
      breadcrumbs={isManager ? undefined : [{ label: 'Dashboard & Báo cáo' }, { label: pageTitle }]}
      title={isManager ? pageTitle : undefined}
    >
      <EvaluationDashboardContent role={role} />
    </AppShell>
  )
}

function Filter({ label, children }) {
  return <label><span>{label}</span>{children}</label>
}

function Metric({ icon, label, value, detail, tone = 'default', raw = false }) {
  return (
    <article className={`exam-dashboard__metric is-${tone}`}>
      <span className="exam-dashboard__metric-icon">{icon}</span>
      <div><span>{label}</span><strong>{raw ? value : formatNumber(value)}</strong><small>{detail}</small></div>
    </article>
  )
}

function DashboardBarChart({ data }) {
  if (!data.length) {
    return <div className="exam-dashboard__empty-chart"><BarChartOutlined /><strong>Chưa có dữ liệu tổng hợp</strong><span>Không có lượt đã chấm trong phạm vi bộ lọc.</span></div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 58 }}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e4eaf0" />
        <XAxis dataKey="name" angle={-24} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#64748b' }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip formatter={(value, name, item) => [
          name === 'score' ? `${formatNumber(value, 2)}/10` : value,
          name === 'score' ? `Điểm trung bình · ${item?.payload?.attempts || 0} lượt` : name,
        ]} />
        <Bar dataKey="score" name="score" fill="#168f78" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default EvaluationDashboardPage
