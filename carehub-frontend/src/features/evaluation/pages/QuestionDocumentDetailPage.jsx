import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../api/documentQuestionApi.js'
import {
  apiData,
  apiErrorMessage,
  chunkGenerationEligible,
  chunkGenerationText,
  documentStatusText,
  formatDateTime,
  formatNumber,
  jobStatusText,
  qualityFlagsText,
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

  const sortedSections = useMemo(() => {
    return [...(documentDetail?.sections || [])].sort((left, right) => left.orderIndex - right.orderIndex)
  }, [documentDetail])
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
                      onClick={() => setShowJobModal(true)}
                    >
                      <PlayCircleOutlined />
                      <span>Tạo câu hỏi</span>
                    </button>
                  </section>

                  {documentDetail.status === 'OCR_REQUIRED' && (
                    <section className="qdoc-alert qdoc-alert--warning">
                      <WarningOutlined />
                      <span>Tài liệu cần OCR trước khi tạo câu hỏi. Hệ thống chưa sinh câu hỏi từ PDF scan trong MVP.</span>
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
                              <th>Số chunk</th>
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
              <InfoRow label="Tổng chunk" value={formatNumber(chunks.length)} />
              <InfoRow label="Có thể tạo" value={formatNumber(eligibleChunkCount)} />
              <InfoRow label="Bỏ qua" value={formatNumber(skippedChunkCount)} />
            </div>
            <label className="qdoc-field">
              <span>Số câu mỗi chunk</span>
              <input
                type="number"
                min="1"
                max="5"
                value={questionsPerChunk}
                onChange={(event) => setQuestionsPerChunk(event.target.value)}
              />
            </label>
            <div className="qdoc-note">
              Phiên tạo câu hỏi sẽ xử lý từng chunk riêng để giữ evidence và có thể retry phần lỗi.
              Nên bắt đầu 1 câu/chunk để kiểm soát chất lượng và tốc độ.
            </div>
            <div className="qdoc-modal-actions">
              <button type="button" className="qdoc-secondary-btn" onClick={() => setShowJobModal(false)} disabled={isCreatingJob}>
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

function pageRange(start, end) {
  if (!start && !end) return '---'
  if (start && end && start !== end) return `${start}-${end}`
  return String(start || end)
}

export default QuestionDocumentDetailPage
