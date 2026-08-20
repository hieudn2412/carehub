import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SaveOutlined, SendOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmDialog from '../../../shared/components/ConfirmDialog.jsx'
import { staffApi } from '../api/staffApi.js'
import '../styles/ChecklistFormScreen.css'

function sortByDisplayOrder(items = []) {
  return [...items].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
}

function hasAnswerValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function ChecklistFormScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [assignedForm, setAssignedForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [answers, setAnswers] = useState({})
  const [submission, setSubmission] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmSubmitCount, setConfirmSubmitCount] = useState(null)

  const loadAssignedForm = useCallback(() => {
    setLoading(true)
    setErrorMessage('')
    staffApi.getAssignedForm(id)
      .then(res => {
        const data = res.data?.data
        if (!data?.version) throw new Error('INVALID_RESPONSE')
        setAssignedForm(data)
        // Check for existing submission
        staffApi.getFormSubmissions({ assignmentItemId: id, page: 0, size: 1 })
          .then(subRes => {
            const subs = subRes.data?.data?.content || subRes.data?.data || []
            if (Array.isArray(subs) && subs.length > 0) {
              setSubmission(subs[0])
              // Restore previous answers
              const prevAnswers = {}
              ;(subs[0].answers || []).forEach(a => {
                prevAnswers[a.questionKey] = a.optionKey || a.optionKeys || a.textValue || a.numberValue || a.dateValue || a.timeValue
              })
              setAnswers(prevAnswers)
            }
          })
          .catch(() => {})
      })
      .catch(err => {
        setAssignedForm(null)
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Bạn không có quyền truy cập phiếu này.')
        else if (status === 404) setErrorMessage('Không tìm thấy phiếu kiểm tra.')
        else setErrorMessage(err?.response?.data?.message || 'Không thể tải phiếu kiểm tra.')
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(() => loadAssignedForm(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAssignedForm])

  const sections = useMemo(
    () => sortByDisplayOrder(assignedForm?.version?.sections || []),
    [assignedForm],
  )

  const updateAnswer = (questionKey, value) => {
    setAnswers(curr => ({ ...curr, [questionKey]: value }))
  }

  const toAnswerRequest = (question) => {
    const value = answers[question.questionKey]
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

  const ensureDraft = async () => {
    if (submission?.id) return submission
    const res = await staffApi.createFormSubmission({
      assignmentItemId: Number(id),
    })
    const draft = res.data?.data
    setSubmission(draft)
    return draft
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const draft = await ensureDraft()
      const answerList = sections
        .flatMap(s => sortByDisplayOrder(s.items || []))
        .filter(item => item.itemType === 'QUESTION' && item.question)
        .map(item => toAnswerRequest(item.question))
        .filter(Boolean)
      await staffApi.updateFormSubmission(draft.id, { answers: answerList })
      showToast('Đã lưu câu trả lời', 'success')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể lưu', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = () => {
    const unansweredCount = sections.flatMap(s => sortByDisplayOrder(s.items || []))
      .filter(item => item.itemType === 'QUESTION' && item.question)
      .filter(item => !hasAnswerValue(answers[item.question.questionKey])).length

    if (unansweredCount > 0) {
      setConfirmSubmitCount(unansweredCount)
      return
    }
    doSubmit()
  }

  const doSubmit = async () => {
    setSubmitting(true)
    try {
      const draft = await ensureDraft()
      const answerList = sections
        .flatMap(s => sortByDisplayOrder(s.items || []))
        .filter(item => item.itemType === 'QUESTION' && item.question)
        .map(item => toAnswerRequest(item.question))
        .filter(Boolean)
      await staffApi.updateFormSubmission(draft.id, { answers: answerList })
      await staffApi.submitFormSubmission(draft.id)
      showToast('Đã nộp phiếu kiểm tra!', 'success')
      navigate('/staff/checklists')
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể nộp phiếu', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Render a question based on field type
  const renderQuestion = (question) => {
    const value = answers[question.questionKey]
    const options = sortByDisplayOrder(question.options || [])

    switch (question.fieldType) {
      case 'SINGLE_CHOICE':
        return (
          <div className="cfs-options">
            {options.map(opt => (
              <label key={opt.optionKey} className={`cfs-option ${value === opt.optionKey ? 'cfs-option--selected' : ''}`}>
                <input type="radio" name={question.questionKey} checked={value === opt.optionKey}
                  onChange={() => updateAnswer(question.questionKey, opt.optionKey)} />
                <span>{opt.label || opt.optionKey}</span>
              </label>
            ))}
          </div>
        )
      case 'MULTIPLE_CHOICE':
        return (
          <div className="cfs-options">
            {options.map(opt => {
              const selected = Array.isArray(value) && value.includes(opt.optionKey)
              return (
                <label key={opt.optionKey} className={`cfs-option ${selected ? 'cfs-option--selected' : ''}`}>
                  <input type="checkbox" checked={selected}
                    onChange={() => {
                      const curr = Array.isArray(value) ? [...value] : []
                      updateAnswer(question.questionKey, curr.includes(opt.optionKey)
                        ? curr.filter(k => k !== opt.optionKey) : [...curr, opt.optionKey])
                    }} />
                  <span>{opt.label || opt.optionKey}</span>
                </label>
              )
            })}
          </div>
        )
      case 'DROPDOWN':
        return (
          <select className="cfs-select" value={value || ''} onChange={e => updateAnswer(question.questionKey, e.target.value)}>
            <option value="">-- Chọn --</option>
            {options.map(opt => <option key={opt.optionKey} value={opt.optionKey}>{opt.label || opt.optionKey}</option>)}
          </select>
        )
      case 'NUMBER':
      case 'LINEAR_SCALE':
        return <input type="number" className="cfs-input" value={value || ''}
          onChange={e => updateAnswer(question.questionKey, e.target.value)}
          min={question.minValue} max={question.maxValue} step={question.step || 1} />
      case 'DATE':
        return <KeyboardDatePicker className="cfs-input" value={value || ''}
          onChange={val => updateAnswer(question.questionKey, val)} />
      case 'TIME':
        return <input type="time" className="cfs-input" value={value || ''}
          onChange={e => updateAnswer(question.questionKey, e.target.value)} />
      default:
        return <textarea className="cfs-textarea" value={value || ''} rows={3}
          onChange={e => updateAnswer(question.questionKey, e.target.value)}
          placeholder="Nhập câu trả lời..." />
    }
  }

  const isReadOnly = submission?.status === 'SUBMITTED' || submission?.status === 'COMPLETED'

  if (loading) {
    return (
      <AppShell back={{ to: '/staff/checklists', label: 'Quay lại' }} title="Phiếu kiểm tra">
        <div className="cfs-loading">Đang tải phiếu kiểm tra...</div>
      </AppShell>
    )
  }

  if (errorMessage) {
    return (
      <AppShell back={{ to: '/staff/checklists', label: 'Quay lại' }} title="Phiếu kiểm tra">
        <div className="cfs-error">
          <p>{errorMessage}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell back={{ to: '/staff/checklists', label: 'Quay lại' }} title={assignedForm?.formName || 'Phiếu kiểm tra'}>
      <div className="cfs-container">
        <div className="cfs-header">
          <div>
            <h2>{assignedForm?.formName || `Phiếu #${id}`}</h2>
            {assignedForm?.description && <p className="cfs-subtitle">{assignedForm.description}</p>}
          </div>
          {!isReadOnly && (
            <div className="cfs-actions">
              <button className="ch-btn ch-btn--secondary" onClick={handleSave} disabled={saving || submitting}>
                <SaveOutlined /> {saving ? 'Đang lưu...' : 'Lưu nháp'}
              </button>
              <button className="ch-btn ch-btn--primary" onClick={handleSubmit} disabled={saving || submitting}>
                <SendOutlined /> {submitting ? 'Đang nộp...' : 'Nộp phiếu'}
              </button>
            </div>
          )}
          {isReadOnly && (
            <span className="ch-badge ch-badge--green">Đã nộp</span>
          )}
        </div>

        {sections.map(section => (
          <div key={section.id} className="cfs-section">
            <h3 className="cfs-section-title">{section.title || `Phần ${section.displayOrder || ''}`}</h3>
            {section.description && <p className="cfs-section-desc">{section.description}</p>}
            {sortByDisplayOrder(section.items || [])
              .filter(item => item.itemType === 'QUESTION' && item.question)
              .map((item, idx) => {
                const q = item.question
                const answered = hasAnswerValue(answers[q.questionKey])
                return (
                  <div key={q.questionKey} className={`cfs-question ${answered ? 'cfs-question--answered' : ''}`}>
                    <div className="cfs-question-header">
                      <span className="cfs-question-num">{idx + 1}.</span>
                      <span className="cfs-question-stem">{q.stem || q.questionText}</span>
                      {q.required && <span className="cfs-required">*</span>}
                      {answered && <span className="cfs-answered-badge">✓</span>}
                    </div>
                    {isReadOnly ? (
                      <div className="cfs-readonly-answer">
                        {Array.isArray(answers[q.questionKey])
                          ? answers[q.questionKey].join(', ')
                          : String(answers[q.questionKey] || 'Chưa trả lời')}
                      </div>
                    ) : renderQuestion(q)}
                  </div>
                )
              })}
          </div>
        ))}

        {sections.length === 0 && (
          <div className="cfs-empty">Phiếu kiểm tra này chưa có câu hỏi nào.</div>
        )}
      </div>

      {confirmSubmitCount !== null && (
        <ConfirmDialog
          title="Nộp phiếu kiểm tra"
          message={`Còn ${confirmSubmitCount} câu chưa trả lời. Bạn có chắc muốn nộp?`}
          confirmLabel="Nộp phiếu"
          onConfirm={() => {
            setConfirmSubmitCount(null)
            doSubmit()
          }}
          onCancel={() => setConfirmSubmitCount(null)}
        />
      )}
    </AppShell>
  )
}

export default ChecklistFormScreen
