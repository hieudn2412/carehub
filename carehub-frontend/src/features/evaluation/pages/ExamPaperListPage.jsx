import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteOutlined, DownloadOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, SendOutlined, EyeOutlined, CloseOutlined, FileTextOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage, difficultyText, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

const EXPORT_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function ExamPaperListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [papers, setPapers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [showAnswers, setShowAnswers] = useState(false)
  const [actionId, setActionId] = useState(null)

  const loadPapers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await examPaperApi.listExamPapers({})
      setPapers(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const timer = window.setTimeout(loadPapers, 0)
    return () => window.clearTimeout(timer)
  }, [loadPapers])

  const filteredPapers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return papers.filter((paper) => {
      const matchesKeyword = !normalized
        || (paper.name || '').toLowerCase().includes(normalized)
        || (paper.code || '').toLowerCase().includes(normalized)
        || (paper.examConfigName || '').toLowerCase().includes(normalized)
        || (paper.questionSetName || '').toLowerCase().includes(normalized)
      const matchesStatus = !status || paper.status === status
      return matchesKeyword && matchesStatus
    })
  }, [keyword, papers, status])

  const expandedPaper = expandedId ? papers.find((p) => p.id === expandedId) : null

  async function runAction(id, callback) {
    setActionId(id)
    try {
      await callback()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setActionId(null)
    }
  }

  function toggleExpand(paperId) {
    setExpandedId((current) => current === paperId ? null : paperId)
    setShowAnswers(false)
  }

  async function loadPaperDetail(paperId) {
    try {
      const response = await examPaperApi.getExamPaper(paperId)
      const detail = apiData(response)
      setPapers((current) => current.map((p) => p.id === paperId ? { ...p, _detail: detail, _questions: detail.questions || [] } : p))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  function handleExpand(paperId) {
    const paper = papers.find((p) => p.id === paperId)
    if (!paper || paper._detail) {
      toggleExpand(paperId)
      return
    }
    toggleExpand(paperId)
    loadPaperDetail(paperId)
  }

  async function publishPaper(paper) {
    await runAction(paper.id, async () => {
      await examPaperApi.publishExamPaper(paper.id)
      showToast('Đã phát hành bộ đề kiểm tra.', 'success')
      loadPapers()
    })
  }

  async function archivePaper(paper) {
    if (!window.confirm(`Lưu trữ bộ đề "${paper.name}"?`)) return
    await runAction(paper.id, async () => {
      await examPaperApi.archiveExamPaper(paper.id)
      showToast('Đã lưu trữ bộ đề kiểm tra.', 'success')
      loadPapers()
    })
  }

  async function exportPaper(paper, includeAnswers = false) {
    try {
      const response = await examPaperApi.exportExamPaper(paper.id, includeAnswers, 'docx')
      const filename = includeAnswers
        ? `dap-an-${paper.code || paper.id}.docx`
        : `${paper.code || paper.id}.docx`
      downloadBlob(filename, response.data, EXPORT_MIME)
      showToast(includeAnswers ? 'Đã tải đáp án DOCX.' : 'Đã tải đề DOCX.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  const breadcrumbs = [{ label: 'Quản lý bài kiểm tra' }]

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
                  <h1 className="exp-title">Quản lý bài kiểm tra</h1>
                  <p className="exp-subtitle">Tạo, giao, phát hành và quản lý đề kiểm tra tại một nơi</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={loadPapers} disabled={isLoading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                  <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-management/new')}>
                    <PlusCircleOutlined /> Tạo & giao bài
                  </button>
                </div>
              </div>

              <div className="exp-filter-bar">
                <div className="exp-search">
                  <SearchOutlined />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã đề, tên đề, cấu hình" />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Trạng thái</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="PUBLISHED">Đã phát hành</option>
                  <option value="ARCHIVED">Đã lưu trữ</option>
                </select>
              </div>

              <div className="exp-table-card">
                <table className="exp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Mã đề</th>
                      <th>Tên đề</th>
                      <th>Cấu hình</th>
                      <th>Số câu</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th style={{ width: 180, textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="8" className="exp-empty">Đang tải bộ đề kiểm tra...</td></tr>
                    ) : filteredPapers.length === 0 ? (
                      <tr><td colSpan="8" className="exp-empty">Chưa có bộ đề kiểm tra.</td></tr>
                    ) : filteredPapers.map((paper) => (
                      <tr key={paper.id}>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" className="exp-expand-btn" onClick={() => handleExpand(paper.id)}>
                            {expandedId === paper.id ? <CloseOutlined /> : <EyeOutlined />}
                          </button>
                        </td>
                        <td><strong>{paper.code}</strong></td>
                        <td>{paper.name}</td>
                        <td>{paper.examConfigName}</td>
                        <td>{paper.totalQuestions}</td>
                        <td><span className={`exp-badge exp-badge--${paper.status?.toLowerCase()}`}>{paper.statusText || paper.status}</span></td>
                        <td>{formatDateTime(paper.createdAt)}</td>
                        <td>
                          <div className="exp-actions">
                            <button type="button" onClick={() => exportPaper(paper, false)} title="Tải đề DOCX"><DownloadOutlined /></button>
                            <button type="button" onClick={() => exportPaper(paper, true)} title="Tải đáp án DOCX"><FileTextOutlined /></button>
                            {paper.status === 'DRAFT' && <button type="button" onClick={() => publishPaper(paper)} disabled={actionId === paper.id} title="Phát hành"><SendOutlined /></button>}
                            <button type="button" onClick={() => archivePaper(paper)} disabled={paper.status === 'ARCHIVED' || actionId === paper.id} title="Lưu trữ"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {expandedPaper?._detail && (
                  <div className="exp-detail-panel">
                    <div className="exp-detail-header">
                      <div>
                        <strong>{expandedPaper._detail.name}</strong>
                        <span>{expandedPaper._detail.code} · {expandedPaper._detail.statusText} · tạo {formatDateTime(expandedPaper._detail.createdAt)}</span>
                      </div>
                      <div className="exp-detail-actions">
                        <button type="button" className="exp-btn-secondary" onClick={() => setShowAnswers((v) => !v)}>
                          {showAnswers ? 'Ẩn đáp án' : 'Hiện đáp án'}
                        </button>
                        <button type="button" className="exp-btn-secondary" onClick={() => exportPaper(expandedPaper, false)}>
                          <DownloadOutlined /> Tải đề DOCX
                        </button>
                        <button type="button" className="exp-btn-secondary" onClick={() => exportPaper(expandedPaper, true)}>
                          <FileTextOutlined /> Tải đáp án DOCX
                        </button>
                        {expandedPaper._detail.status === 'DRAFT' && (
                          <button type="button" className="exp-btn-primary" onClick={() => publishPaper(expandedPaper)}>
                            <SendOutlined /> Phát hành
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="exp-info-strip">
                      <span>{expandedPaper._detail.totalQuestions} câu</span>
                      <span>{expandedPaper._detail.timeLimitMinutes} phút</span>
                      <span>Đạt {expandedPaper._detail.passingScore}%</span>
                      <span>{expandedPaper._detail.examConfigName}</span>
                      <span>{expandedPaper._detail.questionSetName}</span>
                    </div>

                    <div className="exp-question-list">
                      {(expandedPaper._questions || []).map((question) => (
                        <div className="exp-question-card" key={question.id || question.sourceQuestionId}>
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
                  </div>
                )}
              </div>
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

export default ExamPaperListPage
