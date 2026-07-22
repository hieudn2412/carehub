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
  const [assignments, setAssignments] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    departmentId: '',
    paperId: '',
    professionalFieldId: '',
    employeeId: '',
    result: '',
  })

  useEffect(() => {
    let active = true
    async function loadOptions() {
      try {
        const commonRequests = [
          examPaperApi.listExamPapers({}),
          examAssignmentApi.listAssignments({}),
          trainingApi.getRecordOptions(),
        ]
        const scopeRequest = isManager ? staffApi.getProfile() : adminApi.getDepartments()
        const [paperResponse, assignmentResponse, optionResponse, scopeResponse] = await Promise.all([...commonRequests, scopeRequest])
        if (!active) return
        setPapers(unwrapList(paperResponse))
        setAssignments(unwrapList(assignmentResponse))
        setProfessionalFields(apiData(optionResponse, {}).professionalFields || [])
        if (isManager) {
          const profile = apiData(scopeResponse, null)
          if (profile?.departmentId) {
            setDepartments([{ id: profile.departmentId, name: profile.departmentName || 'Khoa của tôi' }])
            setFilters((current) => ({ ...current, departmentId: String(profile.departmentId) }))
          } else {
            setError('Tài khoản manager chưa được gán khoa/phòng.')
          }
        } else {
          setDepartments(unwrapList(scopeResponse))
        }
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
      const response = await evaluationDashboardApi.getExamResultsSummary(params)
      setSummary(apiData(response, null))
    } catch (requestError) {
      const message = apiErrorMessage(requestError)
      setError(message)
      setSummary(null)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filters.departmentId, filters.fromDate, filters.paperId, filters.professionalFieldId, filters.toDate, isManager, showToast])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const selectedPapers = useMemo(() => (
    filters.paperId ? papers.filter((paper) => String(paper.id) === filters.paperId) : papers
  ), [filters.paperId, papers])
  const completed = numberOrNull(summary?.gradedAttempts)
  const passed = numberOrNull(summary?.passedAttempts)
  const failed = numberOrNull(summary?.failedAttempts)

  const LayoutSidebar = isManager ? Sidebar : AdminSidebar
  const LayoutHeader = isManager ? Header : AdminHeader

  return (
    <div className="dashboard-layout exam-dashboard-page">
      <LayoutSidebar />
      <div className="dashboard-layout__content">
        <LayoutHeader
          breadcrumbs={isManager ? undefined : [{ label: 'Dashboard & Báo cáo' }, { label: 'Dashboard bài kiểm tra' }]}
          title={isManager ? 'Dashboard bài kiểm tra' : undefined}
        />
        <main className="exam-dashboard">
          <section className="exam-dashboard__hero">
            <div>
              <span>ĐÁNH GIÁ CHUYÊN MÔN</span>
              <h1>Dashboard bài kiểm tra</h1>
              <p>Theo dõi tiến độ làm bài, kết quả và điểm số theo phạm vi quản lý.</p>
            </div>
            <div className="exam-dashboard__assignment-count">
              <FileTextOutlined />
              <span><strong>{formatNumber(assignments.length)}</strong> phân công kiểm tra</span>
            </div>
          </section>

          <section className="exam-dashboard__filters" aria-label="Bộ lọc dashboard bài kiểm tra">
            <Filter label="Từ ngày"><input type="date" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} /></Filter>
            <Filter label="Đến ngày"><input type="date" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} /></Filter>
            <Filter label="Khoa/phòng">
              <select value={filters.departmentId} disabled={isManager} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}>
                {!isManager && <option value="">Toàn viện</option>}
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </Filter>
            <Filter label="Bài kiểm tra">
              <select value={filters.paperId} onChange={(event) => setFilters({ ...filters, paperId: event.target.value })}>
                <option value="">Tất cả bài kiểm tra</option>
                {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.name || paper.code}</option>)}
              </select>
            </Filter>
            <Filter label="Lĩnh vực chuyên môn">
              <select value={filters.professionalFieldId} onChange={(event) => setFilters({ ...filters, professionalFieldId: event.target.value })}>
                <option value="">Tất cả lĩnh vực</option>
                {professionalFields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
              </select>
            </Filter>
            <Filter label="Nhân viên" unavailable><select disabled><option>Chưa có API lọc</option></select></Filter>
            <Filter label="Trạng thái đạt/chưa đạt" unavailable><select disabled><option>Chưa có API lọc</option></select></Filter>
          </section>

          {error && <div className="exam-dashboard__notice exam-dashboard__notice--error"><InfoCircleOutlined /> {error}</div>}
          <div className="exam-dashboard__notice"><InfoCircleOutlined /> Backend chưa có số bài chưa từng bắt đầu và thống kê nhóm theo bài/nhân viên.</div>

          {loading ? (
            <div className="exam-dashboard__loading"><LoadingOutlined spin /><span>Đang tải kết quả bài kiểm tra...</span></div>
          ) : (
            <>
              <section className="exam-dashboard__metrics">
                <Metric icon={<FileTextOutlined />} label="Tổng bài kiểm tra" value={assignments.length} detail="Số phân công hiện có" />
                <Metric icon={<FileDoneOutlined />} label="Đã hoàn thành" value={completed} detail="Lượt đã nộp/chấm" tone="success" />
                <Metric icon={<ClockCircleOutlined />} label="Chưa làm" value={null} detail="Chờ API bài chưa bắt đầu" tone="warning" />
                <Metric icon={<CheckCircleOutlined />} label="Đạt" value={passed} detail="Lượt đạt" tone="success" />
                <Metric icon={<CloseCircleOutlined />} label="Không đạt" value={failed} detail="Lượt không đạt" tone="danger" />
                <Metric icon={<TrophyOutlined />} label="Tỷ lệ đạt" value={formatPercent(summary?.passRate)} raw detail="Trên số lượt đã chấm" />
                <Metric icon={<BarChartOutlined />} label="Điểm trung bình" value={formatNumber(summary?.averageScore, 2)} raw detail="Điểm bài kiểm tra" />
              </section>

              <section className="exam-dashboard__analytics">
                <article className="exam-dashboard__panel">
                  <header><div><h2>Điểm trung bình theo lĩnh vực chuyên môn</h2><p>Cần bổ sung lĩnh vực vào contract kết quả bài kiểm tra.</p></div></header>
                  <EmptyChart />
                </article>
                <article className="exam-dashboard__panel">
                  <header><div><h2>Điểm trung bình theo từng bài kiểm tra</h2><p>Chưa có endpoint trả nhóm điểm theo đề trong một lần gọi.</p></div></header>
                  <EmptyChart />
                </article>
              </section>

              <section className="exam-dashboard__panel exam-dashboard__paper-panel">
                <header><div><h2>Danh sách bài kiểm tra</h2><p>Cột lĩnh vực và điểm trung bình để trống đến khi backend bổ sung dữ liệu.</p></div><span>{selectedPapers.length} bài</span></header>
                <div className="exam-dashboard__table-wrap">
                  <table className="exam-dashboard__table">
                    <thead><tr><th>Mã đề</th><th>Bài kiểm tra</th><th>Lĩnh vực chuyên môn</th><th>Số câu</th><th>Điểm đạt</th><th>Điểm trung bình</th></tr></thead>
                    <tbody>
                      {!selectedPapers.length ? (
                        <tr><td colSpan="6" className="exam-dashboard__empty-row">Chưa có bài kiểm tra phù hợp.</td></tr>
                      ) : selectedPapers.map((paper) => (
                        <tr key={paper.id}>
                          <td><code>{paper.code || '—'}</code></td>
                          <td><strong>{paper.name || '—'}</strong><span>Phiên bản {paper.version || '—'}</span></td>
                          <td className="exam-dashboard__muted">—</td>
                          <td>{formatNumber(paper.totalQuestions)}</td>
                          <td>{paper.passingScore === null || paper.passingScore === undefined ? '—' : `${formatNumber(paper.passingScore)}%`}</td>
                          <td className="exam-dashboard__muted">—</td>
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

function Filter({ label, unavailable = false, children }) {
  return <label className={unavailable ? 'is-unavailable' : ''}><span>{label}</span>{children}</label>
}

function Metric({ icon, label, value, detail, tone = 'default', raw = false }) {
  return (
    <article className={`exam-dashboard__metric is-${tone}`}>
      <span className="exam-dashboard__metric-icon">{icon}</span>
      <div><span>{label}</span><strong>{raw ? value : formatNumber(value)}</strong><small>{detail}</small></div>
    </article>
  )
}

function EmptyChart() {
  return <div className="exam-dashboard__empty-chart"><BarChartOutlined /><strong>Chưa có dữ liệu tổng hợp</strong><span>Chờ API từ backend.</span></div>
}

export default EvaluationDashboardPage
