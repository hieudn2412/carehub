import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'

const AUTOSAVE_DEBOUNCE_MS = 1200
const AUTOSAVE_INTERVAL_MS = 15000

function cacheKey(attemptId) {
  return `carehub-exam-draft:${attemptId}`
}

function readCachedAnswers(attemptId, validQuestionIds) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(cacheKey(attemptId)) || '{}')
    return Object.fromEntries(
      Object.entries(cached.answers || {})
        .filter(([questionId, answer]) => validQuestionIds.has(Number(questionId)) && ['A', 'B', 'C', 'D'].includes(answer)),
    )
  } catch {
    return {}
  }
}

function persistCachedAnswers(attemptId, answers) {
  try {
    window.localStorage.setItem(cacheKey(attemptId), JSON.stringify({
      answers,
      updatedAt: new Date().toISOString(),
    }))
  } catch {
    // Server autosave remains the primary persistence mechanism.
  }
}

function clearCachedAnswers(attemptId) {
  try {
    window.localStorage.removeItem(cacheKey(attemptId))
  } catch {
    // Ignore storage restrictions.
  }
}

function toAnswerPayload(answers) {
  return Object.entries(answers).map(([paperQuestionId, selectedAnswer]) => ({
    paperQuestionId: Number(paperQuestionId),
    selectedAnswer,
  }))
}

function answersEqual(left, right) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => left[key] === right[key])
}

