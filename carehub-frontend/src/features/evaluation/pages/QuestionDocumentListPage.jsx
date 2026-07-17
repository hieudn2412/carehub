import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EyeOutlined,
  FileAddOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../api/documentQuestionApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import {
  apiData,
  apiErrorMessage,
  documentStatusText,
  formatDateTime,
  formatNumber,
  jobStatusText,
  normalizeText,
  statusTone,
} from '../utils/documentQuestionUi.js'
import '../styles/QuestionDocumentPages.css'

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']
const PAGE_SIZE = 10

function QuestionDocumentListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [jobModalDocument, setJobModalDocument] = useState(null)
  const [questionsPerChunk, setQuestionsPerChunk] = useState(1)
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [isCreatingJob, setIsCreatingJob] = useState(false)

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await documentQuestionApi.listDocuments({ page: 0, size: 100, sort: 'createdAt,desc' })
      const data = apiData(response, { content: [] })
      setDocuments(data.content || [])
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  const filteredDocuments = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    return documents.filter((document) => {
      const matchesKeyword = !normalizedKeyword || normalizeText(document.filename).includes(normalizedKeyword)
      const matchesStatus = !statusFilter || document.status === statusFilter
      return matchesKeyword && matchesStatus
    })
  }, [documents, keyword, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE))
  const displayRows = filteredDocuments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDocuments()
  }, [loadDocuments])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      showToast('Chỉ hỗ trợ PDF, DOCX, TXT hoặc MD.', 'warning')
      event.target.value = ''
      return
    }
    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) {
      showToast('Vui lòng chọn tệp tài liệu trước khi tải lên.', 'warning')
      return
    }
    setIsUploading(true)
    try {
      const response = await documentQuestionApi.uploadDocument(selectedFile)
      const uploaded = apiData(response)
      setSelectedFile(null)
      await loadDocuments()
      if (uploaded?.status === 'OCR_REQUIRED') {
        showToast('Tài liệu cần OCR trước khi tạo câu hỏi.', 'warning')
      } else {
        showToast('Tải tài liệu thành công.', 'success')
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsUploading(false)
    }
  }

  async function openCreateJob(document) {
    setJobModalDocument(document)
    setQuestionsPerChunk(1)
    setSelectedCategoryId('')
    try {
      const catResp = await questionCategoryApi.listCategories({ status: 'ACTIVE' })
      const catData = apiData(catResp, [])
      setCategories(Array.isArray(catData) ? catData : [])
    } catch {
      setCategories([])
    }
  }

  async function createJob() {
    if (!jobModalDocument) return
    if (!selectedCategoryId) {
      showToast('Vui lòng chọn danh mục (Bài 1-9).', 'warning')
      return
    }
    const normalizedCount = Math.min(5, Math.max(1, Number(questionsPerChunk) || 1))
    setIsCreatingJob(true)
    try {
      const response = await documentQuestionApi.createQuestionJob(jobModalDocument.id, {
        questionsPerChunk: normalizedCount,
        categoryId: Number(selectedCategoryId),
      })
      const job = apiData(response)
      showToast('Tạo phiên sinh câu hỏi thành công.', 'success')
      setJobModalDocument(null)
      navigate(`/admin/evaluation/document-question-jobs/${job.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsCreatingJob(false)
    }
  }

  function canCreateJob(document) {
    return document.status === 'READY' && Number(document.chunkCount) > 0
  }

  const breadcrumbs = [{ label: 'Đánh giá' }, { label: 'Tạo câu hỏi từ tài liệu' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qdoc-page">
              <section className="qdoc-title-card">
                <div>
                  <h1 className="qdoc-title">Tạo câu hỏi từ tài liệu</h1>
                  <p className="qdoc-subtitle">
                    Tải tài liệu chuyên môn, AI tự động tạo câu hỏi trắc nghiệm để duyệt và lưu vào ngân hàng.
                  </p>
                </div>
                <FileAddOutlined className="qdoc-title-icon" />
              </section>

              <section className="qdoc-panel qdoc-upload-panel">
                <div className="qdoc-upload-copy">
                  <h2>Tải tài liệu</h2>
                  <p>Hỗ trợ PDF có text, DOCX, TXT, MD. PDF scan sẽ được đánh dấu cần OCR.</p>
                  {selectedFile && <span className="qdoc-selected-file">{selectedFile.name}</span>}
                </div>
                <div className="qdoc-upload-actions">
                  <label className="qdoc-secondary-btn">
                    <UploadOutlined />
                    <span>Chọn tệp</span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      hidden
                    />
                  </label>
                  <button className="qdoc-primary-btn" type="button" disabled={isUploading} onClick={handleUpload}>
                    {isUploading ? <LoadingOutlined /> : <FileAddOutlined />}
                    <span>{isUploading ? 'Đang tải và phân tích tài liệu...' : 'Tải lên'}</span>
                  </button>
                </div>
              </section>

              <section className="qdoc-filter-bar">
                <div className="qdoc-search">
                  <SearchOutlined className="qdoc-search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên tài liệu..."
                    value={keyword}
                    onChange={(event) => {
                      setKeyword(event.target.value)
                      setPage(0)
                    }}
                  />
                </div>
                <select
                  className="qdoc-select"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value)
                    setPage(0)
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="READY">Sẵn sàng</option>
                  <option value="OCR_REQUIRED">Cần OCR</option>
                  <option value="FAILED">Thất bại</option>
                </select>
              </section>

              <section className="qdoc-table-card">
                <table className="qdoc-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên tài liệu</th>
                      <th>Trạng thái</th>
                      <th>Số trang</th>
                      <th>Câu hỏi đã tạo</th>
                      <th>Ngày tải</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" className="qdoc-empty-cell">Đang tải danh sách tài liệu...</td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="qdoc-empty-cell">Chưa có tài liệu nào. Tải tài liệu đầu tiên để bắt đầu tạo câu hỏi.</td>
                      </tr>
                    ) : (
                      displayRows.map((document, index) => (
                        <tr key={document.id}>
                          <td>{String(page * PAGE_SIZE + index + 1).padStart(3, '0')}</td>
                          <td>
                            <div className="qdoc-file-cell">
                              <FileSearchOutlined />
                              <div>
                                <strong>{document.filename}</strong>
                                {document.status === 'OCR_REQUIRED' && (
                                  <span>Tài liệu cần OCR trước khi tạo câu hỏi.</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`qdoc-badge qdoc-badge--${statusTone(document.status)}`}>
                              {documentStatusText(document)}
                            </span>
                          </td>
                          <td>{formatNumber(document.pageCount)}</td>
                          <td>
                            {document.latestQuestionJob ? (
                              <button
                                type="button"
                                className="qdoc-job-link"
                                onClick={() => navigate(`/admin/evaluation/document-question-jobs/${document.latestQuestionJob.id}`)}
                              >
                                <span>{formatNumber(document.latestQuestionJob.candidateCount)} câu</span>
                                <span className={`qdoc-mini-badge qdoc-mini-badge--${statusTone(document.latestQuestionJob.status)}`}>
                                  {jobStatusText(document.latestQuestionJob)}
                                </span>
                              </button>
                            ) : (
                              <span className="qdoc-muted-text">Chưa tạo</span>
                            )}
                          </td>
                          <td>{formatDateTime(document.createdAt)}</td>
                          <td>
                            <div className="qdoc-table-actions">
                              {document.latestQuestionJob && document.latestQuestionJob.candidateCount > 0 && (
                                <button
                                  type="button"
                                  className="qdoc-icon-btn"
                                  title="Xem câu hỏi"
                                  onClick={() => navigate(`/admin/evaluation/document-question-jobs/${document.latestQuestionJob.id}`)}
                                >
                                  <EyeOutlined />
                                </button>
                              )}
                              <button
                                type="button"
                                className="qdoc-icon-btn qdoc-icon-btn--primary"
                                title="Tạo câu hỏi"
                                disabled={!canCreateJob(document)}
                                onClick={() => openCreateJob(document)}
                              >
                                <PlayCircleOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="qdoc-pagination-bar">
                  <span>Hiển thị {displayRows.length} trong tổng số {filteredDocuments.length} tài liệu</span>
                  <div className="qdoc-pagination-buttons">
                    <button type="button" disabled={page <= 0} onClick={() => setPage(page - 1)}>&lt;</button>
                    <span>{page + 1} / {totalPages}</span>
                    <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>&gt;</button>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {jobModalDocument && (
        <div className="qdoc-modal-backdrop">
          <div className="qdoc-modal" role="dialog" aria-modal="true" aria-labelledby="create-job-title">
            <h2 id="create-job-title">Tạo phiên sinh câu hỏi</h2>
            <p className="qdoc-modal-subtitle">{jobModalDocument.filename}</p>
            <label className="qdoc-field">
              <span>Danh mục câu hỏi</span>
              <select
                className="qdoc-select"
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
              >
                <option value="">-- Chọn bài (1-9) --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
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
              Chọn danh mục Bài 1-9 để gom nhóm câu hỏi. Tất cả câu hỏi từ tài liệu này sẽ thuộc danh mục đã chọn.
            </div>
            <div className="qdoc-modal-actions">
              <button type="button" className="qdoc-secondary-btn" onClick={() => setJobModalDocument(null)} disabled={isCreatingJob}>
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

export default QuestionDocumentListPage
