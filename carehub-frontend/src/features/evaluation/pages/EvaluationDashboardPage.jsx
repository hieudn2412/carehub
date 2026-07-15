import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChartOutlined, CheckCircleOutlined, FileTextOutlined, ReloadOutlined, TrophyOutlined, WarningOutlined, FilterOutlined, BulbOutlined, PieChartOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { evaluationDashboardApi } from '../api/evaluationDashboardApi.js'
import { examConfigApi } from '../api/examConfigApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import '../styles/EvaluationDashboardPage.css'

function EvaluationDashboardPage() {
  const { showToast } = useToast()
  const [dashboard, setDashboard] = useState(null)
  const [discriminationData, setDiscriminationData] = useState([])
  const [wrongAnswerData, setWrongAnswerData] = useState([])
  const [configs, setConfigs] = useState([])
  const [papers, setPapers] = useState([])
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    examConfigId: '',
    paperId: '',
    assignmentId: '',
    departmentId: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const filterParams = useMemo(() => {
    const params = {}
    if (filters.fromDate) params.fromDate = filters.fromDate
    if (filters.toDate) params.toDate = filters.toDate
    if (filters.examConfigId) params.examConfigId = filters.examConfigId
    if (filters.paperId) params.paperId = filters.paperId
    if (filters.assignmentId) params.assignmentId = filters.assignmentId
    if (filters.departmentId) params.departmentId = filters.departmentId
    return params
  }, [filters])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashRes, discRes, wrongRes, configRes, paperRes, deptRes] = await Promise.all([
        evaluationDashboardApi.getDashboard(filterParams),
        evaluationDashboardApi.getDiscriminationIndex(filterParams).catch(() => ({ data: { data: [] } })),
        evaluationDashboardApi.getWrongAnswerDistribution(filterParams).catch(() => ({ data: { data: [] } })),
        examConfigApi.listConfigs().catch(() => ({ data: { data: { content: [] } } })),
        examPaperApi.listExamPapers({}).catch(() => ({ data: { data: { content: [] } } })),
        adminApi.getDepartments().catch(() => ({ data: { data: [] } })),
      ])
      setDashboard(apiData(dashRes))
      setDiscriminationData(discRes.data?.data || [])
      setWrongAnswerData(wrongRes.data?.data || [])

      const configList = configRes.data?.data?.content || configRes.data?.data || []
      setConfigs(Array.isArray(configList) ? configList : [])
      const paperList = paperRes.data?.data?.content || paperRes.data?.data || []
      setPapers(Array.isArray(paperList) ? paperList : [])
      const deptList = deptRes.data?.data?.content || deptRes.data?.data || []
      setDepartments(Array.isArray(deptList) ? deptList : [])
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast, filterParams])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const questionBank = dashboard?.questionBank || {}
  const examResults = dashboard?.examResults || {}
  const itemAnalysis = dashboard?.itemAnalysis || []

  const weakestQuestions = useMemo(
    () => [...itemAnalysis].sort((left, right) => Number(left.correctRate || 0) - Number(right.correctRate || 0)).slice(0, 10),
    [itemAnalysis],
  )

  const hasFilters = filters.fromDate || filters.toDate || filters.examConfigId || filters.paperId || filters.departmentId

  const breadcrumbs = [{ label: 'Dashboard đánh giá' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Dashboard đánh giá</h1>
                  <p>Theo dõi sức khỏe ngân hàng câu hỏi, kết quả kiểm tra và câu hỏi cần rà soát</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="evd-btn" onClick={() => setShowFilters(!showFilters)}>
                    <FilterOutlined /> Bộ lọc {hasFilters ? '(đang lọc)' : ''}
                  </button>
                  <button type="button" className="evd-btn" onClick={loadAll} disabled={isLoading}>
                    <ReloadOutlined />
                    <span>Tải lại</span>
                  </button>
                </div>
              </section>

              {showFilters && (
                <section className="evd-panel" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <label className="evd-filter-label">Từ ngày</label>
                      <input type="date" className="evd-filter-input" value={filters.fromDate}
                        onChange={e => setFilters({ ...filters, fromDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="evd-filter-label">Đến ngày</label>
                      <input type="date" className="evd-filter-input" value={filters.toDate}
                        onChange={e => setFilters({ ...filters, toDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="evd-filter-label">Cấu hình đề</label>
                      <select className="evd-filter-input" value={filters.examConfigId}
                        onChange={e => setFilters({ ...filters, examConfigId: e.target.value })}>
                        <option value="">Tất cả</option>
                        {configs.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="evd-filter-label">Bộ đề</label>
                      <select className="evd-filter-input" value={filters.paperId}
                        onChange={e => setFilters({ ...filters, paperId: e.target.value })}>
                        <option value="">Tất cả</option>
                        {papers.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="evd-filter-label">Khoa/Phòng</label>
                      <select className="evd-filter-input" value={filters.departmentId}
                        onChange={e => setFilters({ ...filters, departmentId: e.target.value })}>
                        <option value="">Tất cả</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <button type="button" className="evd-btn evd-btn--primary" onClick={loadAll} disabled={isLoading} style={{ fontSize: 13 }}>
                      <ReloadOutlined /> Áp dụng
                    </button>
                    {hasFilters && (
                      <button type="button" className="evd-btn" onClick={() => {
                        setFilters({ fromDate: '', toDate: '', examConfigId: '', paperId: '', assignmentId: '', departmentId: '' })
                        setTimeout(loadAll, 0)
                      }} style={{ fontSize: 13 }}>
                        Xoá bộ lọc
                      </button>
                    )}
                  </div>
                </section>
              )}

              {isLoading ? (
                <section className="evd-panel evd-empty">Đang tải dashboard đánh giá...</section>
              ) : !dashboard ? (
                <section className="evd-panel evd-empty">Không tải được dữ liệu dashboard.</section>
              ) : (
                <>
                  <section className="evd-metric-grid">
                    <Metric icon={<FileTextOutlined />} label="Tổng câu hỏi" value={questionBank.totalQuestions} />
                    <Metric icon={<CheckCircleOutlined />} label="Đã duyệt" value={questionBank.approvedQuestions} tone="success" />
                    <Metric icon={<TrophyOutlined />} label="Lượt đã chấm" value={examResults.gradedAttempts} tone="info" />
                    <Metric icon={<BarChartOutlined />} label="Điểm trung bình" value={`${Number(examResults.averageScore || 0).toFixed(1)}%`} tone="warning" />
                    <Metric icon={<CheckCircleOutlined />} label="Tỷ lệ đạt" value={percent(examResults.passRate)} tone="success" />
                    <Metric icon={<WarningOutlined />} label="Câu cần xem" value={weakestQuestions.length} tone="danger" />
                  </section>

                  <section className="evd-grid-2">
                    <DistributionPanel title="Câu hỏi theo trạng thái" items={questionBank.byStatus} />
                    <DistributionPanel title="Câu hỏi theo độ khó" items={questionBank.byDifficulty} />
                    <DistributionPanel title="Top danh mục" items={questionBank.byTopic} />
                    <DistributionPanel title="Kết quả theo trạng thái" items={examResults.byStatus} />
                  </section>

                  {/* Discrimination Index */}
                  {discriminationData.length > 0 && (
                    <section className="evd-panel">
                      <div className="evd-section-head">
                        <h2><BulbOutlined /> Chỉ số phân biệt (Discrimination Index)</h2>
                        <span>{discriminationData.length} câu</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                        D &gt; 0.3: câu hỏi tốt, phân biệt được NV giỏi và NV yếu. D &lt; 0: câu hỏi cần xem lại.
                      </p>
                      <div className="evd-bars">
                        {discriminationData.slice(0, 15).map(item => (
                          <div key={item.questionId} className="evd-bar-row">
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.stem}>
                              {item.stem}
                            </span>
                            <div className="evd-bar-track">
                              <div style={{
                                width: `${Math.min(100, Math.abs(Number(item.discriminationIndex || 0)) * 200)}%`,
                                background: Number(item.discriminationIndex || 0) >= 0.3 ? '#10b981'
                                  : Number(item.discriminationIndex || 0) >= 0 ? '#f59e0b'
                                  : '#ef4444'
                              }} />
                            </div>
                            <strong>{Number(item.discriminationIndex || 0).toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Wrong Answer Distribution */}
                  {wrongAnswerData.length > 0 && (
                    <section className="evd-panel">
                      <div className="evd-section-head">
                        <h2><PieChartOutlined /> Phân phối đáp án sai</h2>
                        <span>{wrongAnswerData.length} câu</span>
                      </div>
                      <div className="evd-table-scroll">
                        <table className="evd-table">
                          <thead>
                            <tr>
                              <th>Câu hỏi</th>
                              <th>Đáp án đúng</th>
                              <th>Đáp án A</th>
                              <th>Đáp án B</th>
                              <th>Đáp án C</th>
                              <th>Đáp án D</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wrongAnswerData.slice(0, 20).map(item => {
                              const maxWrong = Math.max(1, ...['A','B','C','D'].map(k => Number(item[`option${k}Count`] || 0)))
                              const correctAns = item.correctAnswer || ''
                              return (
                                <tr key={item.questionId}>
                                  <td title={item.stem} style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.stem}
                                  </td>
                                  <td><strong style={{ color: '#10b981' }}>{correctAns}</strong></td>
                                  {['A','B','C','D'].map(opt => {
                                    const count = Number(item[`option${opt}Count`] || 0)
                                    const isCorrect = opt === correctAns
                                    return (
                                      <td key={opt}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <div style={{
                                            width: `${(count / maxWrong) * 60}px`,
                                            height: 8,
                                            borderRadius: 4,
                                            background: isCorrect ? '#10b981' : (count > 0 ? '#ef4444' : '#e5e7eb'),
                                            minWidth: count > 0 ? 4 : 0,
                                          }} />
                                          <span style={{ fontSize: 12 }}>{count}</span>
                                        </div>
                                      </td>
                                    )
                                  })}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  <section className="evd-panel">
                    <div className="evd-section-head">
                      <h2>Phân tích câu hỏi theo kết quả làm bài</h2>
                      <span>{formatNumber(itemAnalysis.length)} câu có dữ liệu</span>
                    </div>
                    <div className="evd-table-scroll">
                      <table className="evd-table">
                        <thead>
                          <tr>
                            <th>Câu hỏi</th>
                            <th>Danh mục</th>
                            <th>Độ khó</th>
                            <th>Lượt trả lời</th>
                            <th>Đúng</th>
                            <th>Sai</th>
                            <th>Tỷ lệ đúng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weakestQuestions.length === 0 ? (
                            <tr><td colSpan="7" className="evd-empty">Chưa có dữ liệu bài làm để phân tích.</td></tr>
                          ) : weakestQuestions.map((item) => (
                            <tr key={item.questionId}>
                              <td>{item.stem}</td>
                              <td>{item.topic || 'Chưa phân loại'}</td>
                              <td>{item.difficulty || '---'}</td>
                              <td>{formatNumber(item.attemptCount)}</td>
                              <td>{formatNumber(item.correctCount)}</td>
                              <td>{formatNumber(item.wrongCount)}</td>
                              <td>
                                <span className={Number(item.correctRate || 0) < 0.5 ? 'evd-rate evd-rate--low' : 'evd-rate'}>
                                  {percent(item.correctRate)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, tone = 'neutral' }) {
  return (
    <div className={`evd-metric evd-metric--${tone}`}>
      <div className="evd-metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
      </div>
    </div>
  )
}

function DistributionPanel({ title, items = [] }) {
  const max = Math.max(1, ...items.map((item) => Number(item.count || 0)))
  return (
    <section className="evd-panel">
      <div className="evd-section-head">
        <h2>{title}</h2>
      </div>
      <div className="evd-bars">
        {items.length === 0 ? (
          <div className="evd-empty">Chưa có dữ liệu.</div>
        ) : items.map((item) => (
          <div key={`${title}-${item.key}`} className="evd-bar-row">
            <span>{item.label || item.key}</span>
            <div className="evd-bar-track"><div style={{ width: `${(Number(item.count || 0) / max) * 100}%` }} /></div>
            <strong>{formatNumber(item.count)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

export default EvaluationDashboardPage
