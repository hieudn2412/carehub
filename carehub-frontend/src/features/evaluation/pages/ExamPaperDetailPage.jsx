import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DownloadOutlined, SendOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage, difficultyText, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

const EXPORT_FORMATS = ['txt', 'pdf', 'docx', 'xlsx']
const EXPORT_MIME_TYPES = {
  txt: 'text/plain;charset=utf-8',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function ExamPaperDetailPage() {
  const navigate = useNavigate()
  const { paperId } = useParams()
  const { showToast } = useToast()
  const [paper, setPaper] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAnswers, setShowAnswers] = useState(false)
  const [exportFormat, setExportFormat] = useState('docx')

  const loadPaper = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await examPaperApi.getExamPaper(paperId)
      setPaper(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [paperId, showToast])

  useEffect(() => {
    const timer = window.setTimeout(loadPaper, 0)
    return () => window.clearTimeout(timer)
  }, [loadPaper])

  async function publishPaper() {
    try {
      const response = await examPaperApi.publishExamPaper(paper.id)
      setPaper(apiData(response))
      showToast('Đã phát hành bộ đề kiểm tra.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function exportPaper(includeAnswers = false) {
    try {
      const response = await examPaperApi.exportExamPaper(paper.id, includeAnswers, exportFormat)
      const filename = includeAnswers
        ? `dap-an-${paper.code || paper.id}.${exportFormat}`
        : `${paper.code || paper.id}.${exportFormat}`
      downloadBlob(filename, response.data, EXPORT_MIME_TYPES[exportFormat] || EXPORT_MIME_TYPES.txt)
      showToast(includeAnswers ? `Đã tải đáp án bộ đề ${exportFormat.toUpperCase()}.` : `Đã tải bộ đề ${exportFormat.toUpperCase()}.`, 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  const breadcrumbs = [
    { label: 'Quản lý bài kiểm tra', path: '/admin/evaluation/exam-management' },
    { label: paper?.code || 'Chi tiết' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              {isLoading || !paper ? (
                <div className="exp-title-card">Đang tải bộ đề kiểm tra...</div>
              ) : (
                <>
                  <div className="exp-title-card">
                    <div>
                      <h1 className="exp-title">{paper.name}</h1>
                      <p className="exp-subtitle">{paper.code} · {paper.statusText} · tạo lúc {formatDateTime(paper.createdAt)}</p>
                    </div>
                    <div className="exp-title-actions">
                      <button type="button" className="exp-btn-secondary" onClick={() => navigate('/admin/evaluation/exam-management')}>Quay lại</button>
                      <button type="button" className="exp-btn-secondary" onClick={() => setShowAnswers((current) => !current)}>
                        {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
                      </button>
                      <select className="exp-export-select" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} title="Định dạng export">
                        {EXPORT_FORMATS.map((format) => (
                          <option key={format} value={format}>{format.toUpperCase()}</option>
                        ))}
                      </select>
                      <button type="button" className="exp-btn-secondary" onClick={() => exportPaper(false)}>
                        <DownloadOutlined /> Tải đề
                      </button>
                      <button type="button" className="exp-btn-secondary" onClick={() => exportPaper(true)}>
                        <DownloadOutlined /> Tải đáp án
                      </button>
                      {paper.status === 'DRAFT' && (
                        <button type="button" className="exp-btn-primary" onClick={publishPaper}>
                          <SendOutlined /> Phát hành
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="exp-info-strip">
                    <span>{paper.totalQuestions} câu</span>
                    <span>{paper.timeLimitMinutes} phút</span>
                    <span>Đạt {paper.passingScore}%</span>
                    <span>{paper.examConfigName}</span>
                    <span>{paper.questionSetName}</span>
                  </div>

                  <div className="exp-question-list">
                    {(paper.questions || []).map((question) => (
                      <div className="exp-question-card" key={question.id}>
                        <div className="exp-question-head">
                          <strong>Câu {question.position}</strong>
                          <span>{difficultyText(question.difficulty)} · {question.topic || 'Chưa phân loại'}</span>
                        </div>
                        <p>{question.stem}</p>
                        <ol type="A">
                          <li>{question.optionA}</li>
                          <li>{question.optionB}</li>
                          <li>{question.optionC}</li>
                          <li>{question.optionD}</li>
                        </ol>
                        {showAnswers && (
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
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

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

export default ExamPaperDetailPage
