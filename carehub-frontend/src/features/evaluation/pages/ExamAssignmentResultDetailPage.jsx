import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, FileTextOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import ExamPaperPreviewModal from '../components/ExamPaperPreviewModal.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import './ExamResultPages.css'

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  const score = Number(value)
  return Number.isFinite(score) ? formatNumber(score) : '—'
}

function scoreWithScale(value) {
  const score = formatScore(value)
  return score === '—' ? score : `${score}/10`
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return '—'
  const totalSeconds = Number(seconds)
  if (!Number.isFinite(totalSeconds)) return '—'
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes} phút ${remainingSeconds} giây`
}

function resultLabel(passed) {
  if (passed === null || passed === undefined) return 'Chưa có kết quả'
  return passed ? 'Đạt' : 'Chưa đạt'
}

function resultTone(passed) {
  if (passed === null || passed === undefined) return 'pending'
  return passed ? 'passed' : 'failed'
}

function SummaryCard({ label, value, tone = '' }) {
  return (
    <article className={`ear-summary-card${tone ? ` ear-summary-card--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function EmptyTableRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan} className="ear-empty">{children}</td></tr>
}

export default function ExamAssignmentResultDetailPage() {
  const navigate = useNavigate()
  const { assignmentId, attemptId } = useParams()
  const [attempt, setAttempt] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewPaperId, setPreviewPaperId] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [attemptResponse, breakdownResponse, resultsResponse] = await Promise.all([
        examAssignmentApi.getAttempt(attemptId),
        examAssignmentApi.getAttemptResultBreakdown(attemptId),
        examAssignmentApi.getAssignmentResults(assignmentId),
      ])
      setAttempt(apiData(attemptResponse, null))
      setBreakdown(apiData(breakdownResponse, null))
      setResults(apiData(resultsResponse, null))
    } catch (requestError) {
      setAttempt(null)
      setBreakdown(null)
      setResults(null)
      setError(apiErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, attemptId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resultRow = useMemo(() => (
    (results?.rows || []).find((row) => String(row.latestAttemptId) === String(attemptId)) || null
  ), [attemptId, results])
  const answersByQuestion = useMemo(() => new Map(
    (attempt?.answers || []).map((answer) => [String(answer.paperQuestionId), answer]),
  ), [attempt])
  const analysisByQuestion = useMemo(() => new Map(
    (breakdown?.questions || []).map((question) => [String(question.paperQuestionId), question]),
  ), [breakdown])
  const questions = attempt?.questions || []
  const score = attempt?.score ?? breakdown?.overallScore ?? resultRow?.latestScore
  const passed = attempt?.passed ?? breakdown?.overallPassed ?? resultRow?.latestPassed
  const correctCount = attempt?.correctCount ?? questions.reduce((total, question) => {
    const answer = answersByQuestion.get(String(question.paperQuestionId))
    return total + (answer?.correct ? 1 : 0)
  }, 0)
  const totalQuestions = attempt?.totalQuestions || questions.length || breakdown?.questions?.length || 0
  const resultsPath = `/admin/evaluation/exam-management/assignments/${assignmentId}/results`

  return (
    <AppShell
      title="Chi tiết kết quả"
      back={{ to: resultsPath, label: 'Kết quả bài kiểm tra' }}
      breadcrumbs={[
        { label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management?view=assignments' },
        { label: 'Kết quả bài kiểm tra', link: resultsPath },
        { label: 'Chi tiết lượt làm bài' },
      ]}
    >
      <div className="ear-page">
        <section className="ear-hero ear-hero--detail">
          <div className="ear-hero__copy">
            <span className="ear-eyebrow">CHI TIẾT LƯỢT LÀM BÀI</span>
            <h1>{attempt?.assignmentName || results?.assignmentName || `Đợt giao #${assignmentId}`}</h1>
            <p>{attempt?.examPaperCode ? `${attempt.examPaperCode} · ${attempt.examPaperName}` : 'Kết quả được ghi nhận theo snapshot của mã đề.'}</p>
            <div className="ear-person">
              <strong>{attempt?.userName || resultRow?.userName || 'Nhân viên'}</strong>
              <span>{attempt?.employeeCode || resultRow?.employeeCode || '—'} · {resultRow?.departmentName || 'Chưa xác định khoa/phòng'}</span>
            </div>
          </div>
          <div className="ear-hero__actions">
            <button type="button" className="ear-button ear-button--secondary" onClick={() => navigate(resultsPath)}>
              <ArrowLeftOutlined /> Quay lại kết quả
            </button>
            <button type="button" className="ear-button ear-button--secondary" onClick={loadData} disabled={isLoading}>
              <ReloadOutlined /> Tải lại
            </button>
            <button
              type="button"
              className="ear-button ear-button--secondary"
              onClick={() => setPreviewPaperId(results?.examPaperId)}
              disabled={!results?.examPaperId}
            >
              <FileTextOutlined /> Xem mã đề
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="ear-state ear-state--loading"><LoadingOutlined spin /> Đang tải chi tiết lượt làm bài...</div>
        ) : error ? (
          <div className="ear-state ear-state--error" role="alert">
            <strong>Chưa tải được chi tiết kết quả</strong>
            <span>{error}</span>
            <button type="button" className="ear-button ear-button--secondary" onClick={loadData}>Thử lại</button>
          </div>
        ) : attempt ? (
          <>
            <section className="ear-summary-grid ear-summary-grid--detail" aria-label="Tóm tắt lượt làm bài">
              <SummaryCard label="Điểm lượt này" value={scoreWithScale(score)} tone={resultTone(passed)} />
              <SummaryCard label="Đánh giá" value={resultLabel(passed)} tone={resultTone(passed)} />
              <SummaryCard label="Số câu đúng" value={`${correctCount}/${totalQuestions}`} />
              <SummaryCard label="Thời gian làm" value={formatDuration(attempt.timeSpentSeconds ?? resultRow?.latestTimeSpentSeconds)} />
              <SummaryCard label="Lượt làm" value={attempt.attemptNumber || resultRow?.latestAttemptNumber || '—'} />
            </section>

            <section className="ear-section">
              <div className="ear-section__heading">
                <div>
                  <span className="ear-section__eyebrow">PHÂN TÍCH THEO NĂNG LỰC</span>
                  <h2>Điểm theo lĩnh vực và mức nhận thức</h2>
                </div>
                <span className={`ear-result-badge ear-result-badge--${resultTone(passed)}`}>{attempt.statusText || resultLabel(passed)}</span>
              </div>
              <div className="ear-report-grid">
                <div className="ear-report-card">
                  <h3>Theo lĩnh vực</h3>
                  <div className="ear-table-wrap">
                    <table className="ear-table ear-table--compact">
                      <thead><tr><th>Lĩnh vực</th><th>Đúng / tổng</th><th>Điểm</th><th>Ngưỡng</th><th>Kết quả</th></tr></thead>
                      <tbody>
                        {(breakdown?.fields || []).length === 0 ? <EmptyTableRow colSpan={5}>Chưa có dữ liệu theo lĩnh vực.</EmptyTableRow> : breakdown.fields.map((field) => (
                          <tr key={field.professionalFieldId}>
                            <td><strong>{field.professionalFieldName || '—'}</strong><small>{field.professionalFieldCode || ''}</small></td>
                            <td>{field.correctCount}/{field.totalQuestions}</td>
                            <td>{scoreWithScale(field.score)}</td>
                            <td>{scoreWithScale(field.passingThreshold)}</td>
                            <td><span className={`ear-result-badge ear-result-badge--${field.passed ? 'passed' : 'failed'}`}>{field.passed ? 'Đạt' : 'Chưa đạt'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="ear-report-card">
                  <h3>Theo mức nhận thức</h3>
                  <div className="ear-table-wrap">
                    <table className="ear-table ear-table--compact">
                      <thead><tr><th>Mức nhận thức</th><th>Đúng / tổng</th><th>Điểm</th></tr></thead>
                      <tbody>
                        {(breakdown?.cognitive || []).length === 0 ? <EmptyTableRow colSpan={3}>Chưa có dữ liệu nhận thức.</EmptyTableRow> : breakdown.cognitive.map((item) => (
                          <tr key={item.cognitiveLevel}>
                            <td>{item.cognitiveLabel || item.cognitiveLevel || '—'}</td>
                            <td>{item.correctCount}/{item.totalQuestions}</td>
                            <td>{scoreWithScale(item.score)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <section className="ear-section">
              <div className="ear-section__heading">
                <div>
                  <span className="ear-section__eyebrow">XEM LẠI BÀI LÀM</span>
                  <h2>Đáp án từng câu</h2>
                </div>
                <span className="ear-section__hint">Nội dung hiển thị theo snapshot của mã đề</span>
              </div>
              <div className="ear-question-list">
                {questions.length === 0 ? (
                  <div className="ear-state">Chưa có dữ liệu câu hỏi của lượt làm bài.</div>
                ) : questions.map((question) => {
                  const key = String(question.paperQuestionId)
                  const answer = answersByQuestion.get(key) || {}
                  const analysis = analysisByQuestion.get(key) || {}
                  const selectedAnswer = answer.selectedAnswer || question.selectedAnswer
                  const correctAnswer = answer.correctAnswer
                  const isCorrect = answer.correct ?? analysis.correct
                  return (
                    <article className="ear-question-card" key={question.paperQuestionId}>
                      <header className="ear-question-card__header">
                        <div>
                          <span className="ear-question-number">Câu {question.position}</span>
                          <strong>{analysis.professionalFieldName || 'Câu hỏi kiểm tra'}</strong>
                        </div>
                        <span className={`ear-result-badge ear-result-badge--${isCorrect === null || isCorrect === undefined ? 'pending' : isCorrect ? 'passed' : 'failed'}`}>
                          {isCorrect === null || isCorrect === undefined ? 'Chưa chấm' : isCorrect ? 'Đúng' : 'Sai'}
                        </span>
                      </header>
                      <p className="ear-question-card__stem">{question.stem}</p>
                      <div className="ear-options">
                        {['A', 'B', 'C', 'D'].map((optionKey) => {
                          const isSelected = selectedAnswer === optionKey
                          const isAnswer = correctAnswer === optionKey
                          return (
                            <div className={`ear-option${isAnswer ? ' ear-option--correct' : ''}${isSelected && !isAnswer ? ' ear-option--wrong' : ''}`} key={optionKey}>
                              <span className="ear-option__key">{optionKey}</span>
                              <span>{question[`option${optionKey}`] || '—'}</span>
                              {isAnswer && <small>Đáp án đúng</small>}
                              {isSelected && !isAnswer && <small>Bạn đã chọn</small>}
                            </div>
                          )
                        })}
                      </div>
                      {answer.explanation && <div className="ear-explanation"><strong>Giải thích</strong><span>{answer.explanation}</span></div>}
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="ear-section ear-section--compact">
              <div className="ear-section__heading">
                <div>
                  <span className="ear-section__eyebrow">LĨNH VỰC × MỨC NHẬN THỨC</span>
                  <h2>Chi tiết phân tích</h2>
                </div>
              </div>
              <div className="ear-table-wrap">
                <table className="ear-table ear-table--compact">
                  <thead><tr><th>Lĩnh vực</th><th>Mức nhận thức</th><th>Đúng / tổng</th><th>Ghi chú</th></tr></thead>
                  <tbody>
                    {(breakdown?.cells || []).length === 0 ? <EmptyTableRow colSpan={4}>Chưa có dữ liệu phân tích chi tiết.</EmptyTableRow> : breakdown.cells.map((cell) => (
                      <tr key={`${cell.professionalFieldId}-${cell.cognitiveLevel}`}>
                        <td>{cell.professionalFieldName || '—'}</td>
                        <td>{cell.cognitiveLabel || cell.cognitiveLevel || '—'}</td>
                        <td>{cell.correctCount}/{cell.totalQuestions}</td>
                        <td>{cell.smallSample ? 'Mẫu nhỏ, chỉ tham khảo' : 'Đủ mẫu'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
      {previewPaperId && (
        <ExamPaperPreviewModal
          paperId={previewPaperId}
          onClose={() => setPreviewPaperId(null)}
        />
      )}
    </AppShell>
  )
}
