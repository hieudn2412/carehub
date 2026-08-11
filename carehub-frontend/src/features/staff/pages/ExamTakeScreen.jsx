import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  FlagFilled,
  FlagOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx'
import {
  EXAM_TIMER_CONTRACT_ERROR,
  createMonotonicDeadline,
  secondsUntil,
  resolveRemainingSeconds,
} from '../utils/examTimer.js'

const AUTOSAVE_DEBOUNCE_MS = 1200
const AUTOSAVE_INTERVAL_MS = 15000
const REVIEW_SCORE_FORMATTER = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function cacheKey(attemptId) {
  return `carehub-exam-draft:${attemptId}`
}

function flagCacheKey(attemptId) {
  return `carehub-exam-flags:${attemptId}`
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

function readCachedFlags(attemptId, validQuestionIds) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(flagCacheKey(attemptId)) || '[]')
    return new Set(
      (Array.isArray(cached) ? cached : [])
        .map(Number)
        .filter(questionId => validQuestionIds.has(questionId)),
    )
  } catch {
    return new Set()
  }
}

function persistCachedFlags(attemptId, flags) {
  try {
    window.localStorage.setItem(flagCacheKey(attemptId), JSON.stringify([...flags]))
  } catch {
    // Flags remain available in memory for the current page.
  }
}

