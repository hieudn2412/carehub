import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteOutlined, DownloadOutlined, PlusCircleOutlined, ReloadOutlined, SendOutlined, EyeOutlined, CloseOutlined, FileTextOutlined } from '@ant-design/icons'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import Modal from '../../../shared/components/Modal.jsx'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ExamManagementViewSwitch from '../components/ExamManagementViewSwitch.jsx'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage, cognitiveLevelText, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

const EXPORT_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function ExamPaperListPage({
  activeView = 'papers',
  canViewPapers = true,
  canViewAssignments = true,
  onViewChange = () => {},
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [papers, setPapers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', status: '' })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [showAnswers, setShowAnswers] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [pendingArchive, setPendingArchive] = useState(null)

  const loadPapers = useCallback(async () => {
    setIsLoading(true)
    try {
      const paperResponse = await examPaperApi.listExamPapers({})
      setPapers(apiData(paperResponse, []))
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

  useEffect(() => {
    const nextKeyword = keyword.trim()
    if (nextKeyword === appliedFilters.keyword) return undefined
    const timer = window.setTimeout(() => {
      setAppliedFilters((current) => (
        current.keyword === nextKeyword ? current : { ...current, keyword: nextKeyword }
      ))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [appliedFilters.keyword, keyword])

  const filteredPapers = useMemo(() => {
    const normalized = appliedFilters.keyword.toLowerCase()
    return papers.filter((paper) => {
      const matchesKeyword = !normalized
        || (paper.name || '').toLowerCase().includes(normalized)
        || (paper.code || '').toLowerCase().includes(normalized)
        || (paper.examConfigName || '').toLowerCase().includes(normalized)
      const matchesStatus = !appliedFilters.status || paper.status === appliedFilters.status
      return matchesKeyword && matchesStatus
    })
  }, [appliedFilters, papers])

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
    setPendingArchive(paper)
  }

  async function confirmArchivePaper() {
    if (!pendingArchive) return
    const paper = pendingArchive
    setPendingArchive(null)
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
  const applyFilters = () => setAppliedFilters({ keyword: keyword.trim(), status })
  const resetFilters = () => {
    setKeyword('')
    setStatus('')
    setAppliedFilters({ keyword: '', status: '' })
  }

  return (
    <AppShell className="dashboard-layout" breadcrumbs={breadcrumbs}>
      <div className="exp-page">
              <section className="exp-management-card">
                <ExamManagementViewSwitch
                  activeView={activeView}
                  canViewPapers={canViewPapers}
                  canViewAssignments={canViewAssignments}
                  onChange={onViewChange}
                />

                <AppliedFilterToolbar
                  activeCount={status ? 1 : 0}
                  actions={<div className="exp-title-actions">
                    <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-management/new')}>
                      <PlusCircleOutlined /> Tạo bài kiểm tra mới
                    </button>
                    <button type="button" className="exp-btn-secondary" onClick={loadPapers} disabled={isLoading}>
                      <ReloadOutlined /> Tải lại
                    </button>
                  </div>}
                  className="exp-filter-bar"
                  isOpen={isFilterOpen}
                  onApply={applyFilters}
                  onReset={resetFilters}
                  onSearchChange={setKeyword}
                  onToggle={() => setIsFilterOpen((current) => !current)}
                  panelId="exam-paper-filter-panel"
                  searchAriaLabel="Tìm mã đề, tên đề hoặc cấu hình"
                  searchClassName="exp-search"
                  searchPlaceholder="Tìm mã đề, tên đề, cấu hình"
                  searchValue={keyword}
                >
                    <FilterSelectField
                      label="Trạng thái"
                      value={status}
                      onChange={setStatus}
                      options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'DRAFT', label: 'Bản nháp' }, { value: 'PUBLISHED', label: 'Đã phát hành' }, { value: 'ARCHIVED', label: 'Đã lưu trữ' }]}
                      placeholder="Tất cả trạng thái"
                    />
                </AppliedFilterToolbar>

                <div className="exp-table-card">
                <table className="exp-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th>Mã đề</th>
                      <th>Tên đề</th>
                      <th>Cấu hình</th>
                      <th>Số câu</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th style={{ width: 180 }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="7" className="exp-empty">Đang tải bộ đề kiểm tra...</td></tr>
                    ) : filteredPapers.length === 0 ? (
                      <tr><td colSpan="7" className="exp-empty">Chưa có bộ đề kiểm tra.</td></tr>
                    ) : filteredPapers.map((paper) => (
                      <tr key={paper.id}>
                        <td><strong>{paper.code}</strong></td>
                        <td>{paper.name}</td>
                        <td>{paper.examConfigName}</td>
                        <td>{paper.totalQuestions}</td>
                        <td><span className={`exp-badge exp-badge--${paper.status?.toLowerCase()}`}>{paper.statusText || paper.status}</span></td>
                        <td>{formatDateTime(paper.createdAt)}</td>
                        <td>
                          <div className="admin-table-actions exp-table-actions">
                            <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--primary" onClick={() => handleExpand(paper.id)} title="Xem chi tiết">
                              {expandedId === paper.id ? <CloseOutlined /> : <EyeOutlined />}
                            </button>
                            <button type="button" className="admin-table-action admin-table-action--icon" onClick={() => exportPaper(paper, false)} title="Tải đề DOCX"><DownloadOutlined /></button>
                            <button type="button" className="admin-table-action admin-table-action--icon" onClick={() => exportPaper(paper, true)} title="Tải đáp án DOCX"><FileTextOutlined /></button>
                            {paper.status === 'DRAFT' && <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--success" onClick={() => publishPaper(paper)} disabled={actionId === paper.id} title="Phát hành"><SendOutlined /></button>}
                            {paper.status === 'PUBLISHED' && <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--primary" onClick={() => navigate(`/admin/evaluation/exam-assignments/new?paperId=${paper.id}`)} title="Giao đề"><SendOutlined /></button>}
                            <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--danger" onClick={() => archivePaper(paper)} disabled={paper.status === 'ARCHIVED' || actionId === paper.id} title="Lưu trữ"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

      {expandedPaper && (
        <Modal
          size="lg"
          title={`Chi tiết đề kiểm tra: ${expandedPaper.name} (Mã đề: ${expandedPaper.code})`}
          onClose={() => setExpandedId(null)}
        >
          {!expandedPaper._detail ? (
            <div className="exp-empty" style={{ padding: '36px 0' }}>Đang tải nội dung đề kiểm tra...</div>
          ) : (
            <div className="exp-detail-panel" style={{ border: 0, boxShadow: 'none', padding: 0 }}>
              <div className="exp-detail-header">
                <div>
                  <strong>{expandedPaper._detail.name}</strong>
                  <span>Mã đề: <strong>{expandedPaper._detail.code}</strong> (ID: {expandedPaper._detail.id}) · {expandedPaper._detail.statusText} · tạo {formatDateTime(expandedPaper._detail.createdAt)}</span>
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
                  {expandedPaper._detail.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      className="exp-btn-primary"
                      onClick={() => {
                        setExpandedId(null)
                        navigate(`/admin/evaluation/exam-assignments/new?paperId=${expandedPaper.id}`)
                      }}
                    >
                      <SendOutlined /> Giao đề này
                    </button>
                  )}
                </div>
              </div>

              <div className="exp-info-strip">
                <span><strong>{expandedPaper._detail.totalQuestions}</strong> câu</span>
                <span><strong>{expandedPaper._detail.timeLimitMinutes}</strong> phút</span>
                <span>Đạt <strong>{expandedPaper._detail.passingScore}/10</strong></span>
                <span>Cấu hình: <strong>{expandedPaper._detail.examConfigName}</strong></span>
                {expandedPaper._detail.generationBatchId && <span>Batch #{expandedPaper._detail.generationBatchId} · mã {expandedPaper._detail.variantIndex}</span>}
                {expandedPaper._detail.generationAlgorithmVersion && <span>{expandedPaper._detail.generationAlgorithmVersion}</span>}
              </div>

              {expandedPaper._detail.coverage?.length > 0 && (
                <div className="exp-coverage" aria-label="Đối chiếu ma trận đề">
                  <strong>Đối chiếu ma trận snapshot</strong>
                  <div className="exp-coverage__grid">
                    {expandedPaper._detail.coverage.map((cell) => (
                      <span className={cell.matchesBlueprint ? 'is-valid' : 'is-invalid'} key={`${cell.professionalFieldId}-${cell.cognitiveLevel}`}>
                        {cell.professionalFieldName} · {cell.cognitiveLabel}: {cell.actualCount}/{cell.requiredCount}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="exp-question-list">
                {(expandedPaper._questions || []).map((question) => (
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
            </div>
          )}
        </Modal>
      )}

      <ConfirmModal
        isOpen={Boolean(pendingArchive)}
        title="Lưu trữ bộ đề?"
        message={pendingArchive ? `Bộ đề “${pendingArchive.name}” sẽ không còn xuất hiện trong kho bài kiểm tra.` : ''}
        confirmText="Lưu trữ bộ đề"
        danger
        onCancel={() => setPendingArchive(null)}
        onConfirm={confirmArchivePaper}
      />
    </AppShell>
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
