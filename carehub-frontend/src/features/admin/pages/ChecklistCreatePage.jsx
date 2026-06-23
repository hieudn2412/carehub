import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownCircleOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import '../styles/ChecklistCreatePage.css'

const CHOICE_FIELD_TYPES = ['DROPDOWN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']

const QUESTION_TYPES = [
  { value: 'DROPDOWN', label: 'Menu thả xuống' },
  { value: 'SINGLE_CHOICE', label: 'Trắc nghiệm' },
  { value: 'MULTIPLE_CHOICE', label: 'Hộp kiểm' },
  { value: 'SHORT_TEXT', label: 'Trả lời ngắn' },
  { value: 'LONG_TEXT', label: 'Đoạn văn' },
]

function createId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function createOption(index = 0) {
  return {
    id: createId(),
    label: `Tùy chọn ${index + 1}`,
  }
}

function createQuestion() {
  return {
    id: createId(),
    title: '',
    fieldType: 'DROPDOWN',
    options: [createOption(0), createOption(1)],
  }
}

function createFormCode() {
  return `CHECKLIST_${Date.now()}`
}

function isChoiceField(fieldType) {
  return CHOICE_FIELD_TYPES.includes(fieldType)
}

function toOptionValue(label, optionIndex) {
  const normalized = label
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized) {
    return `OPTION_${optionIndex + 1}`
  }

  return `${normalized.slice(0, 235)}_${optionIndex + 1}`
}

function getQuestionPreview(fieldType) {
  if (fieldType === 'SHORT_TEXT') {
    return 'Người trả lời nhập câu trả lời ngắn'
  }

  if (fieldType === 'LONG_TEXT') {
    return 'Người trả lời nhập đoạn văn bản'
  }

  return ''
}

function getChoiceMarkerClass(fieldType) {
  if (fieldType === 'SINGLE_CHOICE') {
    return 'ccp-option-marker--radio'
  }

  if (fieldType === 'MULTIPLE_CHOICE') {
    return 'ccp-option-marker--checkbox'
  }

  return 'ccp-option-marker--number'
}

function supportsOtherAnswer(fieldType) {
  return fieldType === 'SINGLE_CHOICE' || fieldType === 'MULTIPLE_CHOICE'
}

function ChecklistCreatePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState(() => [createQuestion()])
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const breadcrumbs = useMemo(
    () => [
      { label: 'Quản lý checklist', route: '/admin/quality/checklists' },
      { label: 'Tạo mới checklist' },
    ],
    [],
  )

  const updateQuestion = (questionId, field, value) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        if (field === 'fieldType' && isChoiceField(value) && question.options.length === 0) {
          return { ...question, [field]: value, options: [createOption(0), createOption(1)] }
        }

        return { ...question, [field]: value }
      }),
    )
  }

  const updateOption = (questionId, optionId, value) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        return {
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, label: value } : option,
          ),
        }
      }),
    )
  }

  const addOption = (questionId) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) {
          return question
        }

        return {
          ...question,
          options: [...question.options, createOption(question.options.length)],
        }
      }),
    )
  }

  const removeOption = (questionId, optionId) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId || question.options.length <= 1) {
          return question
        }

        return {
          ...question,
          options: question.options.filter((option) => option.id !== optionId),
        }
      }),
    )
  }

  const addQuestion = () => {
    setQuestions((current) => [...current, createQuestion()])
  }

  const duplicateQuestion = (questionId) => {
    setQuestions((current) => {
      const targetIndex = current.findIndex((question) => question.id === questionId)
      if (targetIndex === -1) {
        return current
      }

      const target = current[targetIndex]
      const duplicated = {
        ...target,
        id: createId(),
        title: target.title ? `${target.title} (bản sao)` : '',
        options: target.options.map((option) => ({ ...option, id: createId() })),
      }

      return [
        ...current.slice(0, targetIndex + 1),
        duplicated,
        ...current.slice(targetIndex + 1),
      ]
    })
  }

  const removeQuestion = (questionId) => {
    if (questions.length === 1) {
      setErrorMessage('Checklist cần có ít nhất một câu hỏi.')
      return
    }

    setQuestions((current) => current.filter((question) => question.id !== questionId))
  }

  const buildVersionPayload = (resolvedTitle, resolvedDescription) => ({
    title: resolvedTitle,
    description: resolvedDescription || null,
    settings: {
      source: 'manual-simple-builder',
      scoring: {
        criticalWeightPercent: 55,
      },
    },
    sections: [
      {
        sectionKey: createId(),
        title: 'Nội dung checklist',
        description: null,
        displayOrder: 0,
        items: questions.map((question, questionIndex) => {
          const questionTitle = question.title.trim() || `Câu hỏi ${questionIndex + 1}`
          const choiceOptions = isChoiceField(question.fieldType)
            ? question.options
                .map((option) => option.label.trim())
                .filter(Boolean)
            : []

          return {
            itemKey: createId(),
            itemType: 'QUESTION',
            displayOrder: questionIndex,
            title: null,
            description: null,
            mediaUrl: null,
            question: {
              questionKey: createId(),
              code: `Q_${questionIndex + 1}_${question.id.replace(/-/g, '').slice(0, 8)}`,
              metricCode: null,
              title: questionTitle,
              helpText: null,
              fieldType: question.fieldType,
              required: true,
              readOnly: false,
              critical: false,
              excludeFromScore: !['DROPDOWN', 'SINGLE_CHOICE'].includes(question.fieldType),
              weight: ['DROPDOWN', 'SINGLE_CHOICE'].includes(question.fieldType) ? 1 : null,
              validationConfig: null,
              displayConfig: null,
              options: choiceOptions.map((label, optionIndex) => ({
                optionKey: createId(),
                value: toOptionValue(label, optionIndex),
                label,
                scoreValue: optionIndex === 0 ? 1 : 0,
                compliant: optionIndex === 0,
                excludeFromDenominator: false,
                displayOrder: optionIndex,
              })),
            },
          }
        }),
      },
    ],
  })

  const validateBeforeSave = () => {
    const invalidChoice = questions.some(
      (question) =>
        isChoiceField(question.fieldType) &&
        question.options.filter((option) => option.label.trim()).length < 2,
    )

    if (invalidChoice) {
      return 'Câu hỏi dạng lựa chọn cần có ít nhất 2 tùy chọn.'
    }

    return ''
  }

  const handleSave = async () => {
    const validationMessage = validateBeforeSave()
    if (validationMessage) {
      setErrorMessage(validationMessage)
      return
    }

    const resolvedTitle = title.trim() || 'Mẫu không có tiêu đề'
    const resolvedDescription = description.trim()

    try {
      setSaving(true)
      setErrorMessage('')

      const formResponse = await adminApi.createForm({
        code: createFormCode(),
        title: resolvedTitle,
        description: resolvedDescription || null,
        subjectType: 'PROCESS',
        ownerDepartmentId: null,
      })

      const formId = formResponse.data?.data?.id
      if (!formId) {
        throw new Error('Missing created form id')
      }

      await adminApi.createFormVersion(formId, buildVersionPayload(resolvedTitle, resolvedDescription))
      navigate(`/admin/quality/checklists/${formId}/edit`)
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          'Không thể tạo checklist mới. Vui lòng kiểm tra dữ liệu và thử lại.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="checklist-create-page">
              <div className="ccp-topbar">
                <button
                  className="ccp-back-button"
                  onClick={() => navigate('/admin/quality/checklists')}
                  type="button"
                >
                  <ArrowLeftOutlined /> Quay lại danh sách
                </button>
                <button
                  className="ccp-save-button"
                  disabled={saving}
                  onClick={handleSave}
                  type="button"
                >
                  {saving ? <LoadingOutlined spin /> : <SaveOutlined />}
                  Lưu bản nháp
                </button>
              </div>

              {errorMessage && (
                <div className="ccp-error" role="alert">
                  {errorMessage}
                </div>
              )}

              <section className="ccp-form-shell">
                <div className="ccp-title-card">
                  <div className="ccp-accent" />
                  <input
                    aria-label="Tiêu đề checklist"
                    className="ccp-title-input"
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Mẫu không có tiêu đề"
                    value={title}
                  />
                  <input
                    aria-label="Mô tả checklist"
                    className="ccp-description-input"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Mô tả biểu mẫu"
                    value={description}
                  />
                </div>

                <div className="ccp-question-list">
                  {questions.map((question, questionIndex) => (
                    <article className="ccp-question-card" key={question.id}>
                      <div className="ccp-question-main">
                        <input
                          aria-label={`Câu hỏi ${questionIndex + 1}`}
                          className="ccp-question-title"
                          onChange={(event) =>
                            updateQuestion(question.id, 'title', event.target.value)
                          }
                          placeholder="Câu hỏi không có tiêu đề"
                          value={question.title}
                        />

                        <label className="ccp-type-select">
                          <DownCircleOutlined />
                          <select
                            aria-label="Loại câu hỏi"
                            onChange={(event) =>
                              updateQuestion(question.id, 'fieldType', event.target.value)
                            }
                            value={question.fieldType}
                          >
                            {QUESTION_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {isChoiceField(question.fieldType) ? (
                        <div className="ccp-options">
                          {question.options.map((option, optionIndex) => (
                            <div className="ccp-option-row" key={option.id}>
                              <span
                                aria-hidden="true"
                                className={`ccp-option-marker ${getChoiceMarkerClass(question.fieldType)}`}
                              >
                                {question.fieldType === 'DROPDOWN' ? `${optionIndex + 1}.` : ''}
                              </span>
                              <input
                                aria-label={`Tùy chọn ${optionIndex + 1}`}
                                className="ccp-option-input"
                                onChange={(event) =>
                                  updateOption(question.id, option.id, event.target.value)
                                }
                                placeholder={`Tùy chọn ${optionIndex + 1}`}
                                value={option.label}
                              />
                              <button
                                aria-label="Xóa tùy chọn"
                                className="ccp-icon-button"
                                disabled={question.options.length <= 1}
                                onClick={() => removeOption(question.id, option.id)}
                                type="button"
                              >
                                <CloseOutlined />
                              </button>
                            </div>
                          ))}

                          <button
                            className="ccp-add-option"
                            onClick={() => addOption(question.id)}
                            type="button"
                          >
                            <span
                              aria-hidden="true"
                              className={`ccp-option-marker ${getChoiceMarkerClass(question.fieldType)}`}
                            >
                              {question.fieldType === 'DROPDOWN'
                                ? `${question.options.length + 1}.`
                                : ''}
                            </span>
                            <span className="ccp-add-option-text">Thêm tùy chọn</span>
                            {supportsOtherAnswer(question.fieldType) && (
                              <>
                                <span className="ccp-add-option-or">hoặc</span>
                                <span className="ccp-add-option-other">
                                  thêm &quot;Câu trả lời khác&quot;
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="ccp-answer-preview">
                          {getQuestionPreview(question.fieldType)}
                        </div>
                      )}

                      <div className="ccp-question-footer">
                        <button
                          aria-label="Thêm câu hỏi"
                          className="ccp-icon-button"
                          onClick={addQuestion}
                          type="button"
                        >
                          <PlusCircleOutlined />
                        </button>
                        <button
                          aria-label="Nhân bản câu hỏi"
                          className="ccp-icon-button"
                          onClick={() => duplicateQuestion(question.id)}
                          type="button"
                        >
                          <CopyOutlined />
                        </button>
                        <button
                          aria-label="Xóa câu hỏi"
                          className="ccp-icon-button ccp-icon-button--danger"
                          onClick={() => removeQuestion(question.id)}
                          type="button"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ChecklistCreatePage