function clearCachedAnswers(attemptId) {
  try {
    window.localStorage.removeItem(cacheKey(attemptId))
    window.localStorage.removeItem(flagCacheKey(attemptId))
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

function formatReviewScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  const score = Number(value)
  return Number.isFinite(score) ? REVIEW_SCORE_FORMATTER.format(score) : '—'
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
  const location = useLocation()
  const { showToast } = useToast()
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [timerContractError, setTimerContractError] = useState('')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [loadError, setLoadError] = useState('')
  const [confirmSubmitMessage, setConfirmSubmitMessage] = useState(null)
  const [flaggedQuestions, setFlaggedQuestions] = useState(new Set())
  const [isNavbarHidden, setIsNavbarHidden] = useState(false)

  const attemptRef = useRef(null)
  const answersRef = useRef({})
  const dirtyRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const autoSubmitStartedRef = useRef(false)
  const timerDeadlineRef = useRef(null)
  const submitCurrentAttemptRef = useRef(null)
  const saveAnswersRef = useRef(null)

  const updateAttempt = useCallback((nextAttempt) => {
    attemptRef.current = nextAttempt
    setAttempt(nextAttempt)
  }, [])

  const syncTimer = useCallback((nextAttempt) => {
    if (!nextAttempt || nextAttempt.status !== 'IN_PROGRESS') {
      timerDeadlineRef.current = null
      setRemainingSeconds(null)
      setTimerContractError('')
      return true
    }

    try {
      const nextRemainingSeconds = resolveRemainingSeconds(nextAttempt)
      timerDeadlineRef.current = createMonotonicDeadline(nextRemainingSeconds, performance.now())
      setRemainingSeconds(secondsUntil(timerDeadlineRef.current, performance.now()))
      setTimerContractError('')
      return true
    } catch {
      timerDeadlineRef.current = null
      setRemainingSeconds(null)
      setTimerContractError(EXAM_TIMER_CONTRACT_ERROR)
      return false
    }
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
        const cachedFlags = data?.status === 'IN_PROGRESS'
          ? readCachedFlags(attemptId, questionIds)
          : new Set()
        const mergedAnswers = { ...serverAnswers, ...cachedAnswers }
        const recoveredDraft = !answersEqual(serverAnswers, mergedAnswers)

        updateAttempt(data)
        answersRef.current = mergedAnswers
        dirtyRef.current = recoveredDraft
        setAnswers(mergedAnswers)
        setFlaggedQuestions(cachedFlags)
        syncTimer(data)
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
  }, [attemptId, showToast, syncTimer, updateAttempt])

  const questions = attempt?.questions || []
  const reviewMode = Boolean(attempt && attempt.status !== 'IN_PROGRESS')
  const reviewAnswers = useMemo(() => new Map(
    (attempt?.answers || []).map(answer => [Number(answer.paperQuestionId), answer]),
  ), [attempt?.answers])
  const answeredCount = Object.keys(answers).length
  const unansweredCount = Math.max(0, questions.length - answeredCount)
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0
  const isWritable = attempt?.status === 'IN_PROGRESS'
    && !timerContractError
    && remainingSeconds !== null
    && remainingSeconds > 0

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
        setSaveStatus('Chưa thể tự nộp bài. Vui lòng kiểm tra kết nối và tải lại.')
      } else {
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
    if (attempt?.status !== 'IN_PROGRESS' || timerContractError || timerDeadlineRef.current === null) {
      return undefined
    }

    function tick() {
      const seconds = secondsUntil(timerDeadlineRef.current, performance.now())
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
  }, [attempt?.status, submitCurrentAttempt, timerContractError])

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
      syncTimer(nextAttempt)
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
  }, [attemptId, finalizeResponse, showToast, syncTimer, updateAttempt])

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
    setConfirmSubmitMessage(warning)
  }

  function toggleQuestionFlag(questionId) {
    if (!isWritable) return
    setFlaggedQuestions(current => {
      const next = new Set(current)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      persistCachedFlags(attemptId, next)
      return next
    })
  }

  function leaveExam() {
    if (dirtyRef.current && !reviewMode) {
      saveAnswers(true, true)
    }
    navigate(location.state?.from || '/staff/exam/take')
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
    <AppShell
      back={{ onClick: leaveExam, label: 'Quay lại' }}
      title={reviewMode ? 'Xem lại bài kiểm tra' : 'Làm bài thi'}
      hideSidebar={isNavbarHidden}
    >
      <div className="eh-page eh-exam-page">
        {isLoading ? (
          <div className="eh-table-card eh-loading-state"><LoadingOutlined spin /> Đang tải bài kiểm tra...</div>
        ) : loadError ? (
          <div className="eh-table-card eh-loading-state">{loadError}</div>
        ) : (
          <>
            <div className="eh-header eh-detail-header eh-exam-toolbar">
              <div>
                <h2 className="eh-page-title">{attempt?.assignmentName || attempt?.examPaperName || 'Bài kiểm tra'}</h2>
                <p className="eh-page-sub">{reviewMode ? `Đã hoàn tất: ${formatDateTime(attempt?.submittedAt)}` : `Hạn lượt làm: ${formatDateTime(attempt?.expiresAt)}`}</p>
                <p className="eh-page-sub eh-save-indicator">
                  {saveLabel}
                  {lastSavedAt ? ` lúc ${lastSavedAt.toLocaleTimeString('vi-VN')}` : ''}
                </p>
              </div>
                <div className="eh-exam-toolbar__right">
                <button
                  type="button"
                  className="eh-btn eh-btn--view eh-navbar-toggle"
                  onClick={() => setIsNavbarHidden(current => !current)}
                  aria-pressed={isNavbarHidden}
                  title={isNavbarHidden ? 'Hiện thanh điều hướng' : 'Ẩn thanh điều hướng'}
                >
                  {isNavbarHidden ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  {isNavbarHidden ? 'Hiện navbar' : 'Ẩn navbar'}
                </button>
                {reviewMode ? (
                  <div className="eh-review-score" aria-label="Kết quả bài kiểm tra">
                    <span>Điểm</span>
                    <strong>{formatReviewScore(attempt?.score)}/10</strong>
                  </div>
                ) : (
                  <div className={`eh-timer ${remainingSeconds !== null && remainingSeconds <= 300 ? 'eh-timer--warning' : ''}`}>
                    <span>{timerContractError ? 'Lỗi đồng bộ thời gian' : 'Thời gian còn lại'}</span>
                    <strong>{timerContractError ? '--:--' : formatRemaining(remainingSeconds)}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="eh-exam-workspace">
              <aside className="eh-table-card eh-exam-progress eh-exam-side-panel">
                <div className="eh-exam-progress__summary">
                  <div>
                    <strong>{answeredCount}/{questions.length} câu đã trả lời</strong>
                    <span>{unansweredCount > 0 ? `Còn ${unansweredCount} câu chưa trả lời` : 'Đã trả lời tất cả câu hỏi'}</span>
                  </div>
                  <strong>{progressPercent}%</strong>
                </div>
                <div className="eh-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
                <div className="eh-question-nav" aria-label="Điều hướng câu hỏi">
                  {questions.map((question) => {
                    const isAnswered = Boolean(answers[question.paperQuestionId])
                    const isFlagged = flaggedQuestions.has(question.paperQuestionId)
                    return (
                      <button
                        type="button"
                        key={question.paperQuestionId}
                        className={`${isAnswered ? 'is-answered' : ''}${isFlagged ? ' is-flagged' : ''}`}
                        onClick={() => scrollToQuestion(question.paperQuestionId)}
                        aria-label={`Câu ${question.position}${isAnswered ? ', đã trả lời' : ', chưa trả lời'}${isFlagged ? ', đã đánh dấu' : ''}`}
                        title={`Câu ${question.position}${isAnswered ? ' - đã trả lời' : ' - chưa trả lời'}${isFlagged ? ' - đã đánh dấu' : ''}`}
                      >
                        {question.position}
                      </button>
                    )
                  })}
                </div>
                <div className="eh-question-nav-legend" aria-label="Chú thích trạng thái câu hỏi">
                  <span><i className="is-answered" /> Đã trả lời</span>
                  <span><i className="is-flagged" /> Đã đánh dấu</span>
                </div>
                {reviewMode ? (
                  <div className="eh-review-summary" role="status">
                    <strong>{attempt?.passed ? 'Đạt' : 'Chưa đạt'}</strong>
                    <span>{attempt?.correctCount ?? 0}/{attempt?.totalQuestions ?? questions.length} câu đúng</span>
                  </div>
                ) : (
                  <div className="eh-exam-side-actions">
                    <button className="eh-btn eh-btn--view" onClick={() => saveAnswers(false, true)} disabled={saving || autoSaving || !isWritable}>
                      <SaveOutlined /> Lưu bài
                    </button>
                    <button className="eh-btn eh-btn--retry" onClick={submitAttempt} disabled={saving || autoSaving || !isWritable}>
                      <SendOutlined /> Nộp bài
                    </button>
                  </div>
                )}
              </aside>

              <div className="eh-exam-question-list">
                {!isWritable && attempt && !reviewMode && (
                  <div className="eh-table-card">
                    <div className="eh-answer-line">
                      {timerContractError || (remainingSeconds === null
                        ? 'Đang đồng bộ thời gian bài thi...'
                        : 'Lượt làm bài đã kết thúc, bạn không thể sửa hoặc nộp thêm đáp án.')}
                    </div>
                  </div>
                )}

                {reviewMode && (
                  <div className="eh-table-card eh-review-banner">
                    <strong>Bạn đang xem lại bài làm</strong>
                    <span>Đáp án đã khóa sau khi nộp bài. Kết quả và đáp án đúng sẽ hiển thị theo cấu hình của bài kiểm tra.</span>
                  </div>
                )}

                {questions.map((question) => {
                  const isFlagged = flaggedQuestions.has(question.paperQuestionId)
                  const reviewAnswer = reviewAnswers.get(Number(question.paperQuestionId))
                  return (
                    <section
                      id={`exam-question-${question.paperQuestionId}`}
                      key={question.paperQuestionId}
                      className={`eh-table-card eh-question-review eh-exam-question${isFlagged ? ' eh-exam-question--flagged' : ''}`}
                    >
                      <div className="eh-detail-header">
                        <div className="eh-question-heading">
                          <strong>Câu {question.position}</strong>
                          <button
                            type="button"
                            className={`eh-question-flag${isFlagged ? ' is-flagged' : ''}`}
                            onClick={() => toggleQuestionFlag(question.paperQuestionId)}
                            disabled={!isWritable}
                            aria-pressed={isFlagged}
                            aria-label={`${isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu'} câu ${question.position}`}
                          >
                            {isFlagged ? <FlagFilled /> : <FlagOutlined />}
                            {isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}
                          </button>
                        </div>
                        <span>{answers[question.paperQuestionId] ? `Đã chọn ${answers[question.paperQuestionId]}` : 'Chưa trả lời'}</span>
                      </div>
                      <p>{question.stem}</p>
                      {['A', 'B', 'C', 'D'].map((optionKey) => {
                        const isSelected = answers[question.paperQuestionId] === optionKey
                        const isCorrect = reviewMode && reviewAnswer?.correctAnswer === optionKey
                        const isWrongSelection = reviewMode && isSelected && reviewAnswer?.correctAnswer && reviewAnswer.correctAnswer !== optionKey
                        return (
                        <label
                          key={optionKey}
                          className={`eh-option-row ${isSelected ? 'eh-option-row--selected' : ''}${isCorrect ? ' eh-option-row--correct' : ''}${isWrongSelection ? ' eh-option-row--incorrect' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.paperQuestionId}`}
                            checked={answers[question.paperQuestionId] === optionKey}
                            disabled={!isWritable}
                            onChange={() => selectAnswer(question.paperQuestionId, optionKey)}
                          />
                          <span><strong>{optionKey}.</strong> {question[`option${optionKey}`]}</span>
                          {isCorrect && <small className="eh-option-review-label">Đáp án đúng</small>}
                          {isWrongSelection && <small className="eh-option-review-label">Bạn đã chọn</small>}
                        </label>
                        )
                      })}
                    </section>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {confirmSubmitMessage && (
        <ConfirmDialog
          title="Nộp bài kiểm tra"
          message={confirmSubmitMessage}
          confirmLabel="Nộp bài"
          onConfirm={() => {
            setConfirmSubmitMessage(null)
            submitCurrentAttempt(false)
          }}
          onCancel={() => setConfirmSubmitMessage(null)}
        />
      )}
    </AppShell>
  )
}

export default ExamTakeScreen
