import { useCallback, useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../shared/components/EmptyState.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { documentQuestionApi } from '../../evaluation/api/documentQuestionApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import '../../evaluation/styles/QuestionDocumentPages.css'

function StaffQuestionReviewPage() {
  const { jobId } = useParams()
  const { showToast } = useToast()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try {
      const res = await documentQuestionApi.getQuestionJob(jobId)
      setJob(apiData(res))
    } catch {
      if (!silent) showToast(apiErrorMessage(), 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [jobId, showToast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!job || !['CREATED', 'GENERATING'].includes(job.status)) return
    const i = setInterval(() => load(true), 3000)
    return () => clearInterval(i)
  }, [job, load])

  // Polling for generating
  const candidates = useMemo(() => job?.candidates || [], [job])
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
      <AppShell back={{ to: '/staff/generate-questions', label: 'Quay lại' }} title="Xem câu hỏi">
        <LoadingState />
      </AppShell>
    )
  }

  if (!job) return null

  return (
    <AppShell back={{ to: '/staff/generate-questions', label: 'Quay lại' }} title="Câu hỏi đã tạo">
      <div className="qdoc-page">
        {/* Header */}
        <div className="qdoc-title-card">
          <div className="sqr-title-main">
            <h1 className="qdoc-title" style={{ fontSize: 18 }}>Xem câu hỏi đã tạo</h1>
            <p className="qdoc-subtitle">
              {statusLabel(job.status)} · {job.candidateCount || 0} câu hỏi · {formatDateTime(job.createdAt)}
            </p>
          </div>
          {job.status === 'GENERATED' || job.status === 'PARTIALLY_COMPLETED' ? (
            <div className="sqr-batch-actions">
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
            <EmptyState>
              {job.status === 'GENERATING' ? 'Đang tạo câu hỏi...' : 'Chưa có câu hỏi nào.'}
            </EmptyState>
          ) : (
            <div className="sqr-list">
              {candidates.map(c => (
                <div
                  key={c.id}
                  className={
                    'sqr-card'
                    + (c.status === 'APPROVED' ? ' sqr-card--approved' : c.status === 'REJECTED' ? ' sqr-card--rejected' : '')
                  }
                >
                  <div className="sqr-stem">
                    {c.stem}
                  </div>
                  <div className="sqr-options">
                    {['A', 'B', 'C', 'D'].map(opt => {
                      const key = 'option' + opt
                      const val = c[key]
                      if (!val) return null
                      return (
                        <span key={opt} className={'sqr-opt' + (c.correctAnswer === opt ? ' sqr-opt--correct' : '')}>
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
                  <div className="sqr-card-foot">
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
                      <div className="sqr-card-actions">
                        {c.status !== 'APPROVED' && (
                          <button
                            type="button"
                            disabled={processingId === c.id}
                            onClick={() => handleApprove(c.id)}
                            className="sqr-btn sqr-btn--approve"
                          >
                            {processingId === c.id ? <LoadingOutlined /> : <CheckCircleOutlined />} Duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={processingId === c.id}
                          onClick={() => handleReject(c.id)}
                          className="sqr-btn sqr-btn--reject"
                        >
                          <CloseCircleOutlined /> Từ chối
                        </button>
                        {c.status === 'APPROVED' && (
                          <button
                            type="button"
                            disabled={processingId === c.id}
                            onClick={() => handleSave(c.id)}
                            className="sqr-btn sqr-btn--save"
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
    </AppShell>
  )
}

export default StaffQuestionReviewPage
