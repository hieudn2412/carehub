import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChartOutlined, CheckCircleOutlined, FileTextOutlined, ReloadOutlined, TrophyOutlined, WarningOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { evaluationDashboardApi } from '../api/evaluationDashboardApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import '../styles/EvaluationDashboardPage.css'

function EvaluationDashboardPage() {
  const { showToast } = useToast()
  const [dashboard, setDashboard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await evaluationDashboardApi.getDashboard()
      setDashboard(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const questionBank = dashboard?.questionBank || {}
  const examResults = dashboard?.examResults || {}
  const itemAnalysis = dashboard?.itemAnalysis || []

  const weakestQuestions = useMemo(
    () => [...itemAnalysis].sort((left, right) => Number(left.correctRate || 0) - Number(right.correctRate || 0)).slice(0, 10),
    [itemAnalysis],
  )

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
                <button type="button" className="evd-btn" onClick={loadDashboard} disabled={isLoading}>
                  <ReloadOutlined />
                  <span>Tải lại</span>
                </button>
              </section>

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
