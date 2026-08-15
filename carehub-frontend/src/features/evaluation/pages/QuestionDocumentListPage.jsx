import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EyeOutlined,
  CloseOutlined,
  DeleteOutlined,
  FileAddOutlined,
  FileSearchOutlined,
  FilterOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx'
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
  const fileInputRef = useRef(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [jobModalDocument, setJobModalDocument] = useState(null)
  const [questionsPerChunk, setQuestionsPerChunk] = useState(1)
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeletingDocument, setIsDeletingDocument] = useState(false)

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

  function clearSelectedFile() {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
      clearSelectedFile()
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

  async function deleteDocument() {
    if (!deleteTarget) return
    setIsDeletingDocument(true)
    try {
      await documentQuestionApi.deleteDocument(deleteTarget.id)
      setDocuments((current) => current.filter((document) => document.id !== deleteTarget.id))
      setPage(0)
      setDeleteTarget(null)
      showToast('Đã xóa tài liệu.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsDeletingDocument(false)
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

  async function createCategoryInline(event) {
    event.preventDefault()
    const name = categoryForm.name.trim()
    if (!name) {
      showToast('Vui lòng nhập tên danh mục.', 'warning')
      return
    }
    setIsCreatingCategory(true)
    try {
      const response = await questionCategoryApi.createCategory({
        name,
        code: categoryForm.code.trim() || undefined,
        description: categoryForm.description.trim() || undefined,
        status: 'ACTIVE',
      })
      const category = apiData(response)
      if (category?.id) {
        setCategories((current) => [...current, category])
        setSelectedCategoryId(String(category.id))
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

  async function createJob() {
    if (!jobModalDocument) return
    if (!selectedCategoryId) {
      showToast('Vui lòng chọn danh mục câu hỏi.', 'warning')
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
                      ref={fileInputRef}
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
                  {selectedFile && (
                    <button
                      type="button"
                      className="qdoc-secondary-btn qdoc-secondary-btn--danger"
                      onClick={clearSelectedFile}
                      disabled={isUploading}
                    >
                      <CloseOutlined />
                      <span>Bỏ chọn</span>
                    </button>
                  )}
                </div>
              </section>

              <section className="qdoc-filter-bar admin-control-toolbar">
                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__controls">
                    <div className="qdoc-search admin-control-toolbar__search">
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
                    <button
                      aria-controls="question-document-filter-panel"
                      aria-expanded={isFilterOpen}
                      className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      onClick={() => setIsFilterOpen((current) => !current)}
                      type="button"
                    >
                      <FilterOutlined /> Bộ lọc
                      {statusFilter && <span className="admin-control-toolbar__filter-count">1</span>}
                    </button>
                  </div>
                </div>
                {isFilterOpen && (
                  <div className="admin-control-toolbar__panel" id="question-document-filter-panel">
                    <label className="admin-control-toolbar__field">
                      <span>Trạng thái</span>
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
                    </label>
                  </div>
                )}
              </section>

              <section className="qdoc-table-card">
                <table className="qdoc-table admin-table-uppercase">
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
                                <button
                                  type="button"
                                  className="qdoc-file-link"
                                  onClick={() => navigate(`/admin/evaluation/question-documents/${document.id}`)}
                                >
                                  {document.filename}
                                </button>
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
                            <div className="qdoc-table-actions admin-table-actions">
                              {document.latestQuestionJob && document.latestQuestionJob.candidateCount > 0 && (
                                <button
                                  type="button"
                                  className="admin-table-action admin-table-action--icon"
                                  title="Xem câu hỏi"
                                  aria-label={`Duyệt câu hỏi từ ${document.filename}`}
                                  onClick={() => navigate(`/admin/evaluation/document-question-jobs/${document.latestQuestionJob.id}`)}
                                >
                                  <EyeOutlined />
                                </button>
                              )}
                              <button
                                type="button"
                                className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                title="Tạo câu hỏi"
                                aria-label={`Tạo phiên câu hỏi từ ${document.filename}`}
                                disabled={!canCreateJob(document)}
                                onClick={() => openCreateJob(document)}
                              >
                                <PlayCircleOutlined />
                              </button>
                              {!document.latestQuestionJob && (
                                <button
                                  type="button"
                                  className="admin-table-action admin-table-action--icon admin-table-action--danger"
                                  title="Xóa tài liệu"
                                  aria-label={`Xóa tài liệu ${document.filename}`}
                                  onClick={() => setDeleteTarget(document)}
                                >
                                  <DeleteOutlined />
                                </button>
                              )}
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
            <div className="qdoc-modal-heading-row">
              <div>
                <h2 id="create-job-title">Tạo phiên sinh câu hỏi</h2>
                <p className="qdoc-modal-subtitle">{jobModalDocument.filename}</p>
              </div>
              <button type="button" className="qdoc-icon-btn" aria-label="Đóng" onClick={() => setJobModalDocument(null)} disabled={isCreatingJob}>
                <CloseOutlined />
              </button>
            </div>
            <div className="qdoc-field">
              <div className="qdoc-modal-heading-row">
                <span>Danh mục câu hỏi <em>*</em></span>
                <button type="button" className="qdoc-inline-add-btn" onClick={() => setShowCategoryModal(true)} disabled={isCreatingJob}>
                  <PlusOutlined /> Thêm mới
                </button>
              </div>
              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                disabled={isCreatingJob}
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <small className="qdoc-field-help">Tất cả câu hỏi sinh từ tài liệu sẽ được lưu vào danh mục này.</small>
            </div>
            <label className="qdoc-field">
              <span>Số câu mỗi đoạn nội dung</span>
              <input
                type="number"
                min="1"
                max="5"
                value={questionsPerChunk}
                onChange={(event) => setQuestionsPerChunk(event.target.value)}
                disabled={isCreatingJob}
              />
              <small className="qdoc-field-help">
                Tài liệu sẽ được chia thành các đoạn nội dung, mỗi đoạn sinh tối đa số câu đã chọn. Nên bắt đầu với 1 để kiểm soát chất lượng.
              </small>
            </label>
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
      {showCategoryModal && (
        <div className="qdoc-modal-backdrop qdoc-modal-backdrop--front">
          <form className="qdoc-modal qdoc-modal--category" onSubmit={createCategoryInline}>
            <div className="qdoc-modal-heading-row">
              <h2>Thêm danh mục câu hỏi</h2>
              <button type="button" className="qdoc-icon-btn" aria-label="Đóng" onClick={() => setShowCategoryModal(false)}>
                <CloseOutlined />
              </button>
            </div>
            <label className="qdoc-field">
              <span>Tên danh mục <em>*</em></span>
              <input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} autoFocus />
            </label>
            <label className="qdoc-field">
              <span>Mã danh mục</span>
              <input value={categoryForm.code} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })} />
            </label>
            <label className="qdoc-field">
              <span>Mô tả</span>
              <textarea rows="3" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
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
      {deleteTarget && (
        <ConfirmDialog
          title="Xóa tài liệu"
          message={`Bạn có chắc muốn xóa tài liệu "${deleteTarget.filename}"? Tài liệu sẽ không thể khôi phục.`}
          confirmLabel="Xóa tài liệu"
          danger
          confirming={isDeletingDocument}
          onConfirm={deleteDocument}
          onCancel={() => {
            if (!isDeletingDocument) setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}

export default QuestionDocumentListPage
