import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../../evaluation/api/documentQuestionApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import '../../evaluation/styles/QuestionDocumentPages.css'

function StaffQuestionReviewPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)

  const load = async (silent) => {
    if (!silent) setLoading(true)
    try {
      const res = await documentQuestionApi.getQuestionJob(jobId)
      setJob(apiData(res))
    } catch {
      if (!silent) showToast(apiErrorMessage(), 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [jobId])
  useEffect(() => {
    if (!job || !['CREATED', 'GENERATING'].includes(job.status)) return
    const i = setInterval(() => load(true), 3000)
    return () => clearInterval(i)
  }, [job?.status])

  // Polling for generating
  const candidates = useMemo(() => job?.candidates || [], [job])
  const grouped = useMemo(() => {
    const map = { VALIDATED: [], NEED_REVIEW: [], APPROVED: [], REJECTED: [], SAVED: [] }
    candidates.forEach(c => {
      const k = c.status === 'VALIDATED' || c.status === 'NEED_REVIEW' ? c.status : c.status
      if (map[k]) map[k].push(c)
      else map.VALIDATED.push(c)
    })
    return map
  }, [candidates])

  const statusLabel = (s) => {
    const map = {
      CREATED: 'Đang chờ',
      GENERATING: 'Đang tạo...',
      GENERATED: 'Đã tạo xong',
      PARTIALLY_COMPLETED: 'Hoàn thành một phần',
      FAILED: 'Thất bại',
      CANCELLED: 'Đã hủy',
    }
    return map[s] || s
  }

  const handleApprove = async (id) => {
    setProcessingId(id)
    try {
      await documentQuestionApi.approveCandidate(id, '')
      await load(true)
      showToast('Đã duyệt câu hỏi.', 'success')
    } catch {
      showToast('Lỗi khi duyệt.', 'error')
    } finally { setProcessingId(null) }
  }

  const handleReject = async (id) => {
    setProcessingId(id)
    try {
      await documentQuestionApi.rejectCandidate(id, '')
      await load(true)
      showToast('Đã từ chối câu hỏi.', 'success')
    } catch {
      showToast('Lỗi khi từ chối.', 'error')
    } finally { setProcessingId(null) }
  }

  const handleSave = async (id) => {
    setProcessingId(id)
    try {
      await documentQuestionApi.saveCandidateAsQuestion(id)
      await load(true)
      showToast('Đã lưu vào ngân hàng câu hỏi.', 'success')
    } catch {
      showToast('Lỗi khi lưu.', 'error')
    } finally { setProcessingId(null) }
  }

  const handleBatchAction = async (action) => {
    const ids = candidates
      .filter(c => c.status === 'VALIDATED' || c.status === 'NEED_REVIEW')
      .map(c => c.id)
    if (!ids.length) return showToast('Không có câu hỏi nào để duyệt.', 'warning')
    try {
      if (action === 'approve') await documentQuestionApi.approveCandidates(ids, '')
      else if (action === 'reject') await documentQuestionApi.rejectCandidates(ids, '')
      else if (action === 'save') {
        const savable = candidates.filter(c => c.status === 'APPROVED').map(c => c.id)
        if (!savable.length) return showToast('Chưa có câu hỏi được duyệt để lưu.', 'warning')
        await documentQuestionApi.saveCandidatesAsQuestions(savable)
      }
      await load(true)
      showToast(action === 'approve' ? 'Đã duyệt tất cả.' : action === 'reject' ? 'Đã từ chối tất cả.' : 'Đã lưu vào ngân hàng.', 'success')
    } catch {
      showToast('Lỗi khi thực hiện.', 'error')
    }
  }

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-layout__content">
          <Header title="Xem câu hỏi" />
          <div className="dashboard-layout__body" style={{ textAlign: 'center', padding: 40 }}>
            <LoadingOutlined style={{ fontSize: 24 }} />
          </div>
        </div>
      </div>
    )
  }

  if (!job) return null

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Câu hỏi đã tạo" />
        <div className="dashboard-layout__body">
          <div className="qdoc-page">
            {/* Header */}
            <div className="qdoc-title-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <button type="button" className="qdoc-secondary-btn" onClick={() => navigate('/staff/generate-questions')}>
                <ArrowLeftOutlined /> Quay lại
              </button>
              <div style={{ flex: 1 }}>
                <h1 className="qdoc-title" style={{ fontSize: 18 }}>Xem câu hỏi đã tạo</h1>
                <p className="qdoc-subtitle">
                  {statusLabel(job.status)} · {job.candidateCount || 0} câu hỏi · {formatDateTime(job.createdAt)}
                </p>
              </div>
              {job.status === 'GENERATED' || job.status === 'PARTIALLY_COMPLETED' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="qdoc-primary-btn" onClick={() => handleBatchAction('approve')}>
                    <CheckCircleOutlined /> Duyệt tất cả
                  </button>
                  <button className="qdoc-secondary-btn" onClick={() => handleBatchAction('reject')}>
                    <CloseCircleOutlined /> Từ chối tất cả
                  </button>
                  <button className="qdoc-secondary-btn" onClick={() => handleBatchAction('save')}>
                    <SaveOutlined /> Lưu vào ngân hàng
                  </button>
                </div>
              ) : null}
            </div>

            {/* Question list */}
            <div className="qdoc-table-card">
              {candidates.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 32, color: '#999' }}>
                  {job.status === 'GENERATING' ? 'Đang tạo câu hỏi...' : 'Chưa có câu hỏi nào.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {candidates.map(c => (
                    <div key={c.id} style={{
                      border: '1px solid #f0f0f0', borderRadius: 10, padding: 16,
                      background: c.status === 'APPROVED' ? '#f6ffed' : c.status === 'REJECTED' ? '#fff2f0' : '#fff',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, lineHeight: 1.5 }}>
                        {c.stem}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        {['A', 'B', 'C', 'D'].map(opt => {
                          const key = 'option' + opt
                          const val = c[key]
                          if (!val) return null
                          return (
                            <span key={opt} style={{
                              padding: '4px 12px', borderRadius: 6, fontSize: 12,
                              background: c.correctAnswer === opt ? '#1677ff' : '#f5f5f5',
                              color: c.correctAnswer === opt ? '#fff' : '#333',
                              fontWeight: c.correctAnswer === opt ? 600 : 400,
                            }}>
                              {opt}. {val}
                            </span>
                          )
                        })}
                      </div>
                      {c.explanation && (
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                          <strong>Giải thích:</strong> {c.explanation}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: '#999' }}>
                          {c.status === 'SAVED' ? (
                            <span style={{ color: '#1677ff' }}>✓ Đã lưu vào ngân hàng</span>
                          ) : c.status === 'APPROVED' ? (
                            <span style={{ color: '#52c41a' }}>✓ Đã duyệt</span>
                          ) : c.status === 'REJECTED' ? (
                            <span style={{ color: '#ff4d4f' }}>✗ Đã từ chối</span>
                          ) : (
                            <span>Chờ duyệt</span>
                          )}
                          {c.topic && <span> · {c.topic}</span>}
                          {c.difficulty && <span> · {c.difficulty}</span>}
                        </div>
                        {c.status !== 'SAVED' && c.status !== 'REJECTED' ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {c.status !== 'APPROVED' && (
                              <button
                                type="button"
                                disabled={processingId === c.id}
                                onClick={() => handleApprove(c.id)}
                                style={{
                                  padding: '4px 12px', borderRadius: 6, border: '1px solid #52c41a',
                                  background: '#f6ffed', color: '#52c41a', cursor: 'pointer', fontSize: 12,
                                }}
                              >
                                {processingId === c.id ? <LoadingOutlined /> : <CheckCircleOutlined />} Duyệt
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={processingId === c.id}
                              onClick={() => handleReject(c.id)}
                              style={{
                                padding: '4px 12px', borderRadius: 6, border: '1px solid #ff4d4f',
                                background: '#fff2f0', color: '#ff4d4f', cursor: 'pointer', fontSize: 12,
                              }}
                            >
                              <CloseCircleOutlined /> Từ chối
                            </button>
                            {c.status === 'APPROVED' && (
                              <button
                                type="button"
                                disabled={processingId === c.id}
                                onClick={() => handleSave(c.id)}
                                style={{
                                  padding: '4px 12px', borderRadius: 6, border: 'none',
                                  background: '#1677ff', color: '#fff', cursor: 'pointer', fontSize: 12,
                                }}
                              >
                                <SaveOutlined /> Lưu
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffQuestionReviewPage
