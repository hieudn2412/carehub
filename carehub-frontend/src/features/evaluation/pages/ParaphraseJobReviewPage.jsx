import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
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
import { questionBankApi } from '../api/questionBankApi.js'
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

function ParaphraseJobReviewPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [jobDetail, setJobDetail] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [candidateActionId, setCandidateActionId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([])
  const [isBatching, setIsBatching] = useState(false)

  const loadJob = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const response = await questionBankApi.getParaphraseJob(jobId)
      setJobDetail(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [jobId, showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadJob()
  }, [loadJob])

  useEffect(() => {
    const status = jobDetail?.status
    if (!status || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
      return undefined
    }
    const timer = window.setInterval(() => {
      loadJob({ silent: true })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [jobDetail?.status, loadJob])

  const candidates = useMemo(() => jobDetail?.candidates || [], [jobDetail])
  const filteredCandidates = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    return candidates.filter((candidate) => {
      const matchesKeyword = !normalizedKeyword || normalizeText(candidate.stem).includes(normalizedKeyword)
      const matchesStatus = !statusFilter || candidate.status === statusFilter || candidate.label === statusFilter
      return matchesKeyword && matchesStatus
    })
  }, [candidates, keyword, statusFilter])
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) || filteredCandidates[0]
  const selectedCandidates = candidates.filter((candidate) => selectedCandidateIds.includes(candidate.id))
  const selectedApprovableIds = selectedCandidates
    .filter((candidate) => !['REJECTED', 'APPROVED', 'SAVED'].includes(candidate.status))
    .map((candidate) => candidate.id)
  const selectedRejectableIds = selectedCandidates
    .filter((candidate) => !['REJECTED', 'SAVED'].includes(candidate.status))
    .map((candidate) => candidate.id)
  const selectedSavableIds = selectedCandidates
    .filter((candidate) => candidate.status === 'APPROVED')
    .map((candidate) => candidate.id)

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
        showToast(`${successMessage}. ${result.failedCount} candidate lỗi.`, 'warning')
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
    await runBatchAction(questionBankApi.approveParaphraseCandidates, selectedApprovableIds, 'Đã duyệt hàng loạt candidate')
  }

  async function rejectSelected() {
    const reviewerNotes = window.prompt('Ghi chú lý do từ chối nếu cần:', '') || ''
    await runBatchAction(questionBankApi.rejectParaphraseCandidates, selectedRejectableIds, 'Đã từ chối hàng loạt candidate', reviewerNotes)
  }

  async function saveSelected() {
    await runBatchAction(
      (candidateIds) => questionBankApi.saveParaphraseCandidatesAsQuestions(candidateIds),
      selectedSavableIds,
      'Đã lưu hàng loạt candidate vào ngân hàng',
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
      correctAnswer: candidate.correctAnswer || jobDetail?.sourceQuestion?.correctAnswer || 'A',
      explanation: candidate.explanation || '',
      difficulty: candidate.difficulty || jobDetail?.sourceQuestion?.difficulty || 'medium',
      topic: candidate.topic || '',
      reviewerNotes: candidate.reviewerNotes || '',
    })
  }

  async function saveEdit() {
    if (!editingCandidate || !editForm) return
    const requiredFields = ['stem', 'optionA', 'optionB', 'optionC', 'optionD']
    if (requiredFields.some((field) => !editForm[field]?.trim())) {
      showToast('Vui lòng nhập đầy đủ câu hỏi và 4 đáp án.', 'warning')
      return
    }
    setCandidateActionId(editingCandidate.id)
    try {
      const response = await questionBankApi.updateParaphraseCandidate(editingCandidate.id, editForm)
      replaceCandidate(apiData(response))
      showToast('Cập nhật và kiểm tra lại candidate thành công.', 'success')
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
      const response = await questionBankApi.approveParaphraseCandidate(candidate.id, candidate.reviewerNotes || '')
      replaceCandidate(apiData(response))
      showToast('Duyệt candidate paraphrase thành công.', 'success')
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
      const response = await questionBankApi.rejectParaphraseCandidate(candidate.id, reviewerNotes)
      replaceCandidate(apiData(response))
      showToast('Từ chối candidate paraphrase thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setCandidateActionId(null)
    }
  }

  async function saveAsQuestion(candidate) {
    setCandidateActionId(candidate.id)
    try {
      const response = await questionBankApi.saveParaphraseCandidateAsQuestion(candidate.id)
      replaceCandidate(apiData(response))
      showToast('Lưu câu paraphrase vào ngân hàng câu hỏi thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setCandidateActionId(null)
    }
  }

  const breadcrumbs = [
    { label: 'Đánh giá' },
    { label: 'Ngân hàng câu hỏi', link: '/admin/evaluation/question-bank' },
    { label: 'Review diễn đạt lại' },
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
                <section className="qdoc-panel qdoc-loading-panel">Đang tải phiên diễn đạt lại...</section>
              ) : !jobDetail ? (
                <section className="qdoc-panel qdoc-loading-panel">Không tìm thấy phiên diễn đạt lại.</section>
              ) : (
                <>
                  <section className="qdoc-detail-hero">
                    <div className="qdoc-detail-heading">
                      <div className="qdoc-file-badge">PQ</div>
                      <div>
                        <h1>Review phiên diễn đạt lại #{jobDetail.id}</h1>
                        <div className="qdoc-detail-meta">
                          <span className={`qdoc-badge qdoc-badge--${statusTone(jobDetail.status)}`}>{jobStatusText(jobDetail)}</span>
                          <span>{jobDetail.provider}</span>
                          <span>{jobDetail.model}</span>
                          <span>Tối đa {jobDetail.requestedCount} biến thể</span>
                          <span>Tạo lúc {formatDateTime(jobDetail.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" className="qdoc-secondary-btn" onClick={() => loadJob()}>
                      <ReloadOutlined />
                      <span>Tải lại</span>
                    </button>
                  </section>

                  {jobDetail.errorMessage && (
                    <section className="qdoc-alert qdoc-alert--danger">
                      <WarningOutlined />
                      <span>{jobDetail.errorMessage}</span>
                    </section>
                  )}

                  <section className="qdoc-metric-grid">
                    <Metric label="Candidate" value={formatNumber(candidates.length)} />
                    <Metric label="Đã duyệt" value={formatNumber(candidates.filter((item) => item.status === 'APPROVED').length)} />
                    <Metric label="Đã lưu" value={formatNumber(candidates.filter((item) => item.status === 'SAVED').length)} />
                    <Metric label="Cần xem xét" value={formatNumber(candidates.filter((item) => item.status === 'NEED_REVIEW').length)} />
                  </section>

                  <section className="qdoc-filter-bar">
                    <div className="qdoc-search">
                      <SearchOutlined className="qdoc-search-icon" />
                      <input
                        type="text"
                        placeholder="Tìm theo nội dung candidate..."
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                      />
                    </div>
                    <select className="qdoc-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="">Tất cả trạng thái</option>
                      <option value="VALIDATED">Đã kiểm tra</option>
                      <option value="NEED_REVIEW">Cần xem xét</option>
                      <option value="REJECTED">Đã từ chối</option>
                      <option value="APPROVED">Đã duyệt</option>
                      <option value="SAVED">Đã lưu</option>
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
                        <div className="qdoc-panel qdoc-empty-state">Không có candidate phù hợp bộ lọc.</div>
                      ) : (
                        filteredCandidates.map((candidate) => (
                          <ParaphraseCandidateCard
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
                          />
                        ))
                      )}
                    </div>

                    <aside className="qdoc-evidence-panel">
                      <h2>Câu hỏi gốc</h2>
                      <SourceQuestion question={jobDetail.sourceQuestion} />
                      {selectedCandidate && (
                        <>
                          <InfoRow label="Candidate đang chọn" value={`#${selectedCandidate.id}`} />
                          <Warnings warnings={selectedCandidate.warnings} />
                        </>
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
          <div className="qdoc-modal qdoc-modal--wide" role="dialog" aria-modal="true" aria-labelledby="edit-paraphrase-title">
            <h2 id="edit-paraphrase-title">Sửa candidate diễn đạt lại</h2>
            <div className="qdoc-edit-grid">
              <TextAreaField label="Câu hỏi" value={editForm.stem} onChange={(value) => setEditFormField('stem', value)} />
              <TextAreaField label="Phương án A" value={editForm.optionA} onChange={(value) => setEditFormField('optionA', value)} />
              <TextAreaField label="Phương án B" value={editForm.optionB} onChange={(value) => setEditFormField('optionB', value)} />
              <TextAreaField label="Phương án C" value={editForm.optionC} onChange={(value) => setEditFormField('optionC', value)} />
              <TextAreaField label="Phương án D" value={editForm.optionD} onChange={(value) => setEditFormField('optionD', value)} />
              <label className="qdoc-field">
                <span>Đáp án đúng</span>
                <input value={editForm.correctAnswer} readOnly />
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

function ParaphraseCandidateCard({
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
}) {
  const canEdit = candidate.status !== 'SAVED'
  const canApprove = !['REJECTED', 'APPROVED', 'SAVED'].includes(candidate.status)
  const canReject = !['REJECTED', 'SAVED'].includes(candidate.status)
  const canSave = candidate.status === 'APPROVED'

  return (
    <article className={`qdoc-candidate-card ${isSelected ? 'qdoc-candidate-card--active' : ''}`} onClick={onSelect}>
      <header className="qdoc-candidate-header">
        <div className="qdoc-candidate-badges">
          <label className="qdoc-card-check" onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={isChecked} onChange={onToggleSelection} />
          </label>
          <span className={`qdoc-badge qdoc-badge--${statusTone(candidate.status)}`}>{candidateStatusText(candidate)}</span>
          {candidate.label && <span className={`qdoc-badge qdoc-badge--${statusTone(candidate.label)}`}>{candidateLabelText(candidate)}</span>}
          <span className="qdoc-mini-badge">{difficultyText(candidate.difficulty)}</span>
        </div>
      </header>

      <h2>{candidate.stem}</h2>
      <Options candidate={candidate} />

      <div className="qdoc-candidate-meta">
        <InfoRow label="Đáp án đúng" value={candidate.correctAnswer} />
        <InfoRow label="Chủ đề" value={candidate.topic || '---'} />
        <InfoRow label="Tương đồng câu gốc" value={candidate.semanticSimilarityToSource == null ? '---' : `${Math.round(candidate.semanticSimilarityToSource * 100)}%`} />
        <InfoRow label="Khác biệt từ khóa" value={candidate.lexicalDifferenceFromSource == null ? '---' : `${Math.round(candidate.lexicalDifferenceFromSource * 100)}%`} />
      </div>

      {candidate.explanation && (
        <div className="qdoc-soft-box">
          <strong>Giải thích</strong>
          <p>{candidate.explanation}</p>
        </div>
      )}

      {candidate.duplicateMaxSimilarity >= 0.8 && (
        <div className="qdoc-alert qdoc-alert--warning">
          <WarningOutlined />
          <span>Khả năng trùng: {Math.round(candidate.duplicateMaxSimilarity * 100)}% {candidate.duplicateQuestionStemSnapshot || ''}</span>
        </div>
      )}

      <Warnings warnings={candidate.warnings} />

      {candidate.reviewerNotes && (
        <div className="qdoc-soft-box">
          <strong>Ghi chú reviewer</strong>
          <p>{candidate.reviewerNotes}</p>
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

function SourceQuestion({ question }) {
  if (!question) return <p>Không có dữ liệu câu hỏi gốc.</p>
  return (
    <div className="qdoc-soft-box">
      <strong>{question.stem}</strong>
      <Options candidate={question} />
      <InfoRow label="Đáp án đúng" value={question.correctAnswer} />
      <InfoRow label="Chủ đề" value={question.topic || '---'} />
    </div>
  )
}

function Options({ candidate }) {
  return (
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
  )
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

export default ParaphraseJobReviewPage
