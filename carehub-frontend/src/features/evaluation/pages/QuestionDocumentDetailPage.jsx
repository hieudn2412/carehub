import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CloseOutlined,
  EyeOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import FormSelectField from '../../../shared/components/FormSelectField.jsx'
import AdminFilterDisclosure from '../../../shared/components/AdminFilterDisclosure.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../api/documentQuestionApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import {
  apiData,
  apiErrorMessage,
  chunkGenerationEligible,
  documentStatusText,
  formatDateTime,
  formatNumber,
  jobStatusText,
  statusTone,
} from '../utils/documentQuestionUi.js'
import { buildCreateQuestionJobPayload, COGNITIVE_MIX_FIELDS, DEFAULT_COGNITIVE_MIX, cognitiveMixTotal } from '../utils/groundedQuestionUi.js'
import '../styles/QuestionDocumentPages.css'

function QuestionDocumentDetailPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [documentDetail, setDocumentDetail] = useState(null)
  const [questionJobs, setQuestionJobs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showJobModal, setShowJobModal] = useState(false)
  const [questionsPerChunk, setQuestionsPerChunk] = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const targetCognitiveLevel = 'AUTO'
  const [cognitiveMix, setCognitiveMix] = useState(DEFAULT_COGNITIVE_MIX)
  const [categories, setCategories] = useState([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' })
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [jobStatusFilter, setJobStatusFilter] = useState('')

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    try {
      const [documentResponse, jobsResponse] = await Promise.all([
        documentQuestionApi.getDocument(documentId),
        documentQuestionApi.listQuestionJobs(documentId),
      ])
      setDocumentDetail(apiData(documentResponse))
      setQuestionJobs(apiData(jobsResponse, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [documentId, showToast])

  useEffect(() => {

    loadDocument()
  }, [loadDocument])

  const chunks = useMemo(() => documentDetail?.chunks || [], [documentDetail])
  const eligibleChunkCount = useMemo(() => {
    return chunks.filter((chunk) => chunkGenerationEligible(chunk)).length
  }, [chunks])
  const skippedChunkCount = Math.max(0, chunks.length - eligibleChunkCount)
  const filteredQuestionJobs = useMemo(() => {
    return questionJobs.filter((job) => !jobStatusFilter || job.status === jobStatusFilter)
  }, [questionJobs, jobStatusFilter])

  const handleApplyFilters = () => {
    // keep immediate filter behavior
  }

  const handleClearFilters = () => {
    setJobStatusFilter('')
  }

  async function createJob() {
    const rawCount = Number(questionsPerChunk) || 1
    if (rawCount > 3 || rawCount < 1) {
      showToast('Số câu mỗi đoạn nội dung chỉ được từ 1 đến 3.', 'warning')
      return
    }
    if (mixTotal !== 100) {
      showToast('Tổng tỷ lệ ba mức nhận thức phải bằng 100%.', 'warning')
      return
    }
    setIsCreatingJob(true)
    try {
      const response = await documentQuestionApi.createQuestionJob(documentDetail.id, buildCreateQuestionJobPayload({
        questionsPerChunk,
        categoryId,
        targetCognitiveLevel,
        cognitiveMix,
      }))
      const job = apiData(response)
      showToast('Tạo câu hỏi từ tài liệu thành công.', 'success')
      navigate(`/admin/evaluation/document-question-jobs/${job.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsCreatingJob(false)
    }
  }

  const mixTotal = cognitiveMixTotal(cognitiveMix)

  async function openJobModal() {
    setShowJobModal(true)
    setShowCategoryModal(false)
    setIsLoadingCategories(true)
    try {
      const response = await questionCategoryApi.listCategories({ status: 'ACTIVE' })
      setCategories(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoadingCategories(false)
    }
  }

  function closeJobModal() {
    if (isCreatingJob) return
    setShowJobModal(false)
    setShowCategoryModal(false)
  }

  async function createCategoryInline(event) {
    event.preventDefault()
    const name = categoryForm.name.trim()
    if (!name) {
      showToast('Tên danh mục không được để trống.', 'warning')
      return
    }
    setIsCreatingCategory(true)
    try {
      const response = await questionCategoryApi.createCategory({
        name,
        code: categoryForm.code.trim() || null,
        description: categoryForm.description.trim() || null,
        status: 'ACTIVE',
      })
      const createdCategory = apiData(response)
      if (createdCategory) {
        setCategories((current) => [...current, createdCategory].sort((left, right) => left.name.localeCompare(right.name, 'vi')))
        setCategoryId(String(createdCategory.id))
      }
      setCategoryForm({ name: '', code: '', description: '' })
      setShowCategoryModal(false)
      showToast('Đã thêm danh mục câu hỏi.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsCreatingCategory(false)
    }
  }

  function canCreateJob() {
    return documentDetail?.status === 'READY' && eligibleChunkCount > 0
  }

  const breadcrumbs = [
    { label: 'Đánh giá' },
    { label: 'Tạo câu hỏi từ tài liệu', link: '/admin/evaluation/question-documents' },
    { label: 'Chi tiết tài liệu' },
  ]

  return (
    <AppShell
      className="dashboard-layout"
      back={{ to: '/admin/evaluation/question-documents', label: 'Quay lại' }}
      breadcrumbs={breadcrumbs}
    >
      <div className="qdoc-page">
              {isLoading ? (
                <section className="qdoc-panel qdoc-loading-panel">Đang tải chi tiết tài liệu...</section>
              ) : !documentDetail ? (
                <section className="qdoc-panel qdoc-loading-panel">Không tìm thấy tài liệu.</section>
              ) : (
                <>
                  <section className="qdoc-detail-hero">
                    <div className="qdoc-detail-heading">
                      <FileSearchOutlined />
                      <div>
                        <h1>{documentDetail.filename}</h1>
                        <div className="qdoc-detail-meta">
                          <span className={`qdoc-badge qdoc-badge--${statusTone(documentDetail.status)}`}>
                            {documentStatusText(documentDetail)}
                          </span>
                          <span>{documentDetail.contentType || 'Không rõ loại tệp'}</span>
                          <span>Tải lúc {formatDateTime(documentDetail.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="qdoc-primary-btn"
                      disabled={!canCreateJob()}
                      onClick={openJobModal}
                    >
                      <PlayCircleOutlined />
                      <span>Tạo câu hỏi</span>
                    </button>
                  </section>

                  {documentDetail.status === 'OCR_REQUIRED' && (
                    <section className="qdoc-alert qdoc-alert--warning">
                      <WarningOutlined />
                      <span>Tài liệu cần OCR trước khi tạo câu hỏi. Hệ thống chưa hỗ trợ sinh câu hỏi từ PDF scan trong phiên bản hiện tại.</span>
                    </section>
                  )}

                  {documentDetail.errorMessage && (
                    <section className="qdoc-alert qdoc-alert--danger">
                      <WarningOutlined />
                      <span>{documentDetail.errorMessage}</span>
                    </section>
                  )}

                  <section className="qdoc-metric-grid">
                    <Metric label="Số trang" value={formatNumber(documentDetail.pageCount)} />
                    <Metric label="Câu hỏi đã tạo" value={formatNumber(questionJobs.reduce((sum, job) => sum + (job.candidateCount || 0), 0))} />
                    <Metric label="Số phiên" value={formatNumber(questionJobs.length)} />
                  </section>

                  <section className="qdoc-tabs-card">
                    <div className="qdoc-tabs">
                      <button className={activeTab === 'overview' ? 'active' : ''} type="button" onClick={() => setActiveTab('overview')}>Tổng quan</button>
                      <button className={activeTab === 'jobs' ? 'active' : ''} type="button" onClick={() => setActiveTab('jobs')}>Phiên tạo câu hỏi</button>
                    </div>

                    {activeTab === 'overview' && (
                      <div className="qdoc-tab-body">
                        <div className="qdoc-overview-grid">
                          <InfoRow label="Tên tài liệu" value={documentDetail.filename} />
                          <InfoRow label="Trạng thái" value={documentStatusText(documentDetail)} />
                          <InfoRow label="Loại tệp" value={documentDetail.contentType || 'Không rõ'} />
                          <InfoRow label="Ngày cập nhật" value={formatDateTime(documentDetail.updatedAt)} />
                        </div>
                      </div>
                    )}

                    {activeTab === 'jobs' && (
                      <div className="qdoc-tab-body">
                        <div className="qdoc-filter-bar qdoc-filter-bar--compact">
                          <AdminFilterDisclosure activeCount={jobStatusFilter ? 1 : 0}>
                            <FilterSelectField
                              label="Trạng thái phiên"
                              value={jobStatusFilter}
                              onChange={(value) => setJobStatusFilter(value)}
                              options={[
                                { value: '', label: 'Tất cả trạng thái' },
                                { value: 'CREATED', label: 'Đã tạo' },
                                { value: 'GENERATING', label: 'Đang tạo' },
                                { value: 'GENERATED', label: 'Đã tạo xong' },
                                { value: 'PARTIALLY_COMPLETED', label: 'Hoàn thành một phần' },
                                { value: 'FAILED', label: 'Thất bại' },
                                { value: 'CANCELLED', label: 'Đã hủy' },
                              ]}
                              placeholder="Tất cả trạng thái"
                            />
                            <FilterActionButtons onApply={handleApplyFilters} onReset={handleClearFilters} />
                          </AdminFilterDisclosure>
                        </div>
                        <div className="qdoc-table-scroll">
                          <table className="qdoc-table">
                          <thead>
                            <tr>
                              <th>Phiên</th>
                              <th>Trạng thái</th>
                              <th>Pipeline / prompt</th>
                              <th>Câu hỏi</th>
                              <th>Tiến độ xử lý</th>
                              <th>Ngày tạo</th>
                              <th>Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredQuestionJobs.length === 0 ? (
                              <tr>
                                <td colSpan="7" className="qdoc-empty-cell">Không có phiên tạo câu hỏi phù hợp.</td>
                              </tr>
                            ) : (
                              filteredQuestionJobs.map((job) => (
                                <tr key={job.id}>
                                  <td>#{job.id}</td>
                                  <td>
                                    <span className={`qdoc-badge qdoc-badge--${statusTone(job.status)}`}>
                                      {jobStatusText(job)}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="qdoc-mini-badge">{job.pipelineVersion || 'LEGACY_V3'}</span>
                                    <small className="qdoc-cell-note">{job.promptVersion || '---'}</small>
                                  </td>
                                  <td>{formatNumber(job.candidateCount)}</td>
                                  <td>
                                    {formatNumber(job.completedChunkCount)} / {formatNumber(job.chunkCount)}
                                    {Number(job.failedChunkCount) > 0 && (
                                      <span className="qdoc-mini-badge qdoc-mini-badge--warning">
                                        Lỗi {formatNumber(job.failedChunkCount)}
                                      </span>
                                    )}
                                  </td>
                                  <td>{formatDateTime(job.createdAt)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="qdoc-icon-btn qdoc-icon-btn--primary"
                                      title="Mở review"
                                      onClick={() => navigate(`/admin/evaluation/document-question-jobs/${job.id}`)}
                                    >
                                      <EyeOutlined />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
      </div>

      {showJobModal && documentDetail && (
        <div className="qdoc-modal-backdrop">
          <div className="qdoc-modal" role="dialog" aria-modal="true" aria-labelledby="detail-create-job-title">
            <h2 id="detail-create-job-title">Tạo câu hỏi từ tài liệu</h2>
            <p className="qdoc-modal-subtitle">{documentDetail.filename}</p>
            <div className="qdoc-modal-stats">
              <InfoRow label="Tổng đoạn nội dung" value={formatNumber(chunks.length)} />
              <InfoRow label="Đủ điều kiện" value={formatNumber(eligibleChunkCount)} />
              <InfoRow label="Bỏ qua" value={formatNumber(skippedChunkCount)} />
            </div>
            <label className="qdoc-field">
              <span>Tối đa câu hỏi mỗi đoạn</span>
              <input
                type="number"
                min="1"
                max="3"
                value={questionsPerChunk}
                onChange={(event) => setQuestionsPerChunk(event.target.value)}
              />
              <small className="qdoc-field-help">Tối đa 3 câu/đoạn — vượt quá dễ khiến AI trả lời bị cắt dở và sinh câu thất bại.</small>
            </label>
            <div className="qdoc-field">
              <span>Tỷ lệ mức độ nhận thức (%)</span>
              <div className="qdoc-mix-grid">
                {COGNITIVE_MIX_FIELDS.map((field) => (
                  <label key={field.key} className="qdoc-mix-item">
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="ch-input"
                      value={cognitiveMix[field.key]}
                      disabled={isCreatingJob}
                      onFocus={(event) => event.target.select()}
                      onClick={(event) => event.currentTarget.select()}
                      onChange={(event) => {
                        const raw = event.target.value
                        const parsed = Number.parseInt(raw, 10)
                        const normalized = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed))
                        if (raw !== '' && raw !== String(normalized)) event.target.value = String(normalized)
                        setCognitiveMix((current) => ({ ...current, [field.key]: raw === '' ? 0 : normalized }))
                      }}
                      aria-label={`Tỷ lệ mức ${field.label}`}
                    />
                  </label>
                ))}
              </div>
              <small className={`qdoc-field-help ${mixTotal === 100 ? '' : 'qdoc-field-help--error'}`}>
                Tổng: {mixTotal}% {mixTotal === 100 ? '' : '— phải bằng 100%'}
              </small>
            </div>
            <div className="qdoc-field">
              <span>Danh mục câu hỏi (không bắt buộc)</span>
              <div className="qdoc-inline-field">
                <FormSelectField
                  value={categoryId}
                  onChange={setCategoryId}
                  disabled={isLoadingCategories || isCreatingJob}
                  options={[
                    { value: '', label: 'Không chọn danh mục' },
                    ...categories.map((category) => ({ value: String(category.id), label: category.name }))
                  ]}
                />
                <button
                  type="button"
                  className="qdoc-secondary-btn qdoc-inline-add-btn"
                  onClick={() => setShowCategoryModal(true)}
                  disabled={isCreatingJob}
                >
                  <PlusOutlined />
                  <span>Thêm mới</span>
                </button>
              </div>
              {isLoadingCategories && <small className="qdoc-field-help">Đang tải danh mục câu hỏi...</small>}
              <small className="qdoc-field-help">Nếu chọn danh mục, các câu hỏi được duyệt từ phiên này sẽ được gắn theo chủ đề đó.</small>
            </div>
            <div className="qdoc-note">
              AI sẽ đọc riêng từng câu để chọn lĩnh vực chuyên môn từ danh sách đang có trong hệ thống và gán một
              trong 3 mức nhận thức. Reviewer vẫn cần kiểm tra, bổ sung danh mục hoặc chỉnh lại phân loại trước khi duyệt.
              Phiên xử lý từng đoạn nội dung riêng để giữ nguồn trích dẫn và có thể thử lại phần lỗi.
            </div>
            <div className="qdoc-modal-actions">
              <button type="button" className="qdoc-secondary-btn" onClick={closeJobModal} disabled={isCreatingJob}>
                Hủy
              </button>
              <button type="button" className="qdoc-primary-btn" onClick={createJob} disabled={isCreatingJob}>
                {isCreatingJob ? <LoadingOutlined /> : <PlayCircleOutlined />}
                <span>{isCreatingJob ? 'Đang tạo câu hỏi từ tài liệu...' : 'Tạo câu hỏi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {showCategoryModal && (
        <div className="qdoc-modal-backdrop qdoc-modal-backdrop--front">
          <form className="qdoc-modal qdoc-modal--category" role="dialog" aria-modal="true" onSubmit={createCategoryInline}>
            <div className="qdoc-modal-heading-row">
              <div>
                <h2>Thêm danh mục câu hỏi</h2>
                <p className="qdoc-modal-subtitle">Danh mục mới sẽ được chọn ngay cho phiên đang tạo.</p>
              </div>
              <button type="button" className="qdoc-icon-btn" aria-label="Đóng" onClick={() => setShowCategoryModal(false)} disabled={isCreatingCategory}>
                <CloseOutlined />
              </button>
            </div>
            <label className="qdoc-field">
              <span>Tên danh mục</span>
              <input autoFocus value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Kiểm soát nhiễm khuẩn" />
            </label>
            <label className="qdoc-field">
              <span>Mã danh mục (không bắt buộc)</span>
              <input value={categoryForm.code} onChange={(event) => setCategoryForm((current) => ({ ...current, code: event.target.value }))} placeholder="Tự sinh nếu bỏ trống" />
            </label>
            <label className="qdoc-field">
              <span>Mô tả (không bắt buộc)</span>
              <textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả ngắn về chủ đề câu hỏi" />
            </label>
            <div className="qdoc-modal-actions">
              <button type="button" className="qdoc-secondary-btn" onClick={() => setShowCategoryModal(false)} disabled={isCreatingCategory}>Hủy</button>
              <button type="submit" className="qdoc-primary-btn" disabled={isCreatingCategory}>
                {isCreatingCategory ? <LoadingOutlined /> : <PlusOutlined />}
                <span>{isCreatingCategory ? 'Đang lưu...' : 'Thêm danh mục'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
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

function InfoRow({ label, value }) {
  return (
    <div className="qdoc-info-row">
      <span>{label}</span>
      <strong>{value || '---'}</strong>
    </div>
  )
}

export default QuestionDocumentDetailPage
