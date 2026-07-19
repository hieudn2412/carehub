import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadOutlined,
  FileAddOutlined,
  EyeOutlined,
  LoadingOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../../evaluation/api/documentQuestionApi.js'
import { questionCategoryApi } from '../../evaluation/api/questionCategoryApi.js'
import { apiData, apiErrorMessage } from '../../evaluation/utils/documentQuestionUi.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import '../styles/StaffDashBoardScreen.css'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

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
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Tạo câu hỏi từ tài liệu" />
        <div className="dashboard-layout__body">
          <div className="dashboard">

            {/* Upload area */}
            <div className="welcome-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Tải tài liệu chuyên môn</h2>
                <p style={{ margin: '4px 0 0', color: '#888' }}>
                  Hỗ trợ PDF, DOCX, TXT. Tải lên để AI tự động tạo câu hỏi trắc nghiệm.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectedFile && (
                  <span style={{ fontSize: 13, color: '#1677ff', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFile.name}
                  </span>
                )}
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                  border: '1px dashed #1677ff', color: '#1677ff', fontSize: 13, fontWeight: 500,
                }}>
                  <UploadOutlined />
                  Chọn tệp
                  <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} hidden />
                </label>
                <button
                  type="button"
                  disabled={!selectedFile || isUploading}
                  onClick={handleUpload}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: '#1677ff', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    opacity: (!selectedFile || isUploading) ? 0.6 : 1,
                  }}
                >
                  {isUploading ? <LoadingOutlined /> : <FileAddOutlined />}
                  {isUploading ? 'Đang tải...' : 'Tải lên'}
                </button>
              </div>
            </div>

            {/* Category selector */}
            <div className="welcome-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16 }}>Danh mục câu hỏi</h2>
                <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
                  Chọn danh mục phù hợp với tài liệu. Tất cả câu hỏi sẽ được gom vào danh mục này.
                </p>
              </div>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #d9d9d9',
                  fontSize: 14, minWidth: 200,
                }}
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
                <p style={{ color: '#999', textAlign: 'center', padding: 24 }}>Đang tải...</p>
              ) : readyDocs.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center', padding: 24 }}>
                  Chưa có tài liệu nào sẵn sàng. Hãy tải tài liệu lên.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f0f0f0', color: '#888' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Tên tài liệu</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 500 }}>Trạng thái</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readyDocs.map(doc => {
                      const isGenerating = generatingDocId === doc.id
                      return (
                        <tr key={doc.id} style={{ borderBottom: '1px solid #fafafa' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FileTextOutlined style={{ color: '#1677ff' }} />
                              <span>{doc.filename}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
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
                          <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                            {doc.latestQuestionJob && doc.latestQuestionJob.status === 'GENERATED' ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/staff/generate-questions/jobs/${doc.latestQuestionJob.id}`)}
                                style={{ background: 'none', border: 'none', color: '#1677ff', cursor: 'pointer', fontSize: 13 }}
                              >
                                <EyeOutlined style={{ marginRight: 4 }} />
                                Xem câu hỏi
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isGenerating}
                                onClick={() => handleGenerate(doc.id)}
                                style={{
                                  padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                  background: isGenerating ? '#d9d9d9' : '#1677ff',
                                  color: isGenerating ? '#999' : '#fff',
                                }}
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
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffQuestionGenerationPage
