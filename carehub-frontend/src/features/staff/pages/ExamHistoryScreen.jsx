import { useEffect, useMemo, useState } from 'react'
import '../styles/ExamHistoryScreen.css'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import { CheckCircleOutlined, EyeOutlined, FileTextOutlined, PieChartOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'

const COMPETENCY_COLORS = {
  NOT_COMPETENT: ['#ef4444', '#fef2f2'],
  BEGINNER: ['#f59e0b', '#fffbeb'],
  BASIC: ['#3b82f6', '#eff6ff'],
  PROFICIENT: ['#10b981', '#ecfdf5'],
  ADVANCED: ['#8b5cf6', '#f5f3ff'],
}

function clsColor(level) {
  return COMPETENCY_COLORS[level] || ['#6b7280', '#f3f4f6']
}

function ExamHistoryScreen() {
  const { showToast } = useToast()
  const [attempts, setAttempts] = useState([])
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAttempts() {
      setLoading(true)
      try {
        const response = await myExamApi.listAttempts()
        setAttempts(apiData(response, []))
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      } finally {
        setLoading(false)
      }
    }
    loadAttempts()
  }, [showToast])

  const completedAttempts = useMemo(
    () => attempts.filter((attempt) => ['SUBMITTED', 'GRADED', 'EXPIRED'].includes(attempt.status)),
    [attempts],
  )

  const summary = useMemo(() => {
    const passed = completedAttempts.filter((attempt) => attempt.passed).length
    const scored = completedAttempts.filter((attempt) => attempt.score !== null && attempt.score !== undefined)
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / scored.length)
      : 0
    return {
      total: completedAttempts.length,
      passed,
      avgScore,
      passRate: completedAttempts.length ? Math.round((passed / completedAttempts.length) * 100) : 0,
    }
  }, [completedAttempts])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return completedAttempts.filter((attempt) => {
      const matchesSearch = !normalized
        || (attempt.examPaperName || '').toLowerCase().includes(normalized)
        || (attempt.assignmentName || '').toLowerCase().includes(normalized)
      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'pass' && attempt.passed)
        || (statusFilter === 'fail' && !attempt.passed)
      return matchesSearch && matchesStatus
    })
  }, [completedAttempts, search, statusFilter])

  async function viewAttempt(attempt) {
    try {
      const response = await myExamApi.getAttempt(attempt.id)
      setSelectedAttempt(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Lịch sử thi" />
        <div className="dashboard-layout__body">
          <div className="eh-page">
            <div className="eh-header">
              <h2 className="eh-page-title">Lịch sử thi</h2>
              <p className="eh-page-sub">Kết quả các bài kiểm tra đã thực hiện</p>
            </div>

            <div className="eh-summary">
              {[
                { label: 'Tổng bài đã thi', value: summary.total, mod: 'blue', icon: <FileTextOutlined /> },
                { label: 'Số bài đạt', value: summary.passed, mod: 'green', icon: <CheckCircleOutlined /> },
                { label: 'Điểm TB', value: `${summary.avgScore}%`, mod: 'amber', icon: <TrophyOutlined /> },
                { label: 'Tỉ lệ đạt', value: `${summary.passRate}%`, mod: 'purple', icon: <PieChartOutlined /> },
              ].map(({ label, value, mod, icon }) => (
                <div key={label} className="eh-summary-card">
                  <div className={`eh-summary-card__icon eh-summary-card__icon--${mod}`}>{icon}</div>
                  <div>
                    <p className="eh-summary-card__label">{label}</p>
                    <p className="eh-summary-card__value">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="eh-filter-bar">
              <div className="eh-search">
                <span className="eh-search-icon"><SearchOutlined /></span>
                <input className="eh-search-input" placeholder="Tìm theo tên bài thi..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="pass">Đạt</option>
                <option value="fail">Không đạt</option>
              </select>
            </div>

            <div className="eh-table-card">
              <table className="eh-table">
                <thead>
                  <tr>
                    <th>Tên bài thi</th>
                    <th>Ngày nộp</th>
                    <th>Điểm số</th>
                    <th>Phân loại</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th>Lượt</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8">Đang tải lịch sử thi...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="8">Chưa có lịch sử thi.</td></tr>
                  ) : filtered.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{attempt.examPaperName}</td>
                      <td>{formatDateTime(attempt.submittedAt)}</td>
                      <td><span className={`eh-score ${attempt.passed ? 'eh-score--pass' : 'eh-score--fail'}`}>{attempt.score ?? '---'}%</span></td>
                      <td>
                        {attempt.classification ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: clsColor(attempt.classification)[1],
                            color: clsColor(attempt.classification)[0],
                          }}>
                            {attempt.classificationText || attempt.classification}
                          </span>
                        ) : <span style={{ color: '#9ca3af' }}>--</span>}
                      </td>
                      <td>
                        <span className={`eh-badge ${attempt.passed ? 'eh-badge--pass' : 'eh-badge--fail'}`}>
                          <span className="eh-badge__dot" />
                          {attempt.passed ? 'Đạt' : 'Không đạt'}
                        </span>
                      </td>
                      <td>{Math.round((attempt.timeSpentSeconds || 0) / 60)} phút</td>
                      <td><span className="eh-attempt">{attempt.attemptNumber}</span></td>
                      <td>
                        <button className="eh-btn eh-btn--view" onClick={() => viewAttempt(attempt)}>
                          <EyeOutlined /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedAttempt && (
              <div className="eh-table-card eh-detail-card">
                <div className="eh-detail-header">
                  <strong>{selectedAttempt.examPaperName}</strong>
                  <span>{selectedAttempt.score ?? '---'} điểm</span>
                </div>
                {(selectedAttempt.answers || []).length === 0 && (
                  <div className="eh-answer-line">Phân công này chỉ hiển thị điểm, không hiển thị đáp án đúng và giải thích.</div>
                )}
                {(selectedAttempt.questions || []).map((question) => {
                  const answer = (selectedAttempt.answers || []).find((item) => item.paperQuestionId === question.paperQuestionId)
                  const selectedAnswer = answer?.selectedAnswer || question.selectedAnswer
                  return (
                    <div key={question.paperQuestionId} className="eh-question-review">
                      <div className="eh-detail-header">
                        <strong>Câu {question.position}</strong>
                        {answer && (
                          <span className={answer.correct ? 'eh-score--pass' : 'eh-score--fail'}>{answer.correct ? 'Đúng' : 'Sai'}</span>
                        )}
                      </div>
                      <p>{question.stem}</p>
                      <ol type="A">
                        <li>{question.optionA}</li>
                        <li>{question.optionB}</li>
                        <li>{question.optionC}</li>
                        <li>{question.optionD}</li>
                      </ol>
                      <div className="eh-answer-line">Đã chọn: {selectedAnswer || 'Chưa chọn'}{answer ? ` | Đáp án đúng: ${answer.correctAnswer || '---'}` : ''}</div>
                      {answer?.explanation && <div className="eh-answer-line">Giải thích: {answer.explanation}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExamHistoryScreen
