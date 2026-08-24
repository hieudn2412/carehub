import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EditOutlined,
  EyeOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import FormSelectField from '../../../shared/components/FormSelectField.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../api/documentQuestionApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import {
  apiData,
  apiErrorMessage,
  candidateStatusText,
  cognitiveLevelText,
  COGNITIVE_LEVELS,
  formatDateTime,
  formatNumber,
  jobStatusText,
  normalizeText,
  statusTone,
} from '../utils/documentQuestionUi.js'
import {
  formatSimilarity,
  hasPotentialDuplicate,
  hasStrongDuplicate,
} from '../utils/duplicateQuestionUi.js'
import '../styles/QuestionDocumentPages.css'

const LIVE_JOB_STATUSES = new Set(['CREATED', 'GENERATING'])

function DocumentQuestionJobReviewPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [jobDetail, setJobDetail] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState(false)
  const [candidateActionId, setCandidateActionId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [professionalFieldFilter, setProfessionalFieldFilter] = useState('')
  const [cognitiveLevelFilter, setCognitiveLevelFilter] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([])
  const [isBatching, setIsBatching] = useState(false)
  const [categories, setCategories] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false)
  const [duplicateReview, setDuplicateReview] = useState(null)

  const loadJob = useCallback(async (options = {}) => {
    const silent = options?.silent === true
    if (!silent) {
      setIsLoading(true)
    }
    try {
      const response = await documentQuestionApi.getQuestionJob(jobId)
      setJobDetail(apiData(response))
      setLoadError('')
    } catch (error) {
      setLoadError(apiErrorMessage(error))
      showToast(apiErrorMessage(error), 'error')
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [jobId, showToast])

  useEffect(() => {

    loadJob()
  }, [loadJob])

  useEffect(() => {
    async function loadTaxonomy() {
      try {
        const [categoryResponse, optionsResponse] = await Promise.all([
          questionCategoryApi.listCategories({ status: 'ACTIVE' }),
          trainingApi.getRecordOptions(),
        ])
        setCategories(apiData(categoryResponse, []))
        setProfessionalFields(apiData(optionsResponse, {}).professionalFields || [])
      } catch {
        // ignore
      }
    }
    loadTaxonomy()
  }, [])

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
      const matchesProfessionalField = !professionalFieldFilter
        || String(candidate.professionalFieldId || '') === professionalFieldFilter
      const matchesCognitiveLevel = !cognitiveLevelFilter
        || normalizeText(candidate.cognitiveLevel) === normalizeText(cognitiveLevelFilter)
      return matchesKeyword && matchesStatus && matchesProfessionalField && matchesCognitiveLevel
    })
  }, [candidates, keyword, statusFilter, professionalFieldFilter, cognitiveLevelFilter])
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) || filteredCandidates[0]
  const selectedCandidates = candidates.filter((candidate) => selectedCandidateIds.includes(candidate.id))
  const selectedRejectableIds = selectedCandidates
    .filter((candidate) => !['REJECTED', 'SAVED'].includes(candidate.status))
    .map((candidate) => candidate.id)
  // Duyệt và lưu đã gộp làm một nên lưu được thẳng, chỉ trừ câu đã từ chối / đã lưu.
  const selectedSavableIds = selectedCandidates
    .filter((candidate) => !['REJECTED', 'SAVED'].includes(candidate.status) && !hasStrongDuplicate(candidate))
    .map((candidate) => candidate.id)
  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleClearFilters = () => {
    setKeyword('')
    setStatusFilter('')
    setProfessionalFieldFilter('')
    setCognitiveLevelFilter('')
  }
  const activeFilterCount = [statusFilter, professionalFieldFilter, cognitiveLevelFilter].filter(Boolean).length

  const canRetryNoNewQuestions = jobDetail?.status === 'PARTIALLY_COMPLETED'
    && Number(jobDetail?.candidateCount || 0) === 0
    && jobDetail?.errorMessage?.includes('không có câu hỏi mới')
  const candidatesMissingTaxonomy = candidates.filter((candidate) => (
    !candidate.categoryId || !candidate.professionalFieldId || !candidate.cognitiveLevel
  ))

  async function retryFailedChunks() {
    setIsRetrying(true)
    try {
      const response = await documentQuestionApi.retryFailedChunks(jobId)
      setJobDetail(apiData(response))
      showToast(canRetryNoNewQuestions ? 'Đã chạy lại toàn bộ đoạn nội dung.' : 'Thử lại các phần xử lý lỗi thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsRetrying(false)
    }
  }

  async function cancelJob() {
    setIsCancelConfirmOpen(true)
  }

  async function confirmCancelJob() {
    setIsCancelConfirmOpen(false)
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
      showToast('Không có câu hỏi phù hợp để thao tác hàng loạt.', 'warning')
      return
    }
    setIsBatching(true)
    try {
      const response = await action(candidateIds, reviewerNotes)
      const result = apiData(response, {})
      replaceCandidates(result.candidates || [])
      setSelectedCandidateIds((current) => current.filter((id) => !(result.succeededCandidateIds || []).includes(id)))
      if (Number(result.failedCount || 0) > 0) {
        const reasons = (result.errors || [])
          .map((err) => `- Câu #${err.candidateId}: ${err.message}`)
          .join('\n')
        showToast(`${successMessage}. ${result.failedCount} câu lỗi:\n${reasons}`, 'warning', 8000)
      } else {
        showToast(successMessage, 'success')
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsBatching(false)
    }
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
      topic: candidate.topic || '',
      categoryId: candidate.categoryId ? String(candidate.categoryId) : '',
      professionalFieldId: candidate.professionalFieldId ? String(candidate.professionalFieldId) : '',
      cognitiveLevel: candidate.cognitiveLevel || '',
      sourceExcerpt: candidate.sourceExcerpt || '',
      reviewerNotes: candidate.reviewerNotes || '',
    })
  }

  async function saveEdit() {
    if (!editingCandidate || !editForm) return
    const requiredFields = ['stem', 'optionA', 'optionB', 'optionC', 'optionD']
    if (requiredFields.some((field) => !editForm[field]?.trim())
      || !editForm.categoryId
      || !editForm.professionalFieldId
      || !editForm.cognitiveLevel) {
      showToast('Vui lòng nhập đầy đủ câu hỏi và 4 đáp án.', 'warning')
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

  async function openPotentialDuplicates(candidate) {
    setDuplicateReview({
      candidate,
      matches: [],
      isLoading: true,
      error: '',
    })
    try {
      const response = await documentQuestionApi.getPotentialDuplicates(candidate.id)
      setDuplicateReview({
        candidate,
        matches: apiData(response, []),
        isLoading: false,
        error: '',
      })
    } catch (error) {
      setDuplicateReview({
        candidate,
        matches: [],
        isLoading: false,
        error: apiErrorMessage(error),
      })
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
    <AppShell
      className="dashboard-layout"
      back={{ onClick: () => navigate(-1), label: 'Quay lại' }}
      breadcrumbs={breadcrumbs}
    >
      <div className="qdoc-page">
              {isLoading ? (
                <section className="qdoc-panel qdoc-loading-panel">Đang tải phiên tạo câu hỏi...</section>
              ) : !jobDetail ? (
                <section className="qdoc-panel qdoc-loading-panel">
                  <p>{loadError || 'Không tìm thấy phiên tạo câu hỏi.'}</p>
                  <button type="button" className="qdoc-primary-btn" onClick={() => loadJob()}>
                    <ReloadOutlined />
                    <span>Thử tải lại</span>
                  </button>
                </section>
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
                    </div>
                  </section>

                  <section className="qdoc-metric-grid">
                    <Metric label="Chờ duyệt" value={formatNumber(candidates.filter(c => c.status === 'VALIDATED' || c.status === 'NEED_REVIEW').length)} />
                    <Metric label="Đã duyệt" value={formatNumber(candidates.filter(c => c.status === 'APPROVED' || c.status === 'SAVED').length)} />
                    <Metric label="Đã lưu vào ngân hàng" value={formatNumber(candidates.filter(c => c.status === 'SAVED').length)} />
                  </section>

                  {LIVE_JOB_STATUSES.has(jobDetail.status) && (
                    <section className="qdoc-alert qdoc-alert--info">
                      <LoadingOutlined />
                      <span>Phiên tạo câu hỏi đang xử lý nền. Trang sẽ tự cập nhật sau vài giây.</span>
                    </section>
                  )}

                  {jobDetail.errorMessage && jobDetail.errorMessage !== 'Có câu hỏi để duyệt nhưng vẫn còn chunk lỗi hoặc không tạo được đầu ra' && (
                    <section className={`qdoc-alert ${jobDetail.status === 'FAILED' ? 'qdoc-alert--danger' : 'qdoc-alert--warning'}`}>
                      <WarningOutlined />
                      <span>{jobDetail.errorMessage}</span>
                    </section>
                  )}

                  {canRetryNoNewQuestions && (
                    <section className="qdoc-alert qdoc-alert--info qdoc-alert--action">
                      <div>
                        <ReloadOutlined />
                        <span>Phiên trước chưa tạo được câu hỏi mới. Bạn có thể chạy lại để thử với cấu hình hiện tại.</span>
                      </div>
                      <button type="button" className="qdoc-secondary-btn" onClick={retryFailedChunks} disabled={isRetrying}>
                        {isRetrying ? <LoadingOutlined /> : <ReloadOutlined />}
                        <span>{isRetrying ? 'Đang chạy lại...' : 'Chạy lại toàn bộ đoạn'}</span>
                      </button>
                    </section>
                  )}

                  {candidatesMissingTaxonomy.length > 0 && (
                    <section className="qdoc-alert qdoc-alert--warning">
                      <WarningOutlined />
                      <span>
                        {formatNumber(candidatesMissingTaxonomy.length)} câu chưa đủ danh mục, lĩnh vực chuyên môn hoặc mức độ nhận thức.
                        Hãy mở từng câu để bổ sung trước khi duyệt.
                      </span>
                    </section>
                  )}

                  <AppliedFilterToolbar
                    activeCount={activeFilterCount}
                    ariaLabel="Tìm kiếm và lọc câu hỏi đề xuất"
                    className="qdoc-review-toolbar"
                    isOpen={isFilterOpen}
                    onApply={handleApplyFilters}
                    onReset={handleClearFilters}
                    onSearchChange={setKeyword}
                    onToggle={() => setIsFilterOpen((current) => !current)}
                    panelId="document-question-review-filter-panel"
                    searchAriaLabel="Tìm theo nội dung câu hỏi"
                    searchPlaceholder="Tìm theo nội dung câu hỏi..."
                    searchValue={keyword}
                  >
                      <FilterSelectField
                        label="Trạng thái"
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={[
                          { value: '', label: 'Tất cả trạng thái' },
                          { value: 'GOOD', label: 'Đạt' },
                          { value: 'NEED_REVIEW', label: 'Cần xem xét (nghi trùng)' },
                          { value: 'REJECTED', label: 'Đã từ chối' },
                          { value: 'SAVED', label: 'Đã lưu vào ngân hàng câu hỏi' },
                        ]}
                        placeholder="Tất cả trạng thái"
                      />
                      <FilterSelectField
                        label="Lĩnh vực chuyên môn"
                        value={professionalFieldFilter}
                        onChange={(value) => setProfessionalFieldFilter(value)}
                        options={[
                          { value: '', label: 'Tất cả lĩnh vực chuyên môn' },
                          ...professionalFields.map((field) => ({ value: String(field.id), label: `${field.code} · ${field.name}` }))
                        ]}
                        placeholder="Tất cả lĩnh vực chuyên môn"
                      />
                      <FilterSelectField
                        label="Mức độ nhận thức"
                        value={cognitiveLevelFilter}
                        onChange={(value) => setCognitiveLevelFilter(value)}
                        options={[
                          { value: '', label: 'Tất cả mức độ nhận thức' },
                          ...COGNITIVE_LEVELS
                        ]}
                        placeholder="Tất cả mức độ nhận thức"
                      />
                  </AppliedFilterToolbar>

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
                            onReject={() => rejectCandidate(candidate)}
                            onSave={() => saveAsQuestion(candidate)}
                            onViewDuplicates={() => openPotentialDuplicates(candidate)}
                            onOpenSavedQuestion={() => navigate(`/admin/evaluation/question-bank/${candidate.savedQuestionId}/edit`)}
                          />
                        ))
                      )}
                    </div>
                  </section>
                </>
              )}
      </div>

      {editingCandidate && editForm && (
        <div className="qdoc-modal-backdrop" onClick={() => setEditingCandidate(null)}>
          <div
            className="qdoc-modal qdoc-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-candidate-title"
            onClick={(event) => event.stopPropagation()}
          >
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
                <span>Danh mục kiến thức</span>
                <SearchableSelect
                  value={editForm.categoryId}
                  onChange={(val) => setEditFormField('categoryId', val)}
                  options={[
                    { value: '', label: '-- Chọn danh mục --' },
                    ...categories.map((category) => ({
                      value: String(category.id),
                      label: category.name,
                      searchText: `${category.code || ''} ${category.name}`,
                    })),
                  ]}
                  placeholder="-- Chọn hoặc gõ tìm danh mục --"
                  searchPlaceholder="Nhập mã hoặc tên danh mục..."
                />
              </label>
              <label className="qdoc-field">
                <span>Lĩnh vực chuyên môn</span>
                <SearchableSelect
                  value={editForm.professionalFieldId}
                  onChange={(val) => setEditFormField('professionalFieldId', val)}
                  options={[
                    { value: '', label: '-- Chọn lĩnh vực --' },
                    ...professionalFields.map((field) => ({
                      value: String(field.id),
                      label: `[${field.code}] ${field.name}`,
                      searchText: `${field.code} ${field.name}`,
                    })),
                  ]}
                  placeholder="-- Chọn hoặc gõ tìm lĩnh vực --"
                  searchPlaceholder="Nhập mã hoặc tên lĩnh vực..."
                />
              </label>
              <label className="qdoc-field">
                <span>Mức độ nhận thức</span>
                <FormSelectField
                  value={editForm.cognitiveLevel}
                  onChange={(value) => setEditFormField('cognitiveLevel', value)}
                  options={[
                    { value: '', label: '-- Chọn mức độ --' },
                    ...COGNITIVE_LEVELS
                  ]}
                />
              </label>

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
      {duplicateReview && (
        <div className="qdoc-modal-backdrop qdoc-modal-backdrop--front" onClick={() => setDuplicateReview(null)}>
          <div
            className="qdoc-modal qdoc-modal--wide qdoc-duplicate-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-review-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="qdoc-modal-heading-row">
              <div>
                <h2 id="duplicate-review-title">Các câu có khả năng trùng</h2>
                <p className="qdoc-modal-subtitle">
                  Đối chiếu với câu đề xuất: “{duplicateReview.candidate.stem}”
                </p>
              </div>
              <button
                type="button"
                className="qdoc-secondary-btn"
                onClick={() => setDuplicateReview(null)}
                aria-label="Đóng danh sách câu có khả năng trùng"
              >
                Đóng
              </button>
            </div>

            {duplicateReview.isLoading ? (
              <div className="qdoc-duplicate-state">
                <LoadingOutlined />
                <span>Đang tìm các câu tương đồng...</span>
              </div>
            ) : duplicateReview.error ? (
              <div className="qdoc-duplicate-state qdoc-duplicate-state--error">
                <WarningOutlined />
                <span>{duplicateReview.error}</span>
              </div>
            ) : duplicateReview.matches.length === 0 ? (
              <div className="qdoc-duplicate-state">
                Không còn câu nào đạt ngưỡng nghi vấn trùng ở thời điểm hiện tại.
              </div>
            ) : (
              <div className="qdoc-duplicate-list">
                {duplicateReview.matches.map((match) => (
                  <DuplicateMatchCard key={`${match.sourceType}-${match.sourceId}`} match={match} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={isCancelConfirmOpen}
        title="Hủy phiên tạo câu hỏi?"
        message="Phiên đang chạy sẽ dừng xử lý các đoạn còn lại. Những câu hỏi đã tạo trước đó vẫn được giữ lại để bạn tiếp tục duyệt."
        confirmText="Hủy phiên"
        danger
        onCancel={() => setIsCancelConfirmOpen(false)}
        onConfirm={confirmCancelJob}
      />
    </AppShell>
  )

  function setEditFormField(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }
}



export function CandidateCard({
  candidate,
  isSelected,
  isChecked,
  isBusy,
  onSelect,
  onToggleSelection,
  onEdit,
  onReject,
  onSave,
  onViewDuplicates,
  onOpenSavedQuestion,
}) {
  const canEdit = candidate.status !== 'SAVED'
  const canReject = !['REJECTED', 'SAVED'].includes(candidate.status)
  const isStrongDuplicate = hasStrongDuplicate(candidate)
  const isPotentialDuplicate = hasPotentialDuplicate(candidate)
  const canSave = !['REJECTED', 'SAVED'].includes(candidate.status)
  const statusText = candidateStatusText(candidate)
  const fieldLabel = candidate.professionalFieldCode
    ? `${candidate.professionalFieldCode} · ${candidate.professionalFieldName || 'Lĩnh vực chuyên môn'}`
    : 'Chưa có lĩnh vực chuyên môn'
  const pageRef = candidate.pageStart == null
    ? null
    : (candidate.pageEnd && candidate.pageEnd !== candidate.pageStart
        ? `Trang ${candidate.pageStart}–${candidate.pageEnd}`
        : `Trang ${candidate.pageStart}`)

  return (
    <article className={`qdoc-candidate-card ${isSelected ? 'qdoc-candidate-card--active' : ''}`} onClick={onSelect}>
      <header className="qdoc-candidate-header">
        <div className="qdoc-candidate-badges">
          <label className="qdoc-card-check" onClick={(event) => event.stopPropagation()}>
            <input type="checkbox" checked={isChecked} onChange={onToggleSelection} />
          </label>
          <span className={`qdoc-badge qdoc-badge--${statusTone(candidate.status)}`}>{statusText}</span>
          <span
            className={`qdoc-mini-badge ${candidate.professionalFieldId ? 'qdoc-mini-badge--info' : 'qdoc-mini-badge--warning'}`}
            title={fieldLabel}
          >
            {candidate.professionalFieldCode || 'Chưa có lĩnh vực'}
          </span>
          <span className={`qdoc-mini-badge ${candidate.cognitiveLevel ? '' : 'qdoc-mini-badge--warning'}`}>
            {cognitiveLevelText(candidate.cognitiveLevel)}
          </span>
        </div>
      </header>

      <div className="qdoc-candidate-tags">
        <span className={`qdoc-tag ${candidate.professionalFieldId ? 'qdoc-tag--level' : 'qdoc-tag--warning'}`}>
          Lĩnh vực: {fieldLabel}
        </span>
      </div>

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

      {(candidate.explanation || pageRef) && (
        <div className="qdoc-soft-box">
          <strong>Giải thích</strong>
          <p>
            {candidate.explanation}
            {pageRef && (candidate.explanation ? ` (${pageRef})` : pageRef)}
          </p>
        </div>
      )}

      {isPotentialDuplicate && (
        <div className={`qdoc-duplicate-alert ${isStrongDuplicate ? 'qdoc-duplicate-alert--strong' : ''}`}>
          <div>
            <strong>{isStrongDuplicate ? 'Phát hiện câu trùng mạnh' : 'Có câu nghi vấn trùng'}</strong>
            <p>Mức tương đồng cao nhất: {formatSimilarity(candidate.duplicateMaxSimilarity)}</p>
          </div>
          <button type="button" className="qdoc-secondary-btn" onClick={stopAnd(onViewDuplicates)}>
            <EyeOutlined />
            <span>Xem câu có khả năng trùng</span>
          </button>
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

function DuplicateMatchCard({ match }) {
  const options = [
    ['A', match.optionA],
    ['B', match.optionB],
    ['C', match.optionC],
    ['D', match.optionD],
  ].filter(([, text]) => text)

  return (
    <article className="qdoc-duplicate-card">
      <header>
        <div>
          <span className={`qdoc-badge ${match.strongDuplicate ? 'qdoc-badge--danger' : 'qdoc-badge--warning'}`}>
            {match.strongDuplicate ? 'Trùng mạnh' : 'Nghi vấn trùng'}
          </span>
          <span className="qdoc-mini-badge">
            {match.sourceType === 'QUESTION_BANK' ? `Ngân hàng #${match.sourceId}` : `Câu đề xuất #${match.sourceId}`}
          </span>
        </div>
        <strong>{formatSimilarity(match.similarity)}</strong>
      </header>
      <h3>{match.stem}</h3>
      {options.length > 0 && (
        <div className="qdoc-duplicate-options">
          {options.map(([key, text]) => (
            <p key={key} className={match.correctAnswer === key ? 'correct' : ''}>
              <span>{key}</span>
              {text}
            </p>
          ))}
        </div>
      )}
      <footer>
        <span>{match.sourceDocument || 'Không rõ nguồn'}</span>
      </footer>
    </article>
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

function Metric({ label, value }) {
  return (
    <div className="qdoc-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FileBadge() {
  return <div className="qdoc-file-badge">AI</div>
}

export default DocumentQuestionJobReviewPage
