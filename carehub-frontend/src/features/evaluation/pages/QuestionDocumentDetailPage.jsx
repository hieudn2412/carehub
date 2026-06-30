import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
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
  documentStatusText,
  formatDateTime,
  formatNumber,
  qualityFlagsText,
  shortHash,
  statusTone,
} from '../utils/documentQuestionUi.js'
import '../styles/QuestionDocumentPages.css'

function QuestionDocumentDetailPage() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [documentDetail, setDocumentDetail] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showJobModal, setShowJobModal] = useState(false)
  const [questionsPerChunk, setQuestionsPerChunk] = useState(3)
  const [isCreatingJob, setIsCreatingJob] = useState(false)

  const loadDocument = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await documentQuestionApi.getDocument(documentId)
      setDocumentDetail(apiData(response))
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

  async function createJob() {
    const normalizedCount = Math.min(5, Math.max(1, Number(questionsPerChunk) || 3))
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
    return documentDetail?.status === 'READY' && Number(documentDetail?.chunkCount) > 0
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
                    <Metric label="Số chunk" value={formatNumber(documentDetail.chunkCount)} />
                    <Metric label="Section" value={formatNumber(documentDetail.sections?.length || 0)} />
                    <Metric label="Hash" value={shortHash(documentDetail.contentHash)} />
                  </section>

                  <section className="qdoc-tabs-card">
                    <div className="qdoc-tabs">
                      <button className={activeTab === 'overview' ? 'active' : ''} type="button" onClick={() => setActiveTab('overview')}>Tổng quan</button>
                      <button className={activeTab === 'sections' ? 'active' : ''} type="button" onClick={() => setActiveTab('sections')}>Cấu trúc tài liệu</button>
                      <button className={activeTab === 'chunks' ? 'active' : ''} type="button" onClick={() => setActiveTab('chunks')}>Chunks</button>
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

                    {activeTab === 'sections' && (
                      <div className="qdoc-tab-body">
                        {sortedSections.length === 0 ? (
                          <div className="qdoc-empty-state">Chưa có cấu trúc section.</div>
                        ) : (
                          <div className="qdoc-section-tree">
                            {sortedSections.map((section) => (
                              <div
                                key={section.id}
                                className="qdoc-section-node"
                                style={{ marginLeft: `${Math.max(0, section.level - 1) * 18}px` }}
                              >
                                <div>
                                  <strong>{section.title}</strong>
                                  <span>{section.path}</span>
                                </div>
                                <div className="qdoc-section-meta">
                                  <span>Cấp {section.level}</span>
                                  <span>Trang {pageRange(section.pageStart, section.pageEnd)}</span>
                                  <span>{Math.round((section.confidence || 0) * 100)}%</span>
                                  {section.confidence < 0.5 && <span className="qdoc-mini-badge qdoc-mini-badge--warning">Độ tin cậy thấp</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'chunks' && (
                      <div className="qdoc-tab-body qdoc-table-scroll">
                        <table className="qdoc-table">
                          <thead>
                            <tr>
                              <th>Chunk</th>
                              <th>Section</th>
                              <th>Trang</th>
                              <th>Tokens</th>
                              <th>Cảnh báo</th>
                              <th>Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(documentDetail.chunks || []).length === 0 ? (
                              <tr>
                                <td colSpan="6" className="qdoc-empty-cell">Chưa có chunk.</td>
                              </tr>
                            ) : (
                              documentDetail.chunks.map((chunk) => (
                                <tr key={chunk.id}>
                                  <td>{chunk.chunkIndex}</td>
                                  <td>{chunk.sectionPath || chunk.sectionTitle || 'Nội dung tài liệu'}</td>
                                  <td>{pageRange(chunk.pageStart, chunk.pageEnd)}</td>
                                  <td>{formatNumber(chunk.tokenCount)}</td>
                                  <td>{qualityFlagsText(chunk.qualityFlags)}</td>
                                  <td className="qdoc-preview-cell">{chunk.textPreview}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'jobs' && (
                      <div className="qdoc-tab-body">
                        <div className="qdoc-empty-state">
                          Lịch sử phiên tạo sẽ hiển thị sau khi backend bổ sung API danh sách job theo tài liệu.
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
