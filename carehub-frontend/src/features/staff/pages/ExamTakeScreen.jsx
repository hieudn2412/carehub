import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'

function ExamTakeScreen() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const expiredNoticeShownRef = useRef(false)

  useEffect(() => {
    async function loadAttempt() {
      try {
        const response = await myExamApi.getAttempt(attemptId)
        const data = apiData(response, null)
        setAttempt(data)
        const nextAnswers = {}
        ;(data?.questions || []).forEach((question) => {
          if (question.selectedAnswer) nextAnswers[question.paperQuestionId] = question.selectedAnswer
        })
        setAnswers(nextAnswers)
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      }
    }
    loadAttempt()
  }, [attemptId, showToast])

  const answerPayload = useMemo(
    () => Object.entries(answers).map(([paperQuestionId, selectedAnswer]) => ({
      paperQuestionId: Number(paperQuestionId),
      selectedAnswer,
    })),
    [answers],
  )

  const isWritable = attempt?.status === 'IN_PROGRESS' && (remainingSeconds === null || remainingSeconds > 0)

  useEffect(() => {
    if (!attempt?.expiresAt || attempt.status !== 'IN_PROGRESS') {
      setRemainingSeconds(null)
      return undefined
    }

    function tick() {
      const seconds = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))
      setRemainingSeconds(seconds)
      if (seconds === 0 && !expiredNoticeShownRef.current) {
        expiredNoticeShownRef.current = true
        setAttempt((current) => current ? { ...current, status: 'EXPIRED', statusText: 'Quá hạn' } : current)
        showToast('Lượt làm bài đã hết thời gian.', 'warning')
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [attempt?.expiresAt, attempt?.status, showToast])

  const saveAnswers = useCallback(async (silent = false) => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return
    if (remainingSeconds !== null && remainingSeconds <= 0) {
      setAttempt((current) => current ? { ...current, status: 'EXPIRED', statusText: 'Quá hạn' } : current)
      if (!silent) showToast('Lượt làm bài đã hết thời gian.', 'warning')
      return
    }
    if (silent) {
      setAutoSaving(true)
      setSaveStatus('Đang lưu tự động...')
    } else {
      setSaving(true)
    }
    try {
      const response = await myExamApi.saveAnswers(attemptId, answerPayload)
      setAttempt(apiData(response, attempt))
      setLastSavedAt(new Date())
      setSaveStatus('Đã lưu')
      if (!silent) showToast('Đã lưu đáp án.', 'success')
    } catch (error) {
      setSaveStatus('Lưu lỗi')
      if (!silent) showToast(apiErrorMessage(error), 'error')
    } finally {
      if (silent) {
        setAutoSaving(false)
      } else {
        setSaving(false)
      }
    }
  }, [answerPayload, attempt, attemptId, remainingSeconds, showToast])

  useEffect(() => {
    if (!isWritable || answerPayload.length === 0) return undefined
    const timer = window.setInterval(() => {
      saveAnswers(true)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [answerPayload.length, isWritable, saveAnswers])

  async function submitAttempt() {
    if (!isWritable) {
      showToast('Lượt làm bài không còn ở trạng thái có thể nộp.', 'warning')
      return
    }
    if (!window.confirm('Nộp bài kiểm tra? Sau khi nộp không thể sửa đáp án.')) return
    setSaving(true)
    try {
      await myExamApi.submitAttempt(attemptId, answerPayload)
      showToast('Đã nộp bài kiểm tra.', 'success')
      navigate('/staff/exam/history')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  function formatRemaining(seconds) {
    if (seconds === null || seconds === undefined) return '--:--'
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Làm bài thi" />
        <div className="dashboard-layout__body">
          <div className="eh-page">
            <div className="eh-header eh-detail-header">
              <div>
                <h2 className="eh-page-title">{attempt?.examPaperName || 'Bài kiểm tra'}</h2>
                <p className="eh-page-sub">Hạn lượt làm: {formatDateTime(attempt?.expiresAt)}</p>
                <p className="eh-page-sub">Thời gian còn lại: {formatRemaining(remainingSeconds)}</p>
                <p className="eh-page-sub">
                  {autoSaving ? 'Đang lưu tự động...' : saveStatus}
                  {lastSavedAt ? ` lúc ${lastSavedAt.toLocaleTimeString('vi-VN')}` : ''}
                </p>
              </div>
              <div className="eh-actions">
                <button className="eh-btn eh-btn--view" onClick={() => saveAnswers(false)} disabled={saving || autoSaving || !isWritable}>
                  <SaveOutlined /> Lưu
                </button>
                <button className="eh-btn eh-btn--retry" onClick={submitAttempt} disabled={saving || autoSaving || !isWritable}>
                  <SendOutlined /> Nộp bài
                </button>
              </div>
            </div>
            {!isWritable && attempt && (
              <div className="eh-table-card">
                <div className="eh-answer-line">Lượt làm bài đã kết thúc, bạn không thể sửa hoặc nộp thêm đáp án.</div>
              </div>
            )}

            {(attempt?.questions || []).map((question) => (
              <div key={question.paperQuestionId} className="eh-table-card eh-question-review">
                <div className="eh-detail-header">
                  <strong>Câu {question.position}</strong>
                  <span>{answers[question.paperQuestionId] || 'Chưa chọn'}</span>
                </div>
                <p>{question.stem}</p>
                {['A', 'B', 'C', 'D'].map((optionKey) => (
                  <label key={optionKey} className="eh-option-row">
                    <input
                      type="radio"
                      name={`question-${question.paperQuestionId}`}
                      checked={answers[question.paperQuestionId] === optionKey}
                      disabled={!isWritable}
                      onChange={() => setAnswers((current) => ({ ...current, [question.paperQuestionId]: optionKey }))}
                    />
                    <span>{optionKey}. {question[`option${optionKey}`]}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExamTakeScreen
