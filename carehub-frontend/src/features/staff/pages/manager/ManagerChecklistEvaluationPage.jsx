import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  LeftOutlined,
  LoadingOutlined,
  MenuOutlined,
  RightOutlined,
  SyncOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import SearchableSelect from '../../../../shared/components/SearchableSelect.jsx'
import ConfirmModal from '../../../admin/components/ConfirmModal.jsx'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { staffApi } from '../../api/staffApi.js'
import { adminApi } from '../../../admin/api/adminApi.js'
import '../../styles/ManagerPages.css'
import '../../styles/ChecklistEvaluationPage.css'

const AUTO_SAVE_DELAY = 800

function sortByDisplayOrder(items = []) {
  return [...items].sort((left, right) => (left.displayOrder || 0) - (right.displayOrder || 0))
}

function hasAnswerValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function getChecklistDetailError(error) {
  const statusCode = error?.response?.status
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.'
  if (statusCode === 403) return 'Bạn không có quyền truy cập quy trình này hoặc phân quyền đã hết hiệu lực.'
  if (statusCode === 404) return 'Không tìm thấy quy trình được phân quyền.'
  return error?.response?.data?.message || 'Không thể tải quy trình được phân quyền.'
}

function getPageContent(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return data
  return Array.isArray(data?.content) ? data.content : []
}

function answerMapFromSubmission(submission) {
  return (submission?.answers || []).reduce((result, answer) => {
    const value = answer?.value || {}
    if (answer?.optionKey || value.optionKey) {
      result[answer.questionKey] = String(answer.optionKey || value.optionKey)
    } else if (Array.isArray(value.optionKeys)) {
      result[answer.questionKey] = value.optionKeys.map(String)
    } else if (value.numberValue !== undefined && value.numberValue !== null) {
      result[answer.questionKey] = String(value.numberValue)
    } else if (value.dateValue) {
      result[answer.questionKey] = value.dateValue
    } else if (value.timeValue) {
      result[answer.questionKey] = value.timeValue
    } else if (value.textValue !== undefined && value.textValue !== null) {
      result[answer.questionKey] = String(value.textValue)
    }
    return result
  }, {})
}

function toAnswerRequest(question, answerMap) {
  const value = answerMap[question.questionKey]
  if (!hasAnswerValue(value)) return null

  switch (question.fieldType) {
    case 'SINGLE_CHOICE':
    case 'DROPDOWN':
      return { questionKey: question.questionKey, optionKey: value }
    case 'MULTIPLE_CHOICE':
      return { questionKey: question.questionKey, optionKeys: value }
    case 'NUMBER':
    case 'LINEAR_SCALE':
      return { questionKey: question.questionKey, numberValue: Number(value) }
    case 'DATE':
      return { questionKey: question.questionKey, dateValue: value }
    case 'TIME':
      return { questionKey: question.questionKey, timeValue: value }
    default:
      return { questionKey: question.questionKey, textValue: String(value) }
  }
}

function serializeAnswers(value) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  )
}

function ManagerChecklistEvaluationPage() {
  const { id, versionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isDirectAdminEvaluation = Boolean(versionId)
  const isStaffEvaluation = location.pathname.startsWith('/staff/')
  const listPath = isDirectAdminEvaluation
    ? '/admin/quality/checklists'
    : isStaffEvaluation
      ? '/staff/checklists'
      : '/manager/quality/checklists'

  const [assignedForm, setAssignedForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [step, setStep] = useState('subject')
  const [subjectQuery, setSubjectQuery] = useState('')
  const [subjectOptions, setSubjectOptions] = useState([])
  const [subjectSearchLoading, setSubjectSearchLoading] = useState(false)
  const [subjectSearchError, setSubjectSearchError] = useState('')
  const [selectedSubjectUserId, setSelectedSubjectUserId] = useState('')
  const [subjectDetails, setSubjectDetails] = useState(null)
  const [subjectError, setSubjectError] = useState('')
  const [draftPreview, setDraftPreview] = useState(null)
  const [draftPreviewLoading, setDraftPreviewLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [answers, setAnswers] = useState({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [missingQuestionKeys, setMissingQuestionKeys] = useState(new Set())
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState('')
  const [revision, setRevision] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const subjectSearchSequence = useRef(0)
  const draftPreviewSequence = useRef(0)
  const answersRef = useRef({})
  const submissionRef = useRef(null)
  const revisionRef = useRef(0)
  const savedRevisionRef = useRef(0)
  const lastSavedAnswersRef = useRef('{}')
  const saveTimerRef = useRef(null)
  const saveQueueRef = useRef(Promise.resolve())

  const loadAssignedForm = useCallback(() => {
    setLoading(true)
    setErrorMessage('')
    const request = isDirectAdminEvaluation
      ? adminApi.getFormVersionById(id, versionId)
      : staffApi.getAssignedForm(id)

    request
      .then((response) => {
        const responseData = response.data?.data
        const data = isDirectAdminEvaluation
          ? { formId: Number(id), formCode: responseData?.formCode, title: responseData?.title, version: responseData }
          : responseData
        if (!data?.version) throw new Error('INVALID_ASSIGNED_FORM_RESPONSE')
        setAssignedForm(data)
      })
      .catch((error) => {
        setAssignedForm(null)
        setErrorMessage(getChecklistDetailError(error))
      })
      .finally(() => setLoading(false))
  }, [id, isDirectAdminEvaluation, versionId])

  useEffect(() => {
    const timer = window.setTimeout(loadAssignedForm, 0)
    return () => window.clearTimeout(timer)
  }, [loadAssignedForm])

  const sections = useMemo(
    () => sortByDisplayOrder(assignedForm?.version?.sections || []),
    [assignedForm],
  )

  const questionEntries = useMemo(() => sections.flatMap((section) =>
    sortByDisplayOrder(section.items || [])
      .filter((item) => item.itemType === 'QUESTION' && item.question && !item.question.readOnly)
      .map((item) => ({ question: item.question, sectionTitle: section.title || 'Nội dung đánh giá' })),
  ), [sections])

  const questions = useMemo(() => questionEntries.map((entry) => entry.question), [questionEntries])
  const currentEntry = questionEntries[currentQuestionIndex] || null
  const answeredCount = useMemo(
    () => questions.filter((question) => hasAnswerValue(answers[question.questionKey])).length,
    [answers, questions],
  )
  const completionPercent = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100)

  const draftParams = useCallback((subjectUserId) => ({
    ...(isDirectAdminEvaluation
      ? { formVersionId: Number(versionId) }
      : { assignmentItemId: Number(id) }),
    subjectUserId: Number(subjectUserId),
  }), [id, isDirectAdminEvaluation, versionId])

  useEffect(() => {
    const sequence = ++subjectSearchSequence.current
    const timer = window.setTimeout(() => {
      setSubjectSearchLoading(true)
      setSubjectSearchError('')
      staffApi.searchFormSubjects({
        assignmentItemId: isDirectAdminEvaluation ? undefined : Number(id),
        keyword: subjectQuery.trim() || undefined,
        page: 0,
        size: 20,
      })
        .then((response) => {
          if (sequence !== subjectSearchSequence.current) return
          setSubjectOptions(getPageContent(response).map((subject) => ({
            value: subject.userId,
            label: `${subject.fullName || 'Chưa có tên'} (${subject.employeeCode})`,
            description: [subject.department, subject.position].filter(Boolean).join(' · ') || 'Chưa có thông tin đơn vị',
            searchText: `${subject.employeeCode} ${subject.department || ''} ${subject.position || ''}`,
            subject,
          })))
        })
        .catch(() => {
          if (sequence !== subjectSearchSequence.current) return
          setSubjectOptions([])
          setSubjectSearchError('Không thể tải danh sách nhân viên. Vui lòng nhập lại để thử lại.')
        })
        .finally(() => {
          if (sequence === subjectSearchSequence.current) setSubjectSearchLoading(false)
        })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [id, isDirectAdminEvaluation, subjectQuery])

  const selectedSubjectOption = useMemo(() => subjectDetails ? {
    value: subjectDetails.userId,
    label: `${subjectDetails.fullName || 'Chưa có tên'} (${subjectDetails.employeeCode})`,
    description: [subjectDetails.department, subjectDetails.position].filter(Boolean).join(' · '),
  } : null, [subjectDetails])

  const previewDraft = useCallback((subject) => {
    const sequence = ++draftPreviewSequence.current
    setDraftPreviewLoading(true)
    setSubjectError('')
    staffApi.getFormSubmissionDraft(draftParams(subject.userId))
      .then((response) => {
        if (sequence === draftPreviewSequence.current) setDraftPreview(response.status === 204 ? null : response.data?.data || null)
      })
      .catch((error) => {
        if (sequence !== draftPreviewSequence.current) return
        setDraftPreview(null)
        setSubjectError(error?.response?.data?.message || 'Không thể kiểm tra bản nháp hiện tại.')
      })
      .finally(() => {
        if (sequence === draftPreviewSequence.current) setDraftPreviewLoading(false)
      })
  }, [draftParams])

  const selectSubject = (subjectUserId) => {
    const option = subjectOptions.find((item) => String(item.value) === String(subjectUserId))
    setSelectedSubjectUserId(subjectUserId)
    setSubjectDetails(option?.subject || null)
    setDraftPreview(null)
    setSubjectError(option ? '' : 'Không tìm thấy thông tin nhân viên đã chọn.')
    if (option?.subject) previewDraft(option.subject)
  }

  const enterEvaluation = () => {
    if (!subjectDetails || draftPreviewLoading) return
    setStarting(true)
    const restoredAnswers = answerMapFromSubmission(draftPreview)
    answersRef.current = restoredAnswers
    submissionRef.current = draftPreview
    revisionRef.current = 0
    savedRevisionRef.current = 0
    lastSavedAnswersRef.current = serializeAnswers(restoredAnswers)
    saveQueueRef.current = Promise.resolve()
    setAnswers(restoredAnswers)
    setRevision(0)
    setSaveStatus(draftPreview ? 'saved' : 'idle')
    setSaveError('')
    setMissingQuestionKeys(new Set())
    const firstUnanswered = questions.findIndex((question) => !hasAnswerValue(restoredAnswers[question.questionKey]))
    setCurrentQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
    setStep('evaluation')
    setStarting(false)
  }

  const createDraft = useCallback(async () => {
    try {
      const response = await staffApi.createFormSubmission({
        ...(isDirectAdminEvaluation
          ? { formVersionId: Number(versionId) }
          : { assignmentItemId: Number(id) }),
        subject: { type: 'USER', userId: Number(subjectDetails.userId) },
      })
      return response.data?.data
    } catch (error) {
      if (error?.response?.status !== 409) throw error
      const response = await staffApi.getFormSubmissionDraft(draftParams(subjectDetails.userId))
      if (response.status === 204 || !response.data?.data) throw error
      const recoveredDraft = response.data.data
      if (serializeAnswers(answerMapFromSubmission(recoveredDraft)) !== lastSavedAnswersRef.current) {
        const conflict = new Error('DRAFT_CONFLICT')
        conflict.code = 'DRAFT_CONFLICT'
        throw conflict
      }
      return recoveredDraft
    }
  }, [draftParams, id, isDirectAdminEvaluation, subjectDetails, versionId])

  const persistSnapshot = useCallback(async (snapshot) => {
    let currentSubmission = submissionRef.current
    if (!currentSubmission?.id) {
      currentSubmission = await createDraft()
      submissionRef.current = currentSubmission
      const serverAnswers = answerMapFromSubmission(currentSubmission)
      if (Object.keys(serverAnswers).length > 0 && lastSavedAnswersRef.current === '{}') {
        lastSavedAnswersRef.current = serializeAnswers(serverAnswers)
      }
    }

    const save = (draft) => staffApi.updateFormSubmission(draft.id, {
      lockVersion: draft.lockVersion,
      answers: questions.map((question) => toAnswerRequest(question, snapshot)).filter(Boolean),
    })

    try {
      const response = await save(currentSubmission)
      return response.data?.data
    } catch (error) {
      if (error?.response?.status !== 409) throw error
      const draftResponse = await staffApi.getFormSubmissionDraft(draftParams(subjectDetails.userId))
      const latestDraft = draftResponse.status === 204 ? null : draftResponse.data?.data
      if (!latestDraft) throw error
      const latestAnswers = answerMapFromSubmission(latestDraft)
      if (serializeAnswers(latestAnswers) !== lastSavedAnswersRef.current) {
        const conflict = new Error('DRAFT_CONFLICT')
        conflict.code = 'DRAFT_CONFLICT'
        throw conflict
      }
      const retryResponse = await save(latestDraft)
      return retryResponse.data?.data
    }
  }, [createDraft, draftParams, questions, subjectDetails])

  const queueSave = useCallback((snapshot, targetRevision, force = false) => {
    const task = async () => {
      if (!force && targetRevision <= savedRevisionRef.current) return submissionRef.current
      setSaveStatus('saving')
      setSaveError('')
      try {
        const updatedSubmission = await persistSnapshot(snapshot)
        submissionRef.current = updatedSubmission
        savedRevisionRef.current = Math.max(savedRevisionRef.current, targetRevision)
        lastSavedAnswersRef.current = serializeAnswers(answerMapFromSubmission(updatedSubmission))
        setSaveStatus(revisionRef.current <= targetRevision ? 'saved' : 'dirty')
        return updatedSubmission
      } catch (error) {
        const message = error?.code === 'DRAFT_CONFLICT'
          ? 'Bản nháp đã được thay đổi ở nơi khác. Vui lòng tải lại trang trước khi tiếp tục.'
          : error?.response?.data?.message || 'Không thể tự động lưu bản nháp.'
        setSaveStatus('error')
        setSaveError(message)
        throw error
      }
    }
    const queued = saveQueueRef.current.catch(() => undefined).then(task)
    saveQueueRef.current = queued
    return queued
  }, [persistSnapshot])

  useEffect(() => {
    if (step !== 'evaluation' || revision <= savedRevisionRef.current) return undefined
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      queueSave({ ...answersRef.current }, revisionRef.current).catch(() => undefined)
    }, AUTO_SAVE_DELAY)
    return () => window.clearTimeout(saveTimerRef.current)
  }, [queueSave, revision, step])

  const handleAnswerChange = useCallback((questionKey, value) => {
    setAnswers((currentAnswers) => {
      const nextAnswers = { ...currentAnswers, [questionKey]: value }
      answersRef.current = nextAnswers
      return nextAnswers
    })
    const nextRevision = revisionRef.current + 1
    revisionRef.current = nextRevision
    setRevision(nextRevision)
    setSaveStatus('dirty')
    setSaveError('')
    setMissingQuestionKeys((current) => {
      if (!current.has(questionKey) || !hasAnswerValue(value)) return current
      const next = new Set(current)
      next.delete(questionKey)
      return next
    })
  }, [])

  const flushSave = useCallback((force = false) => {
    window.clearTimeout(saveTimerRef.current)
    return queueSave({ ...answersRef.current }, revisionRef.current, force)
  }, [queueSave])

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (step !== 'evaluation' || (revisionRef.current <= savedRevisionRef.current && saveStatus !== 'saving' && saveStatus !== 'error')) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [saveStatus, step])

  const requestSubmit = () => {
    const missing = questions.filter((question) => question.required && !hasAnswerValue(answersRef.current[question.questionKey]))
    if (missing.length > 0) {
      const keys = new Set(missing.map((question) => question.questionKey))
      setMissingQuestionKeys(keys)
      const firstMissingIndex = questions.findIndex((question) => keys.has(question.questionKey))
      setCurrentQuestionIndex(Math.max(0, firstMissingIndex))
      setMobileDrawerOpen(false)
      showToast(`Vui lòng hoàn thành ${missing.length} câu hỏi bắt buộc.`, 'warning')
      return
    }
    setSubmitConfirmOpen(true)
  }

  const confirmSubmit = async () => {
    setSubmitConfirmOpen(false)
    try {
      setSubmitting(true)
      const updatedSubmission = await flushSave(true)
      await staffApi.submitFormSubmission(updatedSubmission.id, { lockVersion: updatedSubmission.lockVersion })
      savedRevisionRef.current = revisionRef.current
      showToast('Đã nộp kết quả đánh giá quy trình.', 'success')
      navigate(listPath)
    } catch (error) {
      if (error?.code !== 'DRAFT_CONFLICT') {
        showToast(error?.response?.data?.message || 'Không thể nộp kết quả đánh giá. Vui lòng thử lại.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const changeSubject = async () => {
    try {
      if (saveStatus === 'saving' || saveStatus === 'error' || revisionRef.current > savedRevisionRef.current) {
        await flushSave(true)
      }
      setStep('subject')
      setMobileDrawerOpen(false)
    } catch {
      showToast('Chưa thể lưu bản nháp. Vui lòng thử lại trước khi đổi nhân viên.', 'error')
    }
  }

  const renderQuestionField = (question) => {
    const value = answers[question.questionKey] ?? ''
    const options = sortByDisplayOrder(question.options || [])
    switch (question.fieldType) {
      case 'SINGLE_CHOICE':
        return <div className="check-eval-options">{options.map((option) => (
          <label className={`check-eval-option${value === option.optionKey ? ' is-selected' : ''}`} key={option.optionKey}>
            <input checked={value === option.optionKey} name={question.questionKey} onChange={() => handleAnswerChange(question.questionKey, option.optionKey)} type="radio" />
            <span>{option.label}</span>
          </label>
        ))}</div>
      case 'MULTIPLE_CHOICE': {
        const selected = Array.isArray(value) ? value : []
        return <div className="check-eval-options">{options.map((option) => (
          <label className={`check-eval-option${selected.includes(option.optionKey) ? ' is-selected' : ''}`} key={option.optionKey}>
            <input checked={selected.includes(option.optionKey)} onChange={() => handleAnswerChange(question.questionKey, selected.includes(option.optionKey) ? selected.filter((key) => key !== option.optionKey) : [...selected, option.optionKey])} type="checkbox" />
            <span>{option.label}</span>
          </label>
        ))}</div>
      }
      case 'DROPDOWN':
        return <select className="check-eval-input" onChange={(event) => handleAnswerChange(question.questionKey, event.target.value)} value={value}><option value="">Chọn một đáp án</option>{options.map((option) => <option key={option.optionKey} value={option.optionKey}>{option.label}</option>)}</select>
      case 'LONG_TEXT':
        return <textarea className="check-eval-input check-eval-textarea" onChange={(event) => handleAnswerChange(question.questionKey, event.target.value)} placeholder="Nhập câu trả lời..." value={value} />
      case 'NUMBER':
      case 'LINEAR_SCALE':
        return <input className="check-eval-input check-eval-input--short" onChange={(event) => handleAnswerChange(question.questionKey, event.target.value)} placeholder="Nhập số" type="number" value={value} />
      case 'DATE':
        return <input className="check-eval-input check-eval-input--short" onChange={(event) => handleAnswerChange(question.questionKey, event.target.value)} type="date" value={value} />
      case 'TIME':
        return <input className="check-eval-input check-eval-input--short" onChange={(event) => handleAnswerChange(question.questionKey, event.target.value)} type="time" value={value} />
      default:
        return <input className="check-eval-input" onChange={(event) => handleAnswerChange(question.questionKey, event.target.value)} placeholder="Nhập câu trả lời" type="text" value={value} />
    }
  }

  const questionNavigator = (compact = false) => (
    <div className={`check-eval-navigator${compact ? ' check-eval-navigator--compact' : ''}`}>
      <div className="check-eval-panel-title"><span>Danh sách câu</span><strong>{answeredCount}/{questions.length}</strong></div>
      <div className="check-eval-question-grid">{questions.map((question, index) => {
        const answered = hasAnswerValue(answers[question.questionKey])
        const missing = missingQuestionKeys.has(question.questionKey)
        return <button
          aria-current={index === currentQuestionIndex ? 'step' : undefined}
          aria-label={`Đi đến câu ${index + 1}${answered ? ', đã trả lời' : ', chưa trả lời'}`}
          className={`check-eval-question-number${answered ? ' is-answered' : ''}${missing ? ' is-missing' : ''}${index === currentQuestionIndex ? ' is-current' : ''}`}
          key={question.questionKey}
          onClick={() => { setCurrentQuestionIndex(index); setMobileDrawerOpen(false) }}
          type="button"
        >{index + 1}</button>
      })}</div>
      <div className="check-eval-legend"><span><i className="is-answered" />Đã trả lời</span><span><i />Chưa trả lời</span><span><i className="is-current" />Đang chọn</span>{missingQuestionKeys.size > 0 && <span><i className="is-missing" />Bắt buộc</span>}</div>
    </div>
  )

  const progressAndSubject = (
    <div className="check-eval-summary-content">
      <div className="check-eval-panel-title"><span>Tiến độ</span><strong>{completionPercent}%</strong></div>
      <div className="check-eval-progress"><span style={{ width: `${completionPercent}%` }} /></div>
      <dl className="check-eval-progress-stats"><div><dt>Tổng số câu</dt><dd>{questions.length}</dd></div><div><dt>Đã trả lời</dt><dd>{answeredCount}</dd></div><div><dt>Chưa trả lời</dt><dd>{questions.length - answeredCount}</dd></div></dl>
      <div className="check-eval-subject-summary">
        <span>Nhân viên được đánh giá</span>
        <strong>{subjectDetails?.fullName || 'Chưa có tên'} ({subjectDetails?.employeeCode})</strong>
        <small>{subjectDetails?.department || 'Chưa có khoa/phòng'}</small>
        {subjectDetails?.position && <small>{subjectDetails.position}</small>}
        <button onClick={changeSubject} type="button"><UserSwitchOutlined /> Đổi nhân viên</button>
      </div>
      <button className="check-eval-submit" disabled={submitting || saveStatus === 'saving' || saveStatus === 'error'} onClick={requestSubmit} type="button">{submitting ? <LoadingOutlined spin /> : <CheckCircleOutlined />} Nộp kết quả</button>
    </div>
  )

  const renderSaveStatus = () => {
    if (saveStatus === 'saving') return <span className="check-eval-save-status is-saving"><SyncOutlined spin /> Đang lưu...</span>
    if (saveStatus === 'error') return <span className="check-eval-save-status is-error"><ExclamationCircleOutlined /> {saveError}<button onClick={() => flushSave(true).catch(() => undefined)} type="button">Thử lại</button></span>
    if (saveStatus === 'saved') return <span className="check-eval-save-status is-saved"><CheckCircleOutlined /> Đã lưu</span>
    if (saveStatus === 'dirty') return <span className="check-eval-save-status">Chờ tự động lưu...</span>
    return <span className="check-eval-save-status">Bản nháp sẽ được tự động lưu</span>
  }

  return (
    <AppShell className={step === 'evaluation' ? 'check-eval-shell check-eval-shell--active' : 'check-eval-shell'} back={{ to: listPath, label: 'Quay lại' }} breadcrumbs={[{ label: isStaffEvaluation ? 'Bảng kiểm được giao' : 'Tuân thủ quy trình, quy định', link: listPath }, { label: 'Thực hiện đánh giá' }]}>
      {loading ? <div className="mgr-card"><LoadingState label="Đang tải quy trình..." /></div> : errorMessage ? <div className="mgr-card" role="alert" style={{ color: '#b42318' }}>{errorMessage}</div> : step === 'subject' ? (
        <section className="check-eval-subject-step">
          <header><span>BƯỚC 1/2</span><h1>Chọn nhân viên được đánh giá</h1><p>{assignedForm?.title} · Phiên bản v{assignedForm?.version?.versionNumber}</p></header>
          <div className="check-eval-subject-card">
            <label htmlFor="check-eval-subject-search">Người được đánh giá <b>*</b></label>
            <SearchableSelect
              ariaLabel="Tìm nhân viên theo tên hoặc mã"
              emptyMessage={subjectSearchError || 'Không tìm thấy nhân viên phù hợp'}
              id="check-eval-subject-search"
              loading={subjectSearchLoading}
              onChange={selectSubject}
              onSearch={setSubjectQuery}
              options={subjectOptions}
              placeholder="Chọn nhân viên"
              searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
              selectedOption={selectedSubjectOption}
              value={selectedSubjectUserId}
            />
            {subjectSearchError && <p className="check-eval-subject-error" role="alert">{subjectSearchError}</p>}
            {subjectDetails && <div className="check-eval-selected-subject"><div><span>Họ và tên</span><strong>{subjectDetails.fullName}</strong></div><div><span>Mã nhân viên</span><strong>{subjectDetails.employeeCode}</strong></div><div><span>Khoa/phòng</span><strong>{subjectDetails.department || 'Chưa xác định'}</strong></div><div><span>Chức danh</span><strong>{subjectDetails.position || 'Chưa xác định'}</strong></div></div>}
            {subjectError && <p className="check-eval-subject-error" role="alert">{subjectError}</p>}
            <div className="check-eval-subject-actions"><button onClick={() => navigate(listPath)} type="button">Hủy bỏ</button><button className="is-primary" disabled={!subjectDetails || draftPreviewLoading || starting || Boolean(subjectError)} onClick={enterEvaluation} type="button">{draftPreviewLoading || starting ? <LoadingOutlined spin /> : null}{draftPreview ? 'Tiếp tục đánh giá' : 'Bắt đầu đánh giá'}<RightOutlined /></button></div>
          </div>
        </section>
      ) : (
        <div className="check-eval-page">
          <header className="check-eval-header"><div><span>BƯỚC 2/2 · THỰC HIỆN ĐÁNH GIÁ</span><h1>{assignedForm?.title}</h1><p>{assignedForm?.formCode || assignedForm?.version?.formCode || 'QUY TRÌNH'} · Phiên bản v{assignedForm?.version?.versionNumber}</p></div><div><strong>{answeredCount}/{questions.length}</strong><span>câu đã trả lời</span></div></header>
          {questions.length === 0 ? <div className="mgr-card" role="alert">Phiên bản này chưa có câu hỏi có thể thực hiện.</div> : <>
            <div className="check-eval-workspace">
              <aside className="check-eval-nav-panel">{questionNavigator()}</aside>
              <main className="check-eval-question-panel">
                <div className="check-eval-question-meta"><span>{currentEntry?.sectionTitle}</span><strong>Câu {currentQuestionIndex + 1}/{questions.length}</strong></div>
                <div className="check-eval-question-heading"><h2>{currentEntry?.question?.title}</h2>{currentEntry?.question?.critical && <span>Trọng yếu</span>}</div>
                {currentEntry?.question?.helpText && <p className="check-eval-help">{currentEntry.question.helpText}</p>}
                <div className="check-eval-answer-area">{currentEntry && renderQuestionField(currentEntry.question)}</div>
              </main>
              <aside className="check-eval-summary-panel">{progressAndSubject}</aside>
            </div>
            <footer className="check-eval-footer"><button className="check-eval-mobile-list" onClick={() => setMobileDrawerOpen(true)} type="button"><MenuOutlined /> Danh sách câu</button><button disabled={currentQuestionIndex === 0} onClick={() => setCurrentQuestionIndex((index) => Math.max(0, index - 1))} type="button"><LeftOutlined /> Câu trước</button><div>{renderSaveStatus()}</div><button className="is-primary" disabled={currentQuestionIndex >= questions.length - 1} onClick={() => setCurrentQuestionIndex((index) => Math.min(questions.length - 1, index + 1))} type="button">Câu tiếp theo <RightOutlined /></button></footer>
          </>}
          {mobileDrawerOpen && <div className="check-eval-drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileDrawerOpen(false) }} role="presentation"><aside aria-label="Danh sách câu hỏi và tiến độ" aria-modal="true" className="check-eval-drawer" role="dialog"><header><h2>Tổng quan đánh giá</h2><button aria-label="Đóng danh sách câu" onClick={() => setMobileDrawerOpen(false)} type="button"><CloseOutlined /></button></header>{progressAndSubject}{questionNavigator(true)}</aside></div>}
          <ConfirmModal cancelText="Xem lại" confirmText="Nộp kết quả" isOpen={submitConfirmOpen} message={`Nhân viên: ${subjectDetails?.fullName} (${subjectDetails?.employeeCode})\nQuy trình: ${assignedForm?.title}\nĐã trả lời: ${answeredCount}/${questions.length} câu\n\nSau khi nộp, kết quả sẽ không thể chỉnh sửa.`} onCancel={() => setSubmitConfirmOpen(false)} onConfirm={confirmSubmit} title="Xác nhận nộp kết quả" />
        </div>
      )}
    </AppShell>
  )
}

export default ManagerChecklistEvaluationPage
