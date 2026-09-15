import { useEffect, useState } from 'react'
import { ArrowLeftOutlined, DownloadOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage, cognitiveLevelText, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function downloadBlob(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExamAssignmentPaperPage() {
  const navigate = useNavigate()
  const { assignmentId, paperId } = useParams()
  const { showToast } = useToast()
  const [paper, setPaper] = useState(null)
  const [showAnswers, setShowAnswers] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const resultsPath = `/admin/evaluation/exam-management/assignments/${assignmentId}/results`

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    examPaperApi.getExamPaper(paperId)
      .then((response) => { if (active) setPaper(apiData(response, null)) })
      .catch((requestError) => { if (active) setError(apiErrorMessage(requestError)) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [paperId])

  async function exportPaper(includeAnswers) {
    if (!paper) return
    setIsExporting(true)
    try {
      const response = await examPaperApi.exportExamPaper(paper.id, includeAnswers, 'docx')
      downloadBlob(
        `${includeAnswers ? 'dap-an-' : ''}${paper.code || paper.id}.docx`,
        response.data,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      showToast(includeAnswers ? 'Đã tải đáp án DOCX.' : 'Đã tải đề DOCX.', 'success')
    } catch (requestError) {
      showToast(apiErrorMessage(requestError), 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell
      title="Xem mã đề"
      back={{ to: resultsPath, label: 'Kết quả bài kiểm tra' }}
      breadcrumbs={[
        { label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management?view=assignments' },
        { label: 'Kết quả bài kiểm tra', link: resultsPath },
        { label: 'Mã đề' },
      ]}
    >
      <div className="exp-page">
        <section className="exp-detail-panel">
          {isLoading ? (
            <div className="exp-empty"><LoadingOutlined spin /> Đang tải nội dung mã đề...</div>
          ) : error ? (
            <div className="exp-empty" role="alert">{error}</div>
          ) : paper ? (
            <>
              <div className="exp-detail-header">
                <div>
                  <strong>{paper.name}</strong>
                  <span>Mã đề: <strong>{paper.code}</strong> · {paper.statusText || paper.status} · tạo {formatDateTime(paper.createdAt)}</span>
                </div>
                <div className="exp-detail-actions">
                  <button type="button" className="exp-btn-secondary" onClick={() => navigate(resultsPath)}><ArrowLeftOutlined /> Kết quả</button>
                  <button type="button" className="exp-btn-secondary" onClick={() => setShowAnswers((current) => !current)}>{showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}</button>
                  <button type="button" className="exp-btn-secondary" onClick={() => exportPaper(false)} disabled={isExporting}><DownloadOutlined /> Tải đề DOCX</button>
                  <button type="button" className="exp-btn-secondary" onClick={() => exportPaper(true)} disabled={isExporting}><FileTextOutlined /> Tải đáp án DOCX</button>
                </div>
              </div>

              <div className="exp-info-strip">
                <span><strong>{paper.totalQuestions}</strong> câu</span>
                <span><strong>{paper.timeLimitMinutes}</strong> phút</span>
                <span>Đạt <strong>{paper.passingScore}/10</strong></span>
              </div>

              <div className="exp-question-list">
                {(paper.questions || []).length === 0 ? (
                  <div className="exp-empty">Mã đề chưa có câu hỏi.</div>
                ) : (paper.questions || []).map((question) => (
                  <div className="exp-question-card" key={question.id || question.sourceQuestionId}>
                    <div className="exp-question-head">
                      <strong>Câu {question.position}</strong>
                      <span>{question.professionalFieldName || 'Chưa có lĩnh vực'} · {question.cognitiveLabel || cognitiveLevelText(question.cognitiveLevel)} · {question.categoryName || question.topic || 'Chưa có danh mục'}</span>
                    </div>
                    <p>{question.stem}</p>
                    <ol type="A">
                      <li>{question.optionA}</li>
                      <li>{question.optionB}</li>
                      <li>{question.optionC}</li>
                      <li>{question.optionD}</li>
                    </ol>
                    {showAnswers && question.correctAnswer && (
                      <div className="exp-answer-box">
                        <strong>Đáp án đúng: {question.correctAnswer}</strong>
                        {question.explanation && <span>{question.explanation}</span>}
                        {question.sourceDocument && <span>Nguồn: {question.sourceDocument}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </AppShell>
  )
}
