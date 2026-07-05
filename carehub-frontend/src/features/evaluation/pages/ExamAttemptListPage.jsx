import { useCallback, useEffect, useMemo, useState } from 'react'
import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function ExamAttemptListPage() {
  const { showToast } = useToast()
  const [attempts, setAttempts] = useState([])
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')

  const loadAttempts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await examAssignmentApi.listAttempts({})
      setAttempts(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadAttempts()
  }, [loadAttempts])

  const filteredAttempts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return attempts.filter((attempt) => {
      const matchesKeyword = !normalized
        || (attempt.assignmentName || '').toLowerCase().includes(normalized)
        || (attempt.examPaperCode || '').toLowerCase().includes(normalized)
        || (attempt.examPaperName || '').toLowerCase().includes(normalized)
        || (attempt.employeeCode || '').toLowerCase().includes(normalized)
        || (attempt.userName || '').toLowerCase().includes(normalized)
      const matchesStatus = !status || attempt.status === status
      return matchesKeyword && matchesStatus
    })
  }, [attempts, keyword, status])

  async function viewAttempt(attempt) {
    try {
      const response = await examAssignmentApi.getAttempt(attempt.id)
      setSelectedAttempt(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  function answerText(answer) {
    return answer || 'Chưa chọn'
  }

  const breadcrumbs = [{ label: 'Kết quả kiểm tra' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <div className="exp-title-card">
                <div>
                  <h1 className="exp-title">Kết quả kiểm tra</h1>
                  <p className="exp-subtitle">Theo dõi lượt làm bài, điểm số và đáp án theo từng nhân viên</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={loadAttempts} disabled={isLoading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                </div>
              </div>

              <div className="exp-filter-bar">
                <div className="exp-search">
                  <SearchOutlined />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm nhân viên, phân công, mã đề..." />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Trạng thái</option>
                  <option value="IN_PROGRESS">Đang làm</option>
                  <option value="GRADED">Đã chấm</option>
                  <option value="SUBMITTED">Đã nộp</option>
                  <option value="EXPIRED">Quá hạn</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="exp-table-card">
                <table className="exp-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Phân công</th>
                      <th>Bộ đề</th>
                      <th>Lượt</th>
                      <th>Điểm</th>
                      <th>Trạng thái</th>
                      <th>Thời gian nộp</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="8" className="exp-empty">Đang tải kết quả kiểm tra...</td></tr>
                    ) : filteredAttempts.length === 0 ? (
                      <tr><td colSpan="8" className="exp-empty">Chưa có lượt làm bài.</td></tr>
                    ) : filteredAttempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td><strong>{attempt.employeeCode}</strong><br /><span>{attempt.userName}</span></td>
                        <td>{attempt.assignmentName}</td>
                        <td>{attempt.examPaperCode}</td>
                        <td>{attempt.attemptNumber}</td>
                        <td>{attempt.score ?? '---'}</td>
                        <td><span className={`exp-badge exp-badge--${attempt.status?.toLowerCase()}`}>{attempt.statusText || attempt.status}</span></td>
                        <td>{formatDateTime(attempt.submittedAt)}</td>
                        <td>
                          <div className="exp-actions">
                            <button type="button" onClick={() => viewAttempt(attempt)} title="Xem chi tiết"><EyeOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedAttempt && (
                <div className="exp-question-list">
                  <div className="exp-form-card">
                    <div className="exp-question-head">
                      <strong>{selectedAttempt.userName} - {selectedAttempt.examPaperCode}</strong>
                      <span>{selectedAttempt.statusText}</span>
                    </div>
                    <div className="exp-info-strip">
                      <span>Điểm: {selectedAttempt.score ?? '---'}</span>
                      <span>Đúng: {selectedAttempt.correctCount ?? 0}/{selectedAttempt.totalQuestions ?? 0}</span>
                      <span>{selectedAttempt.passed ? 'Đạt' : 'Chưa đạt'}</span>
                      <span>Nộp: {formatDateTime(selectedAttempt.submittedAt)}</span>
                    </div>
                  </div>
                  {(selectedAttempt.questions || []).map((question) => {
                    const answer = (selectedAttempt.answers || []).find((item) => item.paperQuestionId === question.paperQuestionId)
                    return (
                      <div key={question.paperQuestionId} className="exp-question-card">
                        <div className="exp-question-head">
                          <strong>Câu {question.position}</strong>
                          <span className={answer?.correct ? 'exp-result-correct' : 'exp-result-wrong'}>
                            {answer?.correct ? 'Đúng' : 'Sai'}
                          </span>
                        </div>
                        <p>{question.stem}</p>
                        <ol type="A">
                          <li>{question.optionA}</li>
                          <li>{question.optionB}</li>
                          <li>{question.optionC}</li>
                          <li>{question.optionD}</li>
                        </ol>
                        <div className="exp-answer-box">
                          <span>Đã chọn: {answerText(answer?.selectedAnswer)}</span>
                          <span>Đáp án đúng: {answerText(answer?.correctAnswer)}</span>
                          {answer?.explanation && <span>Giải thích: {answer.explanation}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamAttemptListPage
