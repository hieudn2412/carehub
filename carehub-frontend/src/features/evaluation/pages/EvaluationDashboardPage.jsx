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
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import Sidebar from '../../staff/components/sidebar.jsx'
import Header from '../../staff/components/Header.jsx'
import { evaluationDashboardApi } from '../api/evaluationDashboardApi.js'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
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

function EvaluationDashboardPage({ role = 'admin' }) {
  const isManager = role === 'manager'
  const { showToast } = useToast()
  const [departments, setDepartments] = useState([])
  const [papers, setPapers] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [summary, setSummary] = useState(null)
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    departmentId: '',
    paperId: '',
    professionalFieldId: '',
    employeeId: '',
    resultStatus: '',
  })

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
            setDepartments([{
              id: managerProfile.departmentId,
              name: managerProfile.departmentName || 'Khoa của tôi',
            }])
            setFilters((current) => ({
              ...current,
              departmentId: String(managerProfile.departmentId),
            }))
          } else {
            setError('Tài khoản manager chưa được gán khoa/phòng.')
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
    if (isManager && !filters.departmentId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const params = {
      fromDate: filters.fromDate ? `${filters.fromDate}T00:00:00` : undefined,
      toDate: filters.toDate ? `${filters.toDate}T23:59:59` : undefined,
      departmentId: filters.departmentId || undefined,
      paperId: filters.paperId || undefined,
      professionalFieldId: filters.professionalFieldId || undefined,
    }
    try {
      const response = await evaluationDashboardApi.getExamOverview({
        ...params,
        employeeId: filters.employeeId || undefined,
        resultStatus: filters.resultStatus || undefined,
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
    filters.departmentId,
    filters.employeeId,
    filters.fromDate,
    filters.paperId,
    filters.professionalFieldId,
    filters.resultStatus,
    filters.toDate,
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

  const LayoutSidebar = isManager ? Sidebar : AdminSidebar
  const LayoutHeader = isManager ? Header : AdminHeader
  const pageTitle = 'Dashboard lý thuyết'

  return (
    <div className="dashboard-layout exam-dashboard-page">
      <LayoutSidebar />
      <div className="dashboard-layout__content">
        <LayoutHeader
          breadcrumbs={isManager ? undefined : [{ label: 'Dashboard & Báo cáo' }, { label: pageTitle }]}
          title={isManager ? pageTitle : undefined}
        />
        <main className="exam-dashboard">
          <section className="exam-dashboard__hero">
            <div>
              <span>ĐIỂM LÝ THUYẾT</span>
              <h1>Điểm bài kiểm tra</h1>
              <p>
                {isManager
                  ? 'Tổng hợp điểm bài test lý thuyết của nhân viên trong khoa theo phạm vi quản lý.'
                  : 'Theo dõi tiến độ làm bài, kết quả và điểm số theo phạm vi quản lý.'}
              </p>
            </div>
            <div className="exam-dashboard__assignment-count">
              <FileTextOutlined />
              <span><strong>{formatNumber(overview?.targetCount)}</strong> lượt được phân công</span>
            </div>
          </section>

          <section className="exam-dashboard__filters" aria-label="Bộ lọc dashboard bài kiểm tra">
            <Filter label="Từ ngày"><input type="date" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} /></Filter>
            <Filter label="Đến ngày"><input type="date" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} /></Filter>
            <Filter label="Khoa/phòng">
              <SearchableSelect
                value={filters.departmentId}
                disabled={isManager}
                onChange={(value) => setFilters({ ...filters, departmentId: value })}
                placeholder={isManager ? 'Khoa của tôi' : 'Toàn viện'}
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
            </Filter>
            <Filter label="Bài kiểm tra">
              <SearchableSelect
                value={filters.paperId}
                onChange={(value) => setFilters({ ...filters, paperId: value })}
                placeholder="Tất cả bài kiểm tra"
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
            </Filter>
            <Filter label="Lĩnh vực chuyên môn">
              <SearchableSelect
                value={filters.professionalFieldId}
                onChange={(value) => setFilters({ ...filters, professionalFieldId: value })}
                placeholder="Tất cả lĩnh vực"
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
            </Filter>
            <Filter label="Nhân viên">
              <SearchableSelect
                value={filters.employeeId}
                onChange={(value) => setFilters({ ...filters, employeeId: value })}
                placeholder="Tất cả nhân viên"
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
            </Filter>
            <Filter label="Trạng thái kết quả">
              <select value={filters.resultStatus} onChange={(event) => setFilters({ ...filters, resultStatus: event.target.value })}>
                <option value="">Tất cả kết quả</option>
                <option value="PASSED">Đạt</option>
                <option value="FAILED">Không đạt</option>
              </select>
            </Filter>
          </section>

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
                <Metric icon={<BarChartOutlined />} label="Điểm trung bình" value={formatNumber(summary?.averageScore, 2)} raw detail="Điểm bài kiểm tra" />
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

              <section className="exam-dashboard__panel exam-dashboard__paper-panel">
                <header><div><h2>Danh sách bài kiểm tra</h2><p>Kết quả tổng hợp theo từng đề và phạm vi đang lọc.</p></div><span>{paperRows.length} bài</span></header>
                <div className="exam-dashboard__table-wrap">
                  <table className="exam-dashboard__table">
                    <thead><tr><th>Mã đề</th><th>Bài kiểm tra</th><th>Lĩnh vực chuyên môn</th><th>Số câu</th><th>Điểm đạt</th><th>Điểm trung bình</th></tr></thead>
                    <tbody>
                      {!paperRows.length ? (
                        <tr><td colSpan="6" className="exam-dashboard__empty-row">Chưa có bài kiểm tra phù hợp.</td></tr>
                      ) : paperRows.map((paper) => (
                        <tr key={paper.paperId}>
                          <td><code>{paper.paperCode || '—'}</code></td>
                          <td><strong>{paper.paperName || '—'}</strong><span>Phiên bản {paper.version || '—'} · {formatNumber(paper.gradedAttempts)} lượt</span></td>
                          <td>{(paper.professionalFieldNames || []).join(', ') || '—'}</td>
                          <td>{formatNumber(paper.totalQuestions)}</td>
                          <td>{paper.passingScore === null || paper.passingScore === undefined ? '—' : `${formatNumber(paper.passingScore)}%`}</td>
                          <td><strong>{formatNumber(paper.averageScore, 2)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
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
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip formatter={(value, name, item) => [
          name === 'score' ? `${formatNumber(value, 2)} điểm` : value,
          name === 'score' ? `Điểm trung bình · ${item?.payload?.attempts || 0} lượt` : name,
        ]} />
        <Bar dataKey="score" name="score" fill="#168f78" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default EvaluationDashboardPage