function ExamTakeScreen() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [loadError, setLoadError] = useState('')

  const attemptRef = useRef(null)
  const answersRef = useRef({})
  const dirtyRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const autoSubmitStartedRef = useRef(false)
  const submitCurrentAttemptRef = useRef(null)
  const saveAnswersRef = useRef(null)

  const updateAttempt = useCallback((nextAttempt) => {
    attemptRef.current = nextAttempt
    setAttempt(nextAttempt)
  }, [])

  useEffect(() => {
    let active = true
    async function loadAttempt() {
      setIsLoading(true)
      setLoadError('')
      autoSubmitStartedRef.current = false
      try {
        const response = await myExamApi.getAttempt(attemptId)
        if (!active) return
        const data = apiData(response, null)
        const serverAnswers = {}
        const questionIds = new Set()
        ;(data?.questions || []).forEach((question) => {
          questionIds.add(Number(question.paperQuestionId))
          if (question.selectedAnswer) {
            serverAnswers[question.paperQuestionId] = question.selectedAnswer
          }
        })
        const cachedAnswers = data?.status === 'IN_PROGRESS'
          ? readCachedAnswers(attemptId, questionIds)
          : {}
        const mergedAnswers = { ...serverAnswers, ...cachedAnswers }
        const recoveredDraft = !answersEqual(serverAnswers, mergedAnswers)

        updateAttempt(data)
        answersRef.current = mergedAnswers
        dirtyRef.current = recoveredDraft
        setAnswers(mergedAnswers)
        setRemainingSeconds(null)
        setSaveStatus(recoveredDraft ? 'Đã khôi phục đáp án chưa đồng bộ' : '')
        if (data?.status !== 'IN_PROGRESS') {
          clearCachedAnswers(attemptId)
        }
      } catch (error) {
        if (!active) return
        const message = apiErrorMessage(error)
        setLoadError(message)
        showToast(message, 'error')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadAttempt()
    return () => {
      active = false
    }
  }, [attemptId, showToast, updateAttempt])

  const questions = attempt?.questions || []
  const answeredCount = Object.keys(answers).length
  const unansweredCount = Math.max(0, questions.length - answeredCount)
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0
  const isWritable = attempt?.status === 'IN_PROGRESS' && (remainingSeconds === null || remainingSeconds > 0)

  const finalizeResponse = useCallback((nextAttempt, message) => {
    updateAttempt(nextAttempt)
    dirtyRef.current = false
    clearCachedAnswers(attemptId)
    setSaveStatus('Đã nộp bài')
    showToast(message, 'success')
    navigate('/staff/exam/history')
  }, [attemptId, navigate, showToast, updateAttempt])

  const submitCurrentAttempt = useCallback(async (automatic = false) => {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || currentAttempt.status !== 'IN_PROGRESS') return
    if (saveInFlightRef.current) {
      window.setTimeout(() => submitCurrentAttemptRef.current?.(automatic), 250)
      return
    }

    saveInFlightRef.current = true
    setSaving(true)
    setSaveStatus(automatic ? 'Hết giờ, đang tự động nộp bài...' : 'Đang nộp bài...')
    try {
      const response = await myExamApi.submitAttempt(attemptId, toAnswerPayload(answersRef.current))
      finalizeResponse(
        apiData(response, currentAttempt),
        automatic ? 'Đã hết giờ và hệ thống đã tự động nộp bài.' : 'Đã nộp bài kiểm tra.',
      )
    } catch (error) {
      if (automatic) {
        setSaveStatus('Chưa thể tự nộp, hệ thống sẽ thử lại...')
        window.setTimeout(() => {
          autoSubmitStartedRef.current = false
        }, 5000)
      } else {
        autoSubmitStartedRef.current = false
        setSaveStatus('Nộp bài chưa thành công')
        showToast(apiErrorMessage(error), 'error')
      }
    } finally {
      saveInFlightRef.current = false
      setSaving(false)
    }
  }, [attemptId, finalizeResponse, showToast])

  useEffect(() => {
    submitCurrentAttemptRef.current = submitCurrentAttempt
  }, [submitCurrentAttempt])

  useEffect(() => {
    if (!attempt?.expiresAt || attempt.status !== 'IN_PROGRESS') return undefined

    function tick() {
      const seconds = Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000))
      setRemainingSeconds(seconds)
      if (seconds === 0 && !autoSubmitStartedRef.current) {
        autoSubmitStartedRef.current = true
        submitCurrentAttempt(true)
      }
    }

    const initialTimer = window.setTimeout(tick, 0)
    const interval = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    }
  }, [attempt?.expiresAt, attempt?.status, submitCurrentAttempt])

  const saveAnswers = useCallback(async (silent = false, force = false) => {
    const currentAttempt = attemptRef.current
    if (!currentAttempt || currentAttempt.status !== 'IN_PROGRESS') return
    if (!force && !dirtyRef.current) {
      if (!silent) showToast('Tất cả đáp án đã được lưu.', 'success')
      return
    }
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true
      return
    }

    const snapshot = { ...answersRef.current }
    saveInFlightRef.current = true
    if (silent) {
      setAutoSaving(true)
      setSaveStatus('Đang lưu tự động...')
    } else {
      setSaving(true)
      setSaveStatus('Đang lưu...')
    }
    try {
      const response = await myExamApi.saveAnswers(attemptId, toAnswerPayload(snapshot))
      const nextAttempt = apiData(response, currentAttempt)
      updateAttempt(nextAttempt)
      setLastSavedAt(new Date())

      if (nextAttempt?.status !== 'IN_PROGRESS') {
        finalizeResponse(nextAttempt, 'Đã hết giờ và hệ thống đã tự động nộp bài.')
        return
      }
      if (answersEqual(snapshot, answersRef.current)) {
        dirtyRef.current = false
        clearCachedAnswers(attemptId)
        setSaveStatus('Đã lưu')
      } else {
        dirtyRef.current = true
        persistCachedAnswers(attemptId, answersRef.current)
        pendingSaveRef.current = true
        setSaveStatus('Có thay đổi mới chưa lưu')
      }
      if (!silent) showToast('Đã lưu đáp án.', 'success')
    } catch (error) {
      dirtyRef.current = true
      persistCachedAnswers(attemptId, answersRef.current)
      setSaveStatus('Mất kết nối, đáp án đã được giữ trên thiết bị')
      if (!silent) showToast(apiErrorMessage(error), 'error')
    } finally {
      saveInFlightRef.current = false
      setAutoSaving(false)
      setSaving(false)
      if (pendingSaveRef.current && attemptRef.current?.status === 'IN_PROGRESS') {
        pendingSaveRef.current = false
        window.setTimeout(() => saveAnswersRef.current?.(true), 0)
      }
    }
  }, [attemptId, finalizeResponse, showToast, updateAttempt])

  useEffect(() => {
    saveAnswersRef.current = saveAnswers
  }, [saveAnswers])

  useEffect(() => {
    if (!isWritable || !dirtyRef.current) return undefined
    const timer = window.setTimeout(() => saveAnswers(true), AUTOSAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [answers, isWritable, saveAnswers])

  useEffect(() => {
    if (!isWritable) return undefined
    const interval = window.setInterval(() => {
      if (dirtyRef.current) saveAnswers(true)
    }, AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [isWritable, saveAnswers])

  useEffect(() => {
    if (!isWritable) return undefined
    const warnBeforeUnload = (event) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) {
        saveAnswers(true)
      }
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    document.addEventListener('visibilitychange', saveWhenHidden)
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
      document.removeEventListener('visibilitychange', saveWhenHidden)
    }
  }, [isWritable, saveAnswers])

  function selectAnswer(paperQuestionId, optionKey) {
    const nextAnswers = {
      ...answersRef.current,
      [paperQuestionId]: optionKey,
    }
    answersRef.current = nextAnswers
    dirtyRef.current = true
    persistCachedAnswers(attemptId, nextAnswers)
    setAnswers(nextAnswers)
    setSaveStatus('Chưa lưu')
  }

  function submitAttempt() {
    if (!isWritable) {
      showToast('Lượt làm bài không còn ở trạng thái có thể nộp.', 'warning')
      return
    }
    const warning = unansweredCount > 0
      ? `Bạn còn ${unansweredCount} câu chưa trả lời. Vẫn nộp bài?`
      : 'Nộp bài kiểm tra? Sau khi nộp không thể sửa đáp án.'
    if (!window.confirm(warning)) return
    submitCurrentAttempt(false)
  }

  function leaveExam() {
    if (dirtyRef.current) {
      saveAnswers(true, true)
    }
    navigate('/staff/exam/take')
  }

  function scrollToQuestion(questionId) {
    document.getElementById(`exam-question-${questionId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  function formatRemaining(seconds) {
    if (seconds === null || seconds === undefined) return '--:--'
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }

  const saveLabel = useMemo(() => {
    if (autoSaving) return 'Đang lưu tự động...'
    if (saveStatus) return saveStatus
    return 'Tự động lưu đang bật'
  }, [autoSaving, saveStatus])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Làm bài thi" />
        <div className="dashboard-layout__body">
          <div className="eh-page">
            {isLoading ? (
              <div className="eh-table-card eh-loading-state"><LoadingOutlined spin /> Đang tải bài kiểm tra...</div>
            ) : loadError ? (
              <div className="eh-table-card eh-loading-state">{loadError}</div>
            ) : (
              <>
                <div className="eh-header eh-detail-header eh-exam-toolbar">
                  <div>
                    <button type="button" className="eh-link-button" onClick={leaveExam}>
                      <ArrowLeftOutlined /> Danh sách bài kiểm tra
                    </button>
                    <h2 className="eh-page-title">{attempt?.examPaperName || 'Bài kiểm tra'}</h2>
                    <p className="eh-page-sub">Hạn lượt làm: {formatDateTime(attempt?.expiresAt)}</p>
                    <p className="eh-page-sub eh-save-indicator">
                      {saveLabel}
                      {lastSavedAt ? ` lúc ${lastSavedAt.toLocaleTimeString('vi-VN')}` : ''}
                    </p>
                  </div>
                  <div className="eh-exam-toolbar__right">
                    <div className={`eh-timer ${remainingSeconds !== null && remainingSeconds <= 300 ? 'eh-timer--warning' : ''}`}>
                      <span>Thời gian còn lại</span>
                      <strong>{formatRemaining(remainingSeconds)}</strong>
                    </div>
                    <div className="eh-actions">
                      <button className="eh-btn eh-btn--view" onClick={() => saveAnswers(false, true)} disabled={saving || autoSaving || !isWritable}>
                        <SaveOutlined /> Lưu
                      </button>
                      <button className="eh-btn eh-btn--retry" onClick={submitAttempt} disabled={saving || autoSaving || !isWritable}>
                        <SendOutlined /> Nộp bài
                      </button>
                    </div>
                  </div>
                </div>

                <section className="eh-table-card eh-exam-progress">
                  <div className="eh-exam-progress__summary">
                    <div>
                      <strong>{answeredCount}/{questions.length} câu đã trả lời</strong>
                      <span>{unansweredCount > 0 ? `Còn ${unansweredCount} câu chưa trả lời` : 'Đã trả lời tất cả câu hỏi'}</span>
                    </div>
                    <strong>{progressPercent}%</strong>
                  </div>
                  <div className="eh-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
                  <div className="eh-question-nav" aria-label="Điều hướng câu hỏi">
                    {questions.map((question) => (
                      <button
                        type="button"
                        key={question.paperQuestionId}
                        className={answers[question.paperQuestionId] ? 'is-answered' : ''}
                        onClick={() => scrollToQuestion(question.paperQuestionId)}
                        title={`Câu ${question.position}${answers[question.paperQuestionId] ? ' - đã trả lời' : ' - chưa trả lời'}`}
                      >
                        {answers[question.paperQuestionId] ? <CheckCircleOutlined /> : question.position}
                      </button>
                    ))}
                  </div>
                </section>

                {!isWritable && attempt && (
                  <div className="eh-table-card">
                    <div className="eh-answer-line">Lượt làm bài đã kết thúc, bạn không thể sửa hoặc nộp thêm đáp án.</div>
                  </div>
                )}

                {questions.map((question) => (
                  <section
                    id={`exam-question-${question.paperQuestionId}`}
                    key={question.paperQuestionId}
                    className="eh-table-card eh-question-review eh-exam-question"
                  >
                    <div className="eh-detail-header">
                      <strong>Câu {question.position}</strong>
                      <span>{answers[question.paperQuestionId] ? `Đã chọn ${answers[question.paperQuestionId]}` : 'Chưa trả lời'}</span>
                    </div>
                    <p>{question.stem}</p>
                    {['A', 'B', 'C', 'D'].map((optionKey) => (
                      <label
                        key={optionKey}
                        className={`eh-option-row ${answers[question.paperQuestionId] === optionKey ? 'eh-option-row--selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.paperQuestionId}`}
                          checked={answers[question.paperQuestionId] === optionKey}
                          disabled={!isWritable}
                          onChange={() => selectAnswer(question.paperQuestionId, optionKey)}
                        />
                        <span><strong>{optionKey}.</strong> {question[`option${optionKey}`]}</span>
                      </label>
                    ))}
                  </section>
                ))}

                {isWritable && questions.length > 0 && (
                  <div className="eh-exam-submit-bar">
                    <span>{unansweredCount > 0 ? `Còn ${unansweredCount} câu chưa trả lời` : 'Bạn đã hoàn thành tất cả câu hỏi'}</span>
                    <button className="eh-btn eh-btn--retry" onClick={submitAttempt} disabled={saving || autoSaving}>
                      <SendOutlined /> Nộp bài kiểm tra
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExamTakeScreen
