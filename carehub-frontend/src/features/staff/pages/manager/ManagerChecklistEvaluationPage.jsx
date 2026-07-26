import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  LoadingOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { staffApi } from '../../api/staffApi.js'
import { adminApi } from '../../../admin/api/adminApi.js'
import '../../styles/ManagerPages.css'

function sortByDisplayOrder(items = []) {
  return [...items].sort((left, right) => (left.displayOrder || 0) - (right.displayOrder || 0))
}

function hasAnswerValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  return value !== undefined && value !== null && String(value).trim() !== ''
}

function normalizeWeightPercent(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 60
  return Math.min(100, Math.max(0, parsed))
}

function getChecklistDetailError(error) {
  const statusCode = error?.response?.status

  if (!error?.response) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.'
  }

  if (statusCode === 403) {
    return 'Bạn không có quyền truy cập checklist này hoặc checklist đã hết hiệu lực.'
  }

  if (statusCode === 404) {
    return 'Không tìm thấy checklist được phân quyền.'
  }

  return error?.response?.data?.message || 'Không thể tải checklist được phân quyền.'
}

function ManagerChecklistEvaluationPage() {
  const { id, versionId } = useParams()
  const location = useLocation()
  const isDirectAdminEvaluation = Boolean(versionId)
  const listPath = isDirectAdminEvaluation
    ? '/admin/quality/checklists'
    : location.pathname.startsWith('/staff/')
      ? '/staff/checklists'
      : '/manager/quality/checklists'
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [assignedForm, setAssignedForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [subjectSuggestion, setSubjectSuggestion] = useState(null)
  const [subjectDetails, setSubjectDetails] = useState(null)
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [subjectError, setSubjectError] = useState('')
  const [answers, setAnswers] = useState({})
  const [submission, setSubmission] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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
        if (!data?.version) {
          throw new Error('INVALID_ASSIGNED_FORM_RESPONSE')
        }

        setAssignedForm(data)
        setAnswers({})
        setSubmission(null)
        setSubjectSuggestion(null)
        setSubjectDetails(null)
      })
      .catch((error) => {
        setAssignedForm(null)
        setErrorMessage(getChecklistDetailError(error))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, isDirectAdminEvaluation, versionId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAssignedForm()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadAssignedForm])

  const sections = useMemo(
    () => sortByDisplayOrder(assignedForm?.version?.sections || []),
    [assignedForm],
  )

  const questions = useMemo(() => {
    return sections.flatMap((section) =>
      sortByDisplayOrder(section.items || [])
        .filter((item) => item.itemType === 'QUESTION' && item.question)
        .map((item) => item.question),
    )
  }, [sections])

  const scoringSummary = useMemo(() => {
    const scored = questions.filter((question) => !question.excludeFromScore)
    const criticalCount = scored.filter((question) => question.critical).length
    return {
      criticalCount,
      normalCount: scored.length - criticalCount,
      scoredCount: scored.length,
    }
  }, [questions])

  const getQuestionWeightPercent = (question) => {
    if (question.excludeFromScore || scoringSummary.scoredCount === 0) return 0
    if (scoringSummary.criticalCount === 0 || scoringSummary.normalCount === 0) {
      return 100 / scoringSummary.scoredCount
    }

    const criticalShare = normalizeWeightPercent(
      assignedForm?.version?.settings?.scoring?.criticalWeightPercent,
    )
    return question.critical
      ? criticalShare / scoringSummary.criticalCount
      : (100 - criticalShare) / scoringSummary.normalCount
  }

  const updateAnswer = (questionKey, value) => {
    setAnswers((current) => ({
      ...current,
      [questionKey]: value,
    }))
  }

  const handleSubjectLookup = (codeToLookup) => {
    const normalizedEmployeeCode = (codeToLookup || employeeCode).trim()

    if (!normalizedEmployeeCode) {
      setSubjectError('Vui lòng nhập mã nhân viên được giám sát.')
      return
    }

    setSubjectLoading(true)
    setSubjectError('')
    setSubjectSuggestion(null)
    setSubjectDetails(null)

    staffApi.findAssignedFormSubject({
      assignmentItemId: isDirectAdminEvaluation ? undefined : id,
      employeeCode: normalizedEmployeeCode,
    })
      .then((response) => {
        const data = response.data?.data
        if (!data?.employeeCode) {
          throw new Error('SUBJECT_NOT_FOUND')
        }

        setEmployeeCode(data.employeeCode || normalizedEmployeeCode)
        setSubjectSuggestion(data)
        setSubmission(null)
      })
      .catch((error) => {
        setSubjectError(
          error?.response?.data?.message || 'Không tìm thấy nhân viên hoặc bạn không có quyền đánh giá nhân viên này.',
        )
      })
      .finally(() => {
        setSubjectLoading(false)
      })
  }

  const handleConfirmSubject = (subject) => {
    setSubjectDetails(subject)
    setSubjectSuggestion(null)
    setEmployeeCode(subject.employeeCode || employeeCode)
    setSubmission(null)
    setSubjectError('')
  }

  const toAnswerRequest = (question) => {
    const value = answers[question.questionKey]

    if (!hasAnswerValue(value)) {
      return null
    }

    switch (question.fieldType) {
      case 'SINGLE_CHOICE':
      case 'DROPDOWN':
        return {
          questionKey: question.questionKey,
          optionKey: value,
        }
      case 'MULTIPLE_CHOICE':
        return {
          questionKey: question.questionKey,
          optionKeys: value,
        }
      case 'NUMBER':
      case 'LINEAR_SCALE':
        return {
          questionKey: question.questionKey,
          numberValue: Number(value),
        }
      case 'DATE':
        return {
          questionKey: question.questionKey,
          dateValue: value,
        }
      case 'TIME':
        return {
          questionKey: question.questionKey,
          timeValue: value,
        }
      default:
        return {
          questionKey: question.questionKey,
          textValue: String(value),
        }
    }
  }

  const ensureSubmissionDraft = async () => {
    if (submission?.id) {
      return submission
    }

    const response = await staffApi.createFormSubmission({
      ...(isDirectAdminEvaluation
        ? { formVersionId: Number(versionId) }
        : { assignmentItemId: Number(id) }),
      subject: {
        type: 'USER',
        employeeCode: subjectDetails.employeeCode,
      },
    })

    const draft = response.data?.data
    setSubmission(draft)
    return draft
  }

  const handleSubmit = async (isDraft = false) => {
    if (!subjectDetails?.employeeCode) {
      showToast('Vui lòng tra cứu và xác nhận nhân viên cần giám sát trước.', 'warning')
      return
    }

    const missingRequired = questions.filter((question) =>
      !hasAnswerValue(answers[question.questionKey]),
    )

    if (!isDraft && missingRequired.length > 0) {
      showToast(`Vui lòng hoàn thành ${missingRequired.length} câu hỏi bắt buộc.`, 'warning')
      return
    }

    try {
      setSubmitting(true)
      const draft = await ensureSubmissionDraft()
      const answerPayload = questions.map(toAnswerRequest).filter(Boolean)
      const updateResponse = await staffApi.updateFormSubmission(draft.id, {
        lockVersion: draft.lockVersion,
        answers: answerPayload,
      })
      const updatedSubmission = updateResponse.data?.data
      setSubmission(updatedSubmission)

      if (isDraft) {
        showToast('Đã lưu bản nháp đánh giá.', 'success')
        return
      }

      await staffApi.submitFormSubmission(updatedSubmission.id, {
        lockVersion: updatedSubmission.lockVersion,
      })
      showToast('Đã nộp kết quả đánh giá checklist.', 'success')
      navigate(listPath)
    } catch (error) {
      const statusCode = error?.response?.status
      const fallback = statusCode === 409
        ? 'Checklist này đang có bản nháp mở hoặc dữ liệu vừa được cập nhật. Vui lòng tải lại và thử lại.'
        : 'Không thể lưu kết quả đánh giá. Vui lòng thử lại.'
      showToast(statusCode === 409 ? fallback : error?.response?.data?.message || fallback, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestionField = (question) => {
    const value = answers[question.questionKey] ?? ''
    const options = sortByDisplayOrder(question.options || [])

    switch (question.fieldType) {
      case 'SINGLE_CHOICE':
        return (
          <div className="mgr-eval-options">
            {options.map((option) => (
              <label key={option.optionKey} className="mgr-eval-option">
                <input
                  checked={value === option.optionKey}
                  name={question.questionKey}
                  onChange={() => updateAnswer(question.questionKey, option.optionKey)}
                  type="radio"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )
      case 'MULTIPLE_CHOICE': {
        const selectedOptions = Array.isArray(value) ? value : []

        return (
          <div className="mgr-eval-options">
            {options.map((option) => (
              <label key={option.optionKey} className="mgr-eval-option">
                <input
                  checked={selectedOptions.includes(option.optionKey)}
                  onChange={() => {
                    const nextValue = selectedOptions.includes(option.optionKey)
                      ? selectedOptions.filter((item) => item !== option.optionKey)
                      : [...selectedOptions, option.optionKey]
                    updateAnswer(question.questionKey, nextValue)
                  }}
                  type="checkbox"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )
      }
      case 'DROPDOWN':
        return (
          <select
            className="mgr-select mgr-eval-select"
            onChange={(event) => updateAnswer(question.questionKey, event.target.value)}
            value={value}
          >
            <option value="">Chọn một đáp án</option>
            {options.map((option) => (
              <option key={option.optionKey} value={option.optionKey}>
                {option.label}
              </option>
            ))}
          </select>
        )
      case 'LONG_TEXT':
        return (
          <textarea
            className="mgr-textarea"
            onChange={(event) => updateAnswer(question.questionKey, event.target.value)}
            placeholder="Nhập câu trả lời..."
            style={{ minHeight: 84 }}
            value={value}
          />
        )
      case 'NUMBER':
      case 'LINEAR_SCALE':
        return (
          <input
            className="mgr-select"
            onChange={(event) => updateAnswer(question.questionKey, event.target.value)}
            placeholder="Nhập số"
            style={{ cursor: 'text', maxWidth: 180 }}
            type="number"
            value={value}
          />
        )
      case 'DATE':
        return (
          <input
            className="mgr-select"
            onChange={(event) => updateAnswer(question.questionKey, event.target.value)}
            style={{ cursor: 'text', maxWidth: 220 }}
            type="date"
            value={value}
          />
        )
      case 'TIME':
        return (
          <input
            className="mgr-select"
            onChange={(event) => updateAnswer(question.questionKey, event.target.value)}
            style={{ cursor: 'text', maxWidth: 180 }}
            type="time"
            value={value}
          />
        )
      default:
        return (
          <input
            className="mgr-select"
            onChange={(event) => updateAnswer(question.questionKey, event.target.value)}
            placeholder="Nhập câu trả lời"
            style={{ cursor: 'text', width: '100%' }}
            type="text"
            value={value}
          />
        )
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header
          back={{ to: listPath, label: 'Quay lại' }}
          breadcrumbs={[
            { label: 'Tuân thủ quy trình, quy định', link: listPath },
            { label: 'Thực hiện đánh giá' },
          ]}
        />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Thực hiện đánh giá quy trình</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              {assignedForm?.title || 'Đang tải checklist được phân quyền...'}
            </p>
          </div>

          {loading ? (
            <div className="mgr-card">
              <LoadingState label="Đang tải checklist..." />
            </div>
          ) : errorMessage ? (
            <div className="mgr-card" role="alert" style={{ color: '#b42318' }}>
              {errorMessage}
            </div>
          ) : (
            <div className="mgr-card">
              <div style={{ marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Nhân viên được giám sát <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="mgr-eval-lookup-row">
                  <input
                    className="mgr-select mgr-eval-lookup-input"
                    disabled={subjectLoading}
                    onChange={(event) => {
                      setEmployeeCode(event.target.value)
                      setSubjectSuggestion(null)
                      setSubjectDetails(null)
                      setSubmission(null)
                      setSubjectError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleSubjectLookup()
                      }
                    }}
                    placeholder="Nhập mã nhân viên, ví dụ: NV001"
                    type="text"
                    value={employeeCode}
                  />
                  <button
                    className="training-button training-button--primary mgr-eval-lookup-btn"
                    disabled={subjectLoading || !employeeCode.trim()}
                    onClick={() => handleSubjectLookup()}
                    type="button"
                  >
                    {subjectLoading ? <LoadingOutlined spin /> : null}
                    Tìm nhân viên
                  </button>
                  {subjectLoading && (
                    <span style={{ fontSize: 13, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Đang tra cứu...
                    </span>
                  )}
                </div>
                {subjectError && (
                  <p style={{ color: '#ef4444', margin: '8px 0 0', fontSize: 13 }}>{subjectError}</p>
                )}
                {subjectSuggestion && (
                  <button
                    onClick={() => handleConfirmSubject(subjectSuggestion)}
                    className="mgr-eval-suggest"
                    type="button"
                  >
                    <span className="mgr-eval-suggest__info">
                      <span style={{ color: '#00866b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
                        Kết quả tìm thấy
                      </span>
                      <strong style={{ color: '#0f172a', fontSize: 14 }}>
                        {subjectSuggestion.fullName || 'Chưa có tên'} ({subjectSuggestion.employeeCode})
                      </strong>
                      <span style={{ color: '#64748b', fontSize: 13 }}>
                        {subjectSuggestion.department || 'Chưa có khoa/phòng'}
                      </span>
                    </span>
                    <span style={{
                      background: '#00866b',
                      borderRadius: 999,
                      boxShadow: '0 8px 18px rgba(0, 134, 107, 0.18)',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '8px 12px',
                    }}>
                      Chọn nhân viên này
                    </span>
                  </button>
                )}
                {subjectDetails && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ color: '#00866b', fontSize: 12, fontWeight: 800, marginBottom: 8, textTransform: 'uppercase' }}>
                      Đã chọn nhân viên
                    </div>
                    <div className="mgr-kv-grid">
                      <div className="mgr-kv-item">
                        <span className="mgr-kv-label">Họ tên</span>
                        <span className="mgr-kv-val">{subjectDetails.fullName}</span>
                      </div>
                      <div className="mgr-kv-item">
                        <span className="mgr-kv-label">Mã nhân viên</span>
                        <span className="mgr-kv-val">{subjectDetails.employeeCode}</span>
                      </div>
                      <div className="mgr-kv-item">
                        <span className="mgr-kv-label">Khoa phòng</span>
                        <span className="mgr-kv-val">{subjectDetails.department || 'Chưa có'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mgr-eval-section">
                <div className="mgr-eval-section-title">Tiêu chí kiểm tra đánh giá</div>

                {sections.map((section) => (
                  <div key={section.sectionKey || section.id} style={{ marginBottom: 18 }}>
                    {section.title && (
                      <h2 style={{ fontSize: 16, margin: '0 0 6px', color: '#0f172a' }}>{section.title}</h2>
                    )}
                    {section.description && (
                      <p style={{ fontSize: 13, margin: '0 0 12px', color: '#64748b' }}>{section.description}</p>
                    )}

                    {sortByDisplayOrder(section.items || []).map((item) => {
                      if (item.itemType !== 'QUESTION' || !item.question) {
                        return item.description ? (
                          <div key={item.itemKey || item.id} className="mgr-eval-question">
                            {item.title && <strong>{item.title}</strong>}
                            <p style={{ margin: item.title ? '6px 0 0' : 0 }}>{item.description}</p>
                          </div>
                        ) : null
                      }

                      const question = item.question

                      return (
                        <div key={question.questionKey} className="mgr-eval-question">
                          <div className="mgr-eval-question-text">
                            {question.title}
                            {question.critical && (
                              <span className="mgr-badge mgr-badge--red" style={{ marginLeft: 8, padding: '2px 6px', fontSize: 10 }}>
                                ★ Trọng yếu
                              </span>
                            )}
                            {!question.excludeFromScore && (
                              <span className="mgr-badge mgr-badge--blue" style={{ marginLeft: 8, padding: '2px 6px', fontSize: 10 }}>
                                {getQuestionWeightPercent(question).toFixed(2)}%
                              </span>
                            )}
                          </div>
                          {question.helpText && (
                            <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 10px' }}>{question.helpText}</p>
                          )}
                          {renderQuestionField(question)}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="mgr-eval-actions">
                <button
                  onClick={() => navigate(listPath)}
                  className="training-button mgr-eval-action-btn"
                  disabled={submitting}
                  type="button"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  className="training-button mgr-eval-action-btn"
                  disabled={submitting}
                  type="button"
                >
                  <SaveOutlined /> Lưu bản nháp
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  className="training-button training-button--primary mgr-eval-action-btn"
                  disabled={submitting}
                  type="button"
                >
                  {submitting ? <LoadingOutlined spin /> : <SendOutlined />} Nộp kết quả
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManagerChecklistEvaluationPage
