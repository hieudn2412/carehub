import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteOutlined, DownloadOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, SendOutlined, EyeOutlined, CloseOutlined, FileTextOutlined, FilterOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import ConfirmModal from '../../admin/components/ConfirmModal.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ExamManagementViewSwitch from '../components/ExamManagementViewSwitch.jsx'
import { examPaperApi } from '../api/examPaperApi.js'
import { examConfigApi } from '../api/examConfigApi.js'
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
  const [activeConfigs, setActiveConfigs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [showAnswers, setShowAnswers] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [pendingArchive, setPendingArchive] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState(null)
  const [generation, setGeneration] = useState(() => ({
    examConfigId: '',
    namePrefix: '',
    variantCount: 1,
    randomSeed: '',
    zeroOverlap: false,
    idempotencyKey: newIdempotencyKey(),
  }))

  const loadPapers = useCallback(async () => {
    setIsLoading(true)
    try {
      const [paperResponse, configResponse] = await Promise.all([
        examPaperApi.listExamPapers({}),
        examConfigApi.listExamConfigs({ status: 'ACTIVE' }),
      ])
      setPapers(apiData(paperResponse, []))
      setActiveConfigs((apiData(configResponse, []) || []).filter((config) => config.status === 'ACTIVE' && !config.questionSetId))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  function updateGeneration(key, value) {
    setGeneration((current) => ({ ...current, [key]: value, idempotencyKey: newIdempotencyKey() }))
    setGenerationResult(null)
  }

  async function generatePapers() {
    if (!generation.examConfigId) {
      showToast('Vui lòng chọn cấu hình đề đang hoạt động.', 'warning')
      return
    }
    setIsGenerating(true)
    try {
      const preview = apiData(await examConfigApi.previewSavedExamConfig(generation.examConfigId, {
        variantCount: Number(generation.variantCount),
        zeroOverlap: generation.zeroOverlap,
      }))
      if (!preview?.valid) {
        showToast(preview?.warnings?.join('; ') || 'Cấu hình chưa đủ nguồn câu hỏi.', 'warning')
        return
      }
      const response = await examPaperApi.generateExamPapers({
        examConfigId: Number(generation.examConfigId),
        namePrefix: generation.namePrefix.trim() || null,
        variantCount: Number(generation.variantCount),
        randomSeed: generation.randomSeed === '' ? null : Number(generation.randomSeed),
        zeroOverlap: generation.zeroOverlap,
        idempotencyKey: generation.idempotencyKey,
      })
      const generated = apiData(response, [])
      setGenerationResult(generated)
      showToast(`Đã sinh ${generated.length} mã đề ở trạng thái bản nháp.`, 'success')
      setGeneration((current) => ({ ...current, idempotencyKey: newIdempotencyKey() }))
      await loadPapers()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsGenerating(false)
    }
  }

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

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <section className="exp-management-card">
                <ExamManagementViewSwitch
                  activeView={activeView}
                  canViewPapers={canViewPapers}
                  canViewAssignments={canViewAssignments}
                  onChange={onViewChange}
                />

                <section className="exp-generation-panel" aria-labelledby="paper-generation-title">
                  <div className="exp-generation-panel__intro">
                    <div>
                      <span className="exp-section-kicker">SINH THÊM MÃ ĐỀ</span>
                      <h2 id="paper-generation-title">Sinh thêm mã đề từ ma trận có sẵn</h2>
                      <p>Dùng khi cần thêm biến thể đề cho một ma trận đã kích hoạt. Bài kiểm tra mới nên tạo từ nút "Tạo bài kiểm tra mới" bên dưới.</p>
                    </div>
                    <button type="button" className="exp-btn-primary" onClick={generatePapers} disabled={isGenerating || activeConfigs.length === 0}>
                      {isGenerating ? 'Đang sinh mã đề...' : 'Kiểm tra nguồn và sinh mã đề'}
                    </button>
                  </div>
                  <div className="exp-generation-grid">
                    <label>
                      <span>Cấu hình đã kích hoạt</span>
                      <select value={generation.examConfigId} onChange={(event) => updateGeneration('examConfigId', event.target.value)}>
                        <option value="">Chọn cấu hình</option>
                        {activeConfigs.map((config) => <option key={config.id} value={config.id}>{config.name} · v{config.blueprintVersion}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Tiền tố tên đề</span>
                      <input value={generation.namePrefix} onChange={(event) => updateGeneration('namePrefix', event.target.value)} placeholder="Để trống sẽ dùng tên cấu hình" />
                    </label>
                    <label>
                      <span>Số mã đề</span>
                      <input type="number" min="1" max="10" value={generation.variantCount} onChange={(event) => updateGeneration('variantCount', event.target.value)} />
                    </label>
                    <label>
                      <span>Master seed (tùy chọn)</span>
                      <input type="number" value={generation.randomSeed} onChange={(event) => updateGeneration('randomSeed', event.target.value)} placeholder="Tự sinh nếu để trống" />
                    </label>
                    <label className="exp-generation-check">
                      <input type="checkbox" checked={generation.zeroOverlap} onChange={(event) => updateGeneration('zeroOverlap', event.target.checked)} />
                      <span>Không lặp họ câu hỏi giữa các mã đề</span>
                    </label>
                  </div>
                  {activeConfigs.length === 0 && <p className="exp-generation-panel__empty">Chưa có ma trận đang hoạt động. Hãy tạo và kích hoạt ma trận trước khi sinh mã đề.</p>}
                  {generationResult?.length > 0 && (
                    <div className="exp-generation-result" role="status">
                      <strong>Batch #{generationResult[0].generationBatchId}: {generationResult.length} mã đề</strong>
                      <span>Overlap {generationResult[0].overlapQuestionCount ?? 0} lượt câu ({Number(generationResult[0].overlapPercentage || 0).toFixed(2)}%)</span>
                      <span>Thuật toán {generationResult[0].generationAlgorithmVersion}</span>
                    </div>
                  )}
                </section>

                <div className="exp-filter-bar admin-control-toolbar">
                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__controls">
                    <div className="exp-search admin-control-toolbar__search">
                      <SearchOutlined />
                      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã đề, tên đề, cấu hình" />
                    </div>
                    <button
                      aria-controls="exam-paper-filter-panel"
                      aria-expanded={isFilterOpen}
                      className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      onClick={() => setIsFilterOpen((current) => !current)}
                      type="button"
                    >
                      <FilterOutlined /> Bộ lọc
                      {status && <span className="admin-control-toolbar__filter-count">1</span>}
                    </button>
                  </div>
                  <div className="exp-title-actions">
                    <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-management/new')}>
                      <PlusCircleOutlined /> Tạo bài kiểm tra mới
                    </button>
                    <button type="button" className="exp-btn-secondary" onClick={loadPapers} disabled={isLoading}>
                      <ReloadOutlined /> Tải lại
                    </button>
                  </div>
                </div>
                {isFilterOpen && (
                  <div className="admin-control-toolbar__panel" id="exam-paper-filter-panel">
                    <label className="admin-control-toolbar__field">
                      <span>Trạng thái</span>
                      <select value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="DRAFT">Bản nháp</option>
                        <option value="PUBLISHED">Đã phát hành</option>
                        <option value="ARCHIVED">Đã lưu trữ</option>
                      </select>
                    </label>
                  </div>
                  )}
                </div>

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
                      <span>Đạt {expandedPaper._detail.passingScore}/10</span>
                      <span>{expandedPaper._detail.examConfigName}</span>
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
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingArchive)}
        title="Lưu trữ bộ đề?"
        message={pendingArchive ? `Bộ đề “${pendingArchive.name}” sẽ không còn xuất hiện trong kho bài kiểm tra.` : ''}
        confirmText="Lưu trữ bộ đề"
        danger
        onCancel={() => setPendingArchive(null)}
        onConfirm={confirmArchivePaper}
      />
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

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `paper-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default ExamPaperListPage
