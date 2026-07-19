import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CloseOutlined,
  EyeOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function createJob() {
    const normalizedCount = Math.min(5, Math.max(1, Number(questionsPerChunk) || 1))
    setIsCreatingJob(true)
    try {
      const response = await documentQuestionApi.createQuestionJob(documentDetail.id, {
        questionsPerChunk: normalizedCount,
        categoryId: categoryId ? Number(categoryId) : null,
      })
      const job = apiData(response)
      showToast('Tạo phiên sinh câu hỏi thành công.', 'success')
      navigate(`/admin/evaluation/document-question-jobs/${job.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsCreatingJob(false)
    }
  }

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
        sortOrder: 0,
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
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qdoc-page">
              <button type="button" className="qdoc-back-btn" onClick={() => navigate('/admin/evaluation/question-documents')}>
                <ArrowLeftOutlined />
                <span>Quay lại danh sách</span>
              </button>

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
                          <select className="qdoc-select" value={jobStatusFilter} onChange={(event) => setJobStatusFilter(event.target.value)}>
                            <option value="">Tất cả trạng thái</option>
                            <option value="CREATED">Đã tạo</option>
                            <option value="GENERATING">Đang tạo</option>
                            <option value="GENERATED">Đã tạo xong</option>
                            <option value="PARTIALLY_COMPLETED">Hoàn thành một phần</option>
                            <option value="FAILED">Thất bại</option>
                            <option value="CANCELLED">Đã hủy</option>
                          </select>
                        </div>
                        <div className="qdoc-table-scroll">
                          <table className="qdoc-table">
                          <thead>
                            <tr>
                              <th>Phiên</th>
                              <th>Trạng thái</th>
                              <th>Câu hỏi</th>
                              <th>Tiến độ xử lý</th>
                              <th>Ngày tạo</th>
                              <th>Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredQuestionJobs.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="qdoc-empty-cell">Không có phiên tạo câu hỏi phù hợp.</td>
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
          </main>
        </div>
      </div>

      {showJobModal && documentDetail && (
        <div className="qdoc-modal-backdrop">
          <div className="qdoc-modal" role="dialog" aria-modal="true" aria-labelledby="detail-create-job-title">
            <h2 id="detail-create-job-title">Tạo phiên sinh câu hỏi</h2>
            <p className="qdoc-modal-subtitle">{documentDetail.filename}</p>
            <div className="qdoc-modal-stats">
              <InfoRow label="Tổng đoạn nội dung" value={formatNumber(chunks.length)} />
              <InfoRow label="Đủ điều kiện" value={formatNumber(eligibleChunkCount)} />
              <InfoRow label="Bỏ qua" value={formatNumber(skippedChunkCount)} />
            </div>
            <label className="qdoc-field">
              <span>Số câu mỗi đoạn nội dung</span>
              <input
                type="number"
                min="1"
                max="5"
                value={questionsPerChunk}
                onChange={(event) => setQuestionsPerChunk(event.target.value)}
              />
            </label>
            <div className="qdoc-field">
              <span>Danh mục câu hỏi (không bắt buộc)</span>
              <div className="qdoc-inline-field">
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  disabled={isLoadingCategories || isCreatingJob}
                >
                  <option value="">Không chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
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
              Phiên sẽ xử lý từng đoạn nội dung riêng để giữ nguồn trích dẫn và có thể thử lại phần lỗi.
              Nên bắt đầu với 1 câu mỗi đoạn để kiểm soát chất lượng và tốc độ.
            </div>
            <div className="qdoc-modal-actions">
              <button type="button" className="qdoc-secondary-btn" onClick={closeJobModal} disabled={isCreatingJob}>
                Hủy
              </button>
              <button type="button" className="qdoc-primary-btn" onClick={createJob} disabled={isCreatingJob}>
                {isCreatingJob ? <LoadingOutlined /> : <PlayCircleOutlined />}
                <span>{isCreatingJob ? 'Đang tạo câu hỏi từ tài liệu...' : 'Tạo phiên'}</span>
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

function InfoRow({ label, value }) {
  return (
    <div className="qdoc-info-row">
      <span>{label}</span>
      <strong>{value || '---'}</strong>
    </div>
  )
}

export default QuestionDocumentDetailPage
