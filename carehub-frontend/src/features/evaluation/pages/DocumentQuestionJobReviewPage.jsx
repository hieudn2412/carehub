import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../api/documentQuestionApi.js'
import {
  apiData,
  apiErrorMessage,
  candidateLabelText,
  candidateStatusText,
  difficultyText,
  formatDateTime,
  formatNumber,
  jobStatusText,
  normalizeText,
  parseJsonList,
  statusTone,
} from '../utils/documentQuestionUi.js'
import '../styles/QuestionDocumentPages.css'

const LIVE_JOB_STATUSES = new Set(['CREATED', 'GENERATING'])
const STRONG_DUPLICATE_THRESHOLD = 0.93

function DocumentQuestionJobReviewPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [jobDetail, setJobDetail] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [candidateActionId, setCandidateActionId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([])
  const [isBatching, setIsBatching] = useState(false)

  const loadJob = useCallback(async (options = {}) => {
    const silent = options?.silent === true
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const response = await documentQuestionApi.getQuestionJob(jobId)
      setJobDetail(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [jobId, showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadJob()
  }, [loadJob])

  useEffect(() => {
    if (!LIVE_JOB_STATUSES.has(jobDetail?.status)) {
      return undefined
    }
    const intervalId = window.setInterval(() => {
      loadJob({ silent: true })
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [jobDetail?.status, loadJob])

  const candidates = useMemo(() => jobDetail?.candidates || [], [jobDetail])
  const filteredCandidates = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    return candidates.filter((candidate) => {
      const matchesKeyword = !normalizedKeyword || normalizeText(candidate.stem).includes(normalizedKeyword)
      const matchesStatus = !statusFilter || candidate.status === statusFilter || candidate.label === statusFilter
      const matchesDifficulty = !difficultyFilter || normalizeText(candidate.difficulty) === normalizeText(difficultyFilter)
      return matchesKeyword && matchesStatus && matchesDifficulty
    })
  }, [candidates, keyword, statusFilter, difficultyFilter])
  const benchmarkMetrics = useMemo(() => {
    const total = candidates.length
    const approved = candidates.filter((candidate) => ['APPROVED', 'SAVED'].includes(candidate.status)).length
    const saved = candidates.filter((candidate) => candidate.status === 'SAVED').length
    const duplicateWarnings = candidates.filter((candidate) => Number(candidate.duplicateMaxSimilarity || 0) >= 0.8).length
    const completedChunks = Math.max(1, Number(jobDetail?.completedChunkCount || 0))
    return {
      latencyPerChunk: Math.round(Number(jobDetail?.usage?.latencyMs || 0) / completedChunks),
      approveRate: total ? approved / total : 0,
      saveRate: total ? saved / total : 0,
      duplicateWarningRate: total ? duplicateWarnings / total : 0,
    }
  }, [candidates, jobDetail])

  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) || filteredCandidates[0]
  const selectedCandidates = candidates.filter((candidate) => selectedCandidateIds.includes(candidate.id))
  const selectedApprovableIds = selectedCandidates
    .filter((candidate) => !['REJECTED', 'APPROVED', 'SAVED'].includes(candidate.status))
    .map((candidate) => candidate.id)
  const selectedRejectableIds = selectedCandidates
    .filter((candidate) => !['REJECTED', 'SAVED'].includes(candidate.status))
    .map((candidate) => candidate.id)
  const selectedSavableIds = selectedCandidates
    .filter((candidate) => candidate.status === 'APPROVED' && Number(candidate.duplicateMaxSimilarity || 0) < STRONG_DUPLICATE_THRESHOLD)
    .map((candidate) => candidate.id)

  async function retryFailedChunks() {
    setIsRetrying(true)
    try {
      const response = await documentQuestionApi.retryFailedChunks(jobId)
      setJobDetail(apiData(response))
      showToast('Retry các chunk lỗi thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsRetrying(false)
    }
  }

  async function cancelJob() {
    if (!window.confirm('Hủy phiên tạo câu hỏi đang chạy? Các candidate đã tạo trước đó vẫn được giữ lại.')) return
    try {
      const response = await documentQuestionApi.cancelQuestionJob(jobId)
      setJobDetail(apiData(response))
      showToast('Đã hủy phiên tạo câu hỏi.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function runBatchAction(action, candidateIds, successMessage, reviewerNotes = '') {
    if (!candidateIds.length) {
      showToast('Không có candidate phù hợp để thao tác hàng loạt.', 'warning')
      return
    }
    setIsBatching(true)
    try {
      const response = await action(candidateIds, reviewerNotes)
      const result = apiData(response, {})
      replaceCandidates(result.candidates || [])
      setSelectedCandidateIds((current) => current.filter((id) => !(result.succeededCandidateIds || []).includes(id)))
      if (Number(result.failedCount || 0) > 0) {
        showToast(`${successMessage}. ${result.failedCount} candidate lỗi, kiểm tra lại trạng thái từng câu.`, 'warning')
      } else {
        showToast(successMessage, 'success')
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsBatching(false)
    }
  }

  async function approveSelected() {
    await runBatchAction(
      documentQuestionApi.approveCandidates,
      selectedApprovableIds,
      'Đã duyệt hàng loạt câu hỏi đề xuất',
      '',
    )
  }

  async function rejectSelected() {
    const reviewerNotes = window.prompt('Ghi chú lý do từ chối nếu cần:', '') || ''
    await runBatchAction(
      documentQuestionApi.rejectCandidates,
      selectedRejectableIds,
      'Đã từ chối hàng loạt câu hỏi đề xuất',
      reviewerNotes,
    )
  }

  async function saveSelected() {
    await runBatchAction(
      (candidateIds) => documentQuestionApi.saveCandidatesAsQuestions(candidateIds),
      selectedSavableIds,
      'Đã lưu hàng loạt câu hỏi vào ngân hàng',
    )
  }

  function openEditModal(candidate) {
    setEditingCandidate(candidate)
    setEditForm({
      stem: candidate.stem || '',
      optionA: candidate.optionA || '',
      optionB: candidate.optionB || '',
      optionC: candidate.optionC || '',
      optionD: candidate.optionD || '',
      correctAnswer: candidate.correctAnswer || 'A',
      explanation: candidate.explanation || '',
      difficulty: candidate.difficulty || 'easy',
      topic: candidate.topic || '',
      sourceExcerpt: candidate.sourceExcerpt || '',
      reviewerNotes: candidate.reviewerNotes || '',
    })
  }

  async function saveEdit() {
    if (!editingCandidate || !editForm) return
    const requiredFields = ['stem', 'optionA', 'optionB', 'optionC', 'optionD', 'sourceExcerpt']
    if (requiredFields.some((field) => !editForm[field]?.trim())) {
      showToast('Vui lòng nhập đầy đủ câu hỏi, 4 đáp án và trích dẫn nguồn.', 'warning')
      return
    }
    setCandidateActionId(editingCandidate.id)
    try {
      const response = await documentQuestionApi.updateCandidate(editingCandidate.id, {
        ...editForm,
        correctAnswer: editForm.correctAnswer,
      })
      replaceCandidate(apiData(response))
      showToast('Cập nhật và kiểm tra lại câu hỏi thành công.', 'success')
      setEditingCandidate(null)
      setEditForm(null)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setCandidateActionId(null)
    }
  }

  async function approveCandidate(candidate) {
    setCandidateActionId(candidate.id)
    try {
      const response = await documentQuestionApi.approveCandidate(candidate.id, candidate.reviewerNotes || '')
      replaceCandidate(apiData(response))
      showToast('Duyệt câu hỏi đề xuất thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setCandidateActionId(null)
    }
  }

  async function rejectCandidate(candidate) {
    const reviewerNotes = window.prompt('Ghi chú lý do từ chối nếu cần:', candidate.reviewerNotes || '') || ''
    setCandidateActionId(candidate.id)
    try {
      const response = await documentQuestionApi.rejectCandidate(candidate.id, reviewerNotes)
      replaceCandidate(apiData(response))
      showToast('Từ chối câu hỏi đề xuất thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setCandidateActionId(null)
    }
  }

  async function saveAsQuestion(candidate) {
    setCandidateActionId(candidate.id)
    try {
      const response = await documentQuestionApi.saveCandidateAsQuestion(candidate.id)
      replaceCandidate(apiData(response))
      showToast('Lưu câu hỏi vào ngân hàng câu hỏi thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setCandidateActionId(null)
    }
  }

  function replaceCandidate(updatedCandidate) {
    if (!updatedCandidate) return
    setJobDetail((current) => ({
      ...current,
      candidates: (current?.candidates || []).map((candidate) =>
        candidate.id === updatedCandidate.id ? updatedCandidate : candidate
      ),
    }))
    setSelectedCandidateId(updatedCandidate.id)
  }

  function replaceCandidates(updatedCandidates) {
    if (!updatedCandidates.length) return
    const updatedById = new Map(updatedCandidates.map((candidate) => [candidate.id, candidate]))
    setJobDetail((current) => ({
      ...current,
      candidates: (current?.candidates || []).map((candidate) => updatedById.get(candidate.id) || candidate),
    }))
    setSelectedCandidateId(updatedCandidates[0].id)
  }

  function toggleCandidateSelection(candidateId) {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    )
  }

  function toggleFilteredSelection() {
    const filteredIds = filteredCandidates.map((candidate) => candidate.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedCandidateIds.includes(id))
    setSelectedCandidateIds((current) => {
      if (allSelected) {
        return current.filter((id) => !filteredIds.includes(id))
      }
      return Array.from(new Set([...current, ...filteredIds]))
    })
  }

  const breadcrumbs = [
    { label: 'Đánh giá' },
    { label: 'Tạo câu hỏi từ tài liệu', link: '/admin/evaluation/question-documents' },
    { label: 'Review phiên tạo' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qdoc-page">
              <button type="button" className="qdoc-back-btn" onClick={() => navigate(-1)}>
                <ArrowLeftOutlined />
                <span>Quay lại</span>
              </button>

              {isLoading ? (
                <section className="qdoc-panel qdoc-loading-panel">Đang tải phiên tạo câu hỏi...</section>
              ) : !jobDetail ? (
                <section className="qdoc-panel qdoc-loading-panel">Không tìm thấy phiên tạo câu hỏi.</section>
              ) : (
                <>
                  <section className="qdoc-detail-hero">
                    <div className="qdoc-detail-heading">
                      <FileBadge />
                      <div>
                        <h1>Review phiên tạo câu hỏi #{jobDetail.id}</h1>
                        <div className="qdoc-detail-meta">
                          <span className={`qdoc-badge qdoc-badge--${statusTone(jobDetail.status)}`}>
                            {jobStatusText(jobDetail)}
                          </span>
                          <span>{jobDetail.provider}</span>
                          <span>{jobDetail.model}</span>
                          <span>{jobDetail.promptVersion}</span>
                          <span>Tạo lúc {formatDateTime(jobDetail.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="qdoc-title-actions">
                      {LIVE_JOB_STATUSES.has(jobDetail.status) && (
                        <button type="button" className="qdoc-secondary-btn qdoc-secondary-btn--danger" onClick={cancelJob}>
                          <StopOutlined />
                          <span>Hủy phiên</span>
                        </button>
                      )}
                      <button type="button" className="qdoc-secondary-btn" onClick={() => loadJob()}>
                        <ReloadOutlined />
                        <span>Tải lại</span>
                      </button>
                    </div>
                  </section>

                  <section className="qdoc-metric-grid qdoc-metric-grid--wide">
                    <Metric label="Chunks" value={`${formatNumber(jobDetail.completedChunkCount)} / ${formatNumber(jobDetail.chunkCount)}`} />
                    <Metric label="Chunk lỗi" value={formatNumber(jobDetail.failedChunkCount)} />
                    <Metric label="Candidate" value={formatNumber(jobDetail.candidateCount)} />
                    <Metric label="Số câu/chunk" value={formatNumber(jobDetail.questionsPerChunk)} />
                    <Metric label="LLM calls" value={formatNumber(jobDetail.usage?.callCount)} />
                    <Metric label="Total tokens" value={formatNumber(jobDetail.usage?.totalTokens)} />
                    <Metric label="Latency" value={`${formatNumber(jobDetail.usage?.latencyMs)} ms`} />
                    <Metric label="Chi phí" value={`$${Number(jobDetail.usage?.estimatedCostUsd || 0).toFixed(4)}`} />
                  </section>

                  <section className="qdoc-metric-grid qdoc-metric-grid--wide">
                    <Metric label="Độ trễ/chunk" value={`${formatNumber(benchmarkMetrics.latencyPerChunk)} ms`} />
                    <Metric label="Tỷ lệ duyệt" value={formatPercent(benchmarkMetrics.approveRate)} />
                    <Metric label="Tỷ lệ lưu" value={formatPercent(benchmarkMetrics.saveRate)} />
                    <Metric label="Cảnh báo trùng" value={formatPercent(benchmarkMetrics.duplicateWarningRate)} />
                  </section>

                  {LIVE_JOB_STATUSES.has(jobDetail.status) && (
                    <section className="qdoc-alert qdoc-alert--info">
                      <LoadingOutlined />
                      <span>Phiên tạo câu hỏi đang xử lý nền. Trang sẽ tự cập nhật sau vài giây.</span>
                    </section>
                  )}

                  {Number(jobDetail.failedChunkCount) > 0 && (
                    <section className="qdoc-alert qdoc-alert--warning qdoc-alert--action">
                      <div>
                        <WarningOutlined />
                        <span>Một số chunk xử lý lỗi. Bạn có thể retry riêng các chunk lỗi mà không chạy lại toàn bộ tài liệu.</span>
                      </div>
                      <button type="button" className="qdoc-secondary-btn" onClick={retryFailedChunks} disabled={isRetrying}>
                        {isRetrying ? <LoadingOutlined /> : <ReloadOutlined />}
                        <span>Retry chunk lỗi</span>
                      </button>
                    </section>
                  )}

                  <section className="qdoc-panel">
                    <div className="qdoc-section-header">
                      <h2>Knowledge points</h2>
                      <span>{formatNumber(jobDetail.knowledgePoints?.length || 0)} mục</span>
                    </div>
                    <div className="qdoc-table-scroll">
                      <table className="qdoc-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Loại</th>
                            <th>Mức quan trọng</th>
                            <th>Statement</th>
                            <th>Nguồn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(jobDetail.knowledgePoints || []).length === 0 ? (
                            <tr>
                              <td colSpan="5" className="qdoc-empty-cell">Không có knowledge point đủ điều kiện từ các chunk đã xử lý.</td>
                            </tr>
                          ) : (
                            jobDetail.knowledgePoints.map((point) => (
                              <tr key={point.id}>
                                <td>{point.sourceKey || '---'}</td>
                                <td>{point.knowledgeType || '---'}</td>
                                <td>{point.importance || '---'}</td>
                                <td>{point.statement}</td>
                                <td className="qdoc-preview-cell">{point.sourceExcerpt}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="qdoc-filter-bar">
                    <div className="qdoc-search">
                      <SearchOutlined className="qdoc-search-icon" />
                      <input
                        type="text"
                        placeholder="Tìm theo nội dung câu hỏi..."
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                      />
                    </div>
                    <select className="qdoc-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="">Tất cả trạng thái</option>
                      <option value="GOOD">Đạt</option>
                      <option value="NEED_REVIEW">Cần xem xét</option>
                      <option value="REJECTED">Đã từ chối</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="SAVED">Đã lưu</option>
                    </select>
                    <select className="qdoc-select" value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
                      <option value="">Tất cả độ khó</option>
                      <option value="easy">Dễ</option>
                      <option value="medium">Trung bình</option>
                      <option value="hard">Khó</option>
                    </select>
                  </section>

                  {filteredCandidates.length > 0 && (
                    <section className="qdoc-batch-bar">
                      <label className="qdoc-checkline">
                        <input
                          type="checkbox"
                          checked={filteredCandidates.every((candidate) => selectedCandidateIds.includes(candidate.id))}
                          onChange={toggleFilteredSelection}
                        />
                        <span>Chọn tất cả trong bộ lọc</span>
                      </label>
                      <strong>{formatNumber(selectedCandidateIds.length)} đã chọn</strong>
                      <button type="button" className="qdoc-secondary-btn qdoc-secondary-btn--success" onClick={approveSelected} disabled={isBatching || selectedApprovableIds.length === 0}>
                        <CheckCircleOutlined />
                        <span>Duyệt</span>
                      </button>
                      <button type="button" className="qdoc-secondary-btn qdoc-secondary-btn--danger" onClick={rejectSelected} disabled={isBatching || selectedRejectableIds.length === 0}>
                        <StopOutlined />
                        <span>Từ chối</span>
                      </button>
                      <button type="button" className="qdoc-primary-btn" onClick={saveSelected} disabled={isBatching || selectedSavableIds.length === 0}>
                        {isBatching ? <LoadingOutlined /> : <SaveOutlined />}
                        <span>Lưu vào ngân hàng</span>
                      </button>
                    </section>
                  )}

                  <section className="qdoc-review-layout">
                    <div className="qdoc-candidate-list">
                      {filteredCandidates.length === 0 ? (
                        <div className="qdoc-panel qdoc-empty-state">Không có câu hỏi đề xuất phù hợp bộ lọc.</div>
                      ) : (
                        filteredCandidates.map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            isSelected={candidate.id === selectedCandidate?.id}
                            isChecked={selectedCandidateIds.includes(candidate.id)}
                            isBusy={candidateActionId === candidate.id}
                            onSelect={() => setSelectedCandidateId(candidate.id)}
                            onToggleSelection={() => toggleCandidateSelection(candidate.id)}
                            onEdit={() => openEditModal(candidate)}
                            onApprove={() => approveCandidate(candidate)}
                            onReject={() => rejectCandidate(candidate)}
                            onSave={() => saveAsQuestion(candidate)}
                            onOpenSavedQuestion={() => navigate(`/admin/evaluation/question-bank/${candidate.savedQuestionId}/edit`)}
                          />
                        ))
                      )}
                    </div>

                    <aside className="qdoc-evidence-panel">
                      <h2>Nguồn đang chọn</h2>
                      {selectedCandidate ? (
                        <>
                          <InfoRow label="Candidate" value={`#${selectedCandidate.id}`} />
                          <InfoRow label="Chunk" value={`#${selectedCandidate.chunkId}`} />
                          <InfoRow label="Topic" value={selectedCandidate.topic || '---'} />
                          <div className="qdoc-evidence-box">
                            {selectedCandidate.sourceExcerpt || 'Chưa có trích dẫn nguồn.'}
                          </div>
                          <Warnings warnings={selectedCandidate.warnings} />
                        </>
                      ) : (
                        <p>Chọn một candidate để xem evidence.</p>
                      )}
                    </aside>
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>

      {editingCandidate && editForm && (
        <div className="qdoc-modal-backdrop">
          <div className="qdoc-modal qdoc-modal--wide" role="dialog" aria-modal="true" aria-labelledby="edit-candidate-title">
            <h2 id="edit-candidate-title">Sửa câu hỏi đề xuất</h2>
            <div className="qdoc-edit-grid">
              <TextAreaField label="Câu hỏi" value={editForm.stem} onChange={(value) => setEditFormField('stem', value)} />
              <TextAreaField label="Phương án A" value={editForm.optionA} onChange={(value) => setEditFormField('optionA', value)} />
              <TextAreaField label="Phương án B" value={editForm.optionB} onChange={(value) => setEditFormField('optionB', value)} />
              <TextAreaField label="Phương án C" value={editForm.optionC} onChange={(value) => setEditFormField('optionC', value)} />
              <TextAreaField label="Phương án D" value={editForm.optionD} onChange={(value) => setEditFormField('optionD', value)} />
              <label className="qdoc-field">
                <span>Đáp án đúng</span>
                <div className="qdoc-segmented">
                  {['A', 'B', 'C', 'D'].map((answer) => (
                    <button
                      key={answer}
                      type="button"
                      className={editForm.correctAnswer === answer ? 'active' : ''}
                      onClick={() => setEditFormField('correctAnswer', answer)}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              </label>
              <label className="qdoc-field">
                <span>Độ khó</span>
                <select value={editForm.difficulty} onChange={(event) => setEditFormField('difficulty', event.target.value)}>
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </label>
              <label className="qdoc-field">
                <span>Chủ đề</span>
                <input value={editForm.topic} onChange={(event) => setEditFormField('topic', event.target.value)} />
              </label>
              <TextAreaField label="Giải thích" value={editForm.explanation} onChange={(value) => setEditFormField('explanation', value)} />
              <TextAreaField label="Trích dẫn nguồn" value={editForm.sourceExcerpt} onChange={(value) => setEditFormField('sourceExcerpt', value)} />
              <TextAreaField label="Ghi chú reviewer" value={editForm.reviewerNotes} onChange={(value) => setEditFormField('reviewerNotes', value)} />
            </div>
            <div className="qdoc-modal-actions">
              <button type="button" className="qdoc-secondary-btn" onClick={() => setEditingCandidate(null)} disabled={candidateActionId === editingCandidate.id}>
                Hủy
              </button>
              <button type="button" className="qdoc-primary-btn" onClick={saveEdit} disabled={candidateActionId === editingCandidate.id}>
                {candidateActionId === editingCandidate.id ? <LoadingOutlined /> : <SaveOutlined />}
                <span>Lưu chỉnh sửa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function setEditFormField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }
}

function CandidateCard({
  candidate,
  isSelected,
  isChecked,
  isBusy,
  onSelect,
  onToggleSelection,
  onEdit,
  onApprove,
  onReject,
  onSave,
  onOpenSavedQuestion,
}) {
  const canEdit = candidate.status !== 'SAVED'
  const canApprove = !['REJECTED', 'APPROVED', 'SAVED'].includes(candidate.status)
  const canReject = !['REJECTED', 'SAVED'].includes(candidate.status)
  const hasStrongDuplicate = Number(candidate.duplicateMaxSimilarity || 0) >= STRONG_DUPLICATE_THRESHOLD
  const canSave = candidate.status === 'APPROVED' && !hasStrongDuplicate

  return (
    <article className={`qdoc-candidate-card ${isSelected ? 'qdoc-candidate-card--active' : ''}`} onClick={onSelect}>
      <header className="qdoc-candidate-header">
        <div className="qdoc-candidate-badges">
          <label className="qdoc-card-check" onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={isChecked} onChange={onToggleSelection} />
          </label>
          <span className={`qdoc-badge qdoc-badge--${statusTone(candidate.status)}`}>{candidateStatusText(candidate)}</span>
          {candidate.label && (
            <span className={`qdoc-badge qdoc-badge--${statusTone(candidate.label)}`}>{candidateLabelText(candidate)}</span>
          )}
          <span className="qdoc-mini-badge">{difficultyText(candidate.difficulty)}</span>
        </div>
        <strong>{Math.round((candidate.qualityScore || 0) * 100)}%</strong>
      </header>

      <h2>{candidate.stem}</h2>
      <div className="qdoc-options">
        {[
          ['A', candidate.optionA],
          ['B', candidate.optionB],
          ['C', candidate.optionC],
          ['D', candidate.optionD],
        ].map(([key, text]) => (
          <div key={key} className={candidate.correctAnswer === key ? 'correct' : ''}>
            <span>{key}</span>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="qdoc-candidate-meta">
        <InfoRow label="Đáp án đúng" value={candidate.correctAnswer} />
        <InfoRow label="Chủ đề" value={candidate.topic || '---'} />
      </div>

      {candidate.explanation && (
        <div className="qdoc-soft-box">
          <strong>Giải thích</strong>
          <p>{candidate.explanation}</p>
        </div>
      )}

      {candidate.sourceExcerpt && (
        <div className="qdoc-source-box">
          <strong>Trích dẫn nguồn</strong>
          <p>{candidate.sourceExcerpt}</p>
        </div>
      )}

      {candidate.duplicateMaxSimilarity >= 0.8 && (
        <div className="qdoc-alert qdoc-alert--warning">
          <WarningOutlined />
          <span>
            Khả năng trùng: {Math.round(candidate.duplicateMaxSimilarity * 100)}% {candidate.duplicateQuestionStemSnapshot || ''}
            {hasStrongDuplicate ? ' Cần chỉnh sửa hoặc từ chối trước khi lưu.' : ''}
          </span>
        </div>
      )}

      <Warnings warnings={candidate.warnings} />

      {candidate.llmValidation && (
        <details className="qdoc-validation-raw">
          <summary>LLM validation</summary>
          <pre>{candidate.llmValidation}</pre>
        </details>
      )}

      {candidate.reviewerNotes && (
        <div className="qdoc-soft-box">
          <strong>Ghi chú reviewer</strong>
          <p>{candidate.reviewerNotes}</p>
        </div>
      )}

      {candidate.savedQuestionId && (
        <div className="qdoc-saved-box">
          <div>
            <strong>Đã lưu vào ngân hàng</strong>
            <p>Câu hỏi #{candidate.savedQuestionId}</p>
          </div>
          <button type="button" className="qdoc-secondary-btn" onClick={stopAnd(onOpenSavedQuestion)}>
            <EyeOutlined />
            <span>Mở câu hỏi</span>
          </button>
        </div>
      )}

      <footer className="qdoc-candidate-actions">
        <button type="button" className="qdoc-secondary-btn" onClick={stopAnd(onEdit)} disabled={!canEdit || isBusy}>
          <EditOutlined />
          <span>Sửa</span>
        </button>
        <button type="button" className="qdoc-secondary-btn qdoc-secondary-btn--success" onClick={stopAnd(onApprove)} disabled={!canApprove || isBusy}>
          <CheckCircleOutlined />
          <span>Duyệt</span>
        </button>
        <button type="button" className="qdoc-secondary-btn qdoc-secondary-btn--danger" onClick={stopAnd(onReject)} disabled={!canReject || isBusy}>
          <StopOutlined />
          <span>Từ chối</span>
        </button>
        <button type="button" className="qdoc-primary-btn" onClick={stopAnd(onSave)} disabled={!canSave || isBusy}>
          {isBusy ? <LoadingOutlined /> : <SaveOutlined />}
          <span>Lưu vào ngân hàng câu hỏi</span>
        </button>
      </footer>
    </article>
  )

  function stopAnd(callback) {
    return (event) => {
      event.stopPropagation()
      callback()
    }
  }
}

function Warnings({ warnings }) {
  const items = parseJsonList(warnings)
  if (!items.length) return null
  return (
    <div className="qdoc-warning-list">
      {items.map((warning, index) => (
        <span key={`${warning}-${index}`}>
          <WarningOutlined />
          {warning}
        </span>
      ))}
    </div>
  )
}

function TextAreaField({ label, value, onChange }) {
  return (
    <label className="qdoc-field qdoc-field--textarea">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="qdoc-info-row">
      <span>{label}</span>
      <strong>{value || '---'}</strong>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="qdoc-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

function FileBadge() {
  return <div className="qdoc-file-badge">AI</div>
}

export default DocumentQuestionJobReviewPage
