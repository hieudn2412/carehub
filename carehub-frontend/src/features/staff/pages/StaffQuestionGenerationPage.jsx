import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadOutlined,
  FileAddOutlined,
  EyeOutlined,
  LoadingOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../shared/components/EmptyState.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../../evaluation/api/documentQuestionApi.js'
import { questionCategoryApi } from '../../evaluation/api/questionCategoryApi.js'
import { apiData, apiErrorMessage } from '../../evaluation/utils/documentQuestionUi.js'
import '../styles/StaffDashBoardScreen.css'
import '../styles/StaffQuestionGenerationPage.css'

const POLL_INTERVAL_MS = 3000

function StaffQuestionGenerationPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Document list
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Category
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

  // Generation
  const [generatingDocId, setGeneratingDocId] = useState(null)
  const [pollingJobId, setPollingJobId] = useState(null)

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

  useEffect(() => { loadDocuments() }, [loadDocuments])

  useEffect(() => {
    questionCategoryApi.listCategories({ status: 'ACTIVE' }).then(res => {
      const data = apiData(res, [])
      setCategories(Array.isArray(data) ? data : [])
    }).catch(() => setCategories([]))
  }, [])

  // Poll job status
  useEffect(() => {
    if (!pollingJobId) return
    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const response = await documentQuestionApi.getQuestionJob(pollingJobId)
        const job = apiData(response)
        if (cancelled) return
        if (!job) return
        if (job.status === 'GENERATED' || job.status === 'PARTIALLY_COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
          setPollingJobId(null)
          setGeneratingDocId(null)
          await loadDocuments()
          if (job.status === 'GENERATED' && job.candidateCount > 0) {
            showToast(`Đã tạo ${job.candidateCount} câu hỏi. Vào xem để duyệt.`, 'success')
            navigate(`/staff/generate-questions/jobs/${job.id}`)
          } else if (job.status === 'GENERATED' && job.candidateCount === 0) {
            showToast('Hoàn thành nhưng không tạo được câu hỏi nào. Tài liệu có thể chưa đủ nội dung.', 'warning')
          } else if (job.status === 'FAILED') {
            showToast('Tạo câu hỏi thất bại.', 'error')
          }
        }
      } catch {
        // ignore polling errors
      }
    }, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [pollingJobId, navigate, showToast, loadDocuments])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      showToast('Chỉ hỗ trợ PDF, DOCX, TXT, MD.', 'warning')
      return
    }
    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) {
      showToast('Vui lòng chọn tài liệu trước.', 'warning')
      return
    }
    setIsUploading(true)
    try {
      await documentQuestionApi.uploadDocument(selectedFile)
      setSelectedFile(null)
      await loadDocuments()
      showToast('Tải tài liệu thành công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleGenerate(documentId) {
    if (!selectedCategoryId) {
      showToast('Vui lòng chọn danh mục câu hỏi trước khi tạo câu hỏi.', 'warning')
      return
    }
    setGeneratingDocId(documentId)
    try {
      const response = await documentQuestionApi.createQuestionJob(documentId, {
        questionsPerChunk: 2,
        categoryId: Number(selectedCategoryId),
      })
      const job = apiData(response)
      setPollingJobId(job.id)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
      setGeneratingDocId(null)
    }
  }

  const readyDocs = documents.filter(d => d.status === 'READY' && (d.chunkCount || 0) > 0)

  return (
    <AppShell title="Tạo câu hỏi từ tài liệu">
      <div className="dashboard">

        {/* Upload area */}
        <div className="welcome-banner sqg-banner">
          <div>
            <h2 style={{ margin: 0 }}>Tải tài liệu chuyên môn</h2>
            <p style={{ margin: '4px 0 0', color: '#888' }}>
              Hỗ trợ PDF, DOCX, TXT. Tải lên để AI tự động tạo câu hỏi trắc nghiệm.
            </p>
          </div>
          <div className="sqg-upload-actions">
            {selectedFile && (
              <span className="sqg-file-name">
                {selectedFile.name}
              </span>
            )}
            <label className="sqg-upload-label">
              <UploadOutlined />
              Chọn tệp
              <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} hidden />
            </label>
            <button
              type="button"
              disabled={!selectedFile || isUploading}
              onClick={handleUpload}
              className="sqg-upload-btn"
            >
              {isUploading ? <LoadingOutlined /> : <FileAddOutlined />}
              {isUploading ? 'Đang tải...' : 'Tải lên'}
            </button>
          </div>
        </div>

        {/* Category selector */}
        <div className="welcome-banner sqg-banner">
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Danh mục câu hỏi</h2>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
              Chọn danh mục phù hợp với tài liệu. Tất cả câu hỏi sẽ được gom vào danh mục này.
            </p>
          </div>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="sqg-select"
          >
            <option value="">-- Chọn danh mục --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Document list */}
        <div className="welcome-banner">
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Danh sách tài liệu đã tải</h3>
          {isLoading ? (
            <LoadingState />
          ) : readyDocs.length === 0 ? (
            <EmptyState>Chưa có tài liệu nào sẵn sàng. Hãy tải tài liệu lên.</EmptyState>
          ) : (
            <div className="sqg-table-wrap">
              <table className="ch-table ch-table--cards sqg-table">
                <thead>
                  <tr>
                    <th>Tên tài liệu</th>
                    <th className="sqg-col-center">Trạng thái</th>
                    <th className="sqg-col-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {readyDocs.map(doc => {
                    const isGenerating = generatingDocId === doc.id
                    return (
                      <tr key={doc.id}>
                        <td data-label="Tên tài liệu">
                          <div className="sqg-doc-name">
                            <FileTextOutlined style={{ color: '#1677ff' }} />
                            <span>{doc.filename}</span>
                          </div>
                        </td>
                        <td data-label="Trạng thái" className="sqg-col-center">
                          {isGenerating ? (
                            <span style={{ color: '#fa8c16', fontSize: 12 }}>
                              <LoadingOutlined style={{ marginRight: 4 }} />Đang tạo...
                            </span>
                          ) : doc.latestQuestionJob ? (
                            <span style={{ fontSize: 12, color: '#52c41a' }}>
                              {doc.latestQuestionJob.candidateCount || 0} câu
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#999' }}>Chưa tạo</span>
                          )}
                        </td>
                        <td data-label="Hành động" className="sqg-col-right">
                          {doc.latestQuestionJob && doc.latestQuestionJob.status === 'GENERATED' ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/staff/generate-questions/jobs/${doc.latestQuestionJob.id}`)}
                              className="sqg-link-btn"
                            >
                              <EyeOutlined style={{ marginRight: 4 }} />
                              Xem câu hỏi
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isGenerating}
                              onClick={() => handleGenerate(doc.id)}
                              className="sqg-generate-btn"
                            >
                              {isGenerating ? (
                                <><LoadingOutlined style={{ marginRight: 4 }} />Đang tạo</>
                              ) : (
                                'Tạo câu hỏi'
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}

export default StaffQuestionGenerationPage
