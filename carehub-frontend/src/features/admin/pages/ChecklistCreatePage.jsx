import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import ChecklistReadOnlyVersion from '../components/ChecklistReadOnlyVersion.jsx'
import { adminApi } from '../api/adminApi'
import { createChecklistCode } from '../utils/formCode.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import '../styles/ChecklistCreatePage.css'

const CHOICE_FIELD_TYPES = ['DROPDOWN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE']
const PENDING_DRAFT_STORAGE_KEY = 'carehub.pendingChecklistDraft'

const QUESTION_TYPES = [
  { value: 'DROPDOWN', label: 'Menu thả xuống' },
  { value: 'SINGLE_CHOICE', label: 'Trắc nghiệm' },
  { value: 'MULTIPLE_CHOICE', label: 'Hộp kiểm' },
  { value: 'SHORT_TEXT', label: 'Trả lời ngắn' },
  { value: 'LONG_TEXT', label: 'Đoạn văn' },
]

const QUESTION_TYPE_ICONS = {
  SHORT_TEXT: 'short-text',
  LONG_TEXT: 'paragraph',
  SINGLE_CHOICE: 'radio',
  MULTIPLE_CHOICE: 'checkbox',
  DROPDOWN: 'dropdown',
}
const QUESTION_TYPE_ORDER = [
  'SHORT_TEXT',
  'LONG_TEXT',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'DROPDOWN',
]
const QUESTION_TYPE_SELECT_OPTIONS = QUESTION_TYPE_ORDER
  .map((value) => QUESTION_TYPES.find((type) => type.value === value))
  .filter(Boolean)
  .map((type) => ({
    ...type,
    icon: QUESTION_TYPE_ICONS[type.value] || 'legacy',
  }))

function QuestionTypeSelect({ disabled, onChange, value }) {
  const [open, setOpen] = useState(false)
  const selected = QUESTION_TYPE_SELECT_OPTIONS.find((type) => type.value === value)
    || { value, label: value || 'Legacy', icon: 'legacy' }

  return (
    <div
      className={`ccp-type-select ${open ? 'is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="ccp-type-select__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={`ccp-type-icon ccp-type-icon--${selected.icon}`} aria-hidden="true" />
        <span>{selected.label}</span>
        <DownOutlined className="ccp-type-select__chevron" />
      </button>

      {open && (
        <div className="ccp-type-select__menu" role="listbox">
          {QUESTION_TYPE_SELECT_OPTIONS.map((type) => (
            <button
              aria-selected={type.value === value}
              className={`ccp-type-select__option ${type.value === value ? 'is-selected' : ''}`}
              key={type.value}
              onClick={() => {
                onChange(type.value)
                setOpen(false)
              }}
              role="option"
              type="button"
            >
              <span className={`ccp-type-icon ccp-type-icon--${type.icon}`} aria-hidden="true" />
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
    optionKey: null,
    value: '',
    label: `Tùy chọn ${index + 1}`,
  }
}

function createQuestion() {
  return {
    id: createId(),
    itemKey: null,
    questionKey: null,
    code: null,
    title: '',
    fieldType: 'SINGLE_CHOICE',
    options: [createOption(0), createOption(1)],
  }
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

function readPendingDraft() {
  try {
    const stored = window.sessionStorage.getItem(PENDING_DRAFT_STORAGE_KEY)
    if (!stored) {
      return null
    }

    const pending = JSON.parse(stored)
    return pending?.formId && pending?.editor ? pending : null
  } catch {
    window.sessionStorage.removeItem(PENDING_DRAFT_STORAGE_KEY)
    return null
  }
}

function persistPendingDraft(pending) {
  window.sessionStorage.setItem(PENDING_DRAFT_STORAGE_KEY, JSON.stringify(pending))
}

function clearPendingDraft() {
  window.sessionStorage.removeItem(PENDING_DRAFT_STORAGE_KEY)
}

function mapVersionToSimpleEditor(version) {
  const sections = [...(version?.sections || [])]
    .sort((left, right) => left.displayOrder - right.displayOrder)
  const items = sections.flatMap((section) => (
    [...(section.items || [])].sort((left, right) => left.displayOrder - right.displayOrder)
  ))
  const questionItems = items.filter(
    (item) => item.itemType === 'QUESTION' && item.question,
  )
  const compatible = sections.length <= 1
    && items.length === questionItems.length
    && questionItems.every((item) => {
      const question = item.question
      return QUESTION_TYPES.some((type) => type.value === question.fieldType)
        && question.required
        && !question.readOnly
        && !question.critical
        && question.excludeFromScore
        && !question.helpText
        && !question.metricCode
        && !question.validationConfig
        && !question.displayConfig
    })

  return {
    compatible,
    questions: questionItems.map((item) => ({
      id: item.question.questionKey || item.itemKey || createId(),
      itemKey: item.itemKey || null,
      questionKey: item.question.questionKey || null,
      code: item.question.code || null,
      title: item.question.title || '',
      fieldType: item.question.fieldType,
      options: [...(item.question.options || [])]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((option) => ({
          id: option.optionKey || createId(),
          optionKey: option.optionKey || null,
          value: option.value || '',
          label: option.label || '',
        })),
    })),
    sectionKey: sections[0]?.sectionKey || null,
  }
}

function ChecklistCreatePage() {
  const navigate = useNavigate()
  const { id } = useParams()

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false
  })
  const isDetailMode = Boolean(id)
  const [pendingDraft, setPendingDraft] = useState(
    () => (isDetailMode ? null : readPendingDraft()),
  )
  const [title, setTitle] = useState(() => pendingDraft?.editor?.title || '')
  const [description, setDescription] = useState(
    () => pendingDraft?.editor?.description || '',
  )
  const [questions, setQuestions] = useState(
    () => pendingDraft?.editor?.questions || [createQuestion()],
  )
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isDetailMode)
  const [errorMessage, setErrorMessage] = useState(
    pendingDraft
      ? `Đang khôi phục checklist #${pendingDraft.formId} chưa tạo xong bản nháp.`
      : '',
  )
  const [noticeMessage, setNoticeMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [existingForm, setExistingForm] = useState(null)
  const [loadedVersion, setLoadedVersion] = useState(null)
  const [sectionKey, setSectionKey] = useState(null)
  const [simpleEditable, setSimpleEditable] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const pendingFormId = pendingDraft?.formId || null
  const formControlsEnabled = !isDetailMode || (simpleEditable && isEditing)

  const breadcrumbs = useMemo(
    () => [
      { label: 'Quản lý checklist', route: '/admin/quality/checklists' },
      { label: isDetailMode ? 'Chi tiết checklist' : 'Tạo mới checklist' },
    ],
    [isDetailMode],
  )

  const loadExistingChecklist = useCallback(async () => {
    if (!isDetailMode) {
      return
    }

    try {
      setLoading(true)
      setErrorMessage('')
      setNoticeMessage('')
      const [formResponse, versionsResponse] = await Promise.all([
        adminApi.getFormById(id),
        adminApi.getFormVersions(id, { page: 0, size: 100 }),
      ])
      const form = formResponse.data?.data
      const versions = versionsResponse.data?.data?.content

      if (!form || !Array.isArray(versions)) {
        throw new Error('Phản hồi chi tiết checklist không hợp lệ.')
      }

      const draftSummary = versions.find((version) => version.status === 'DRAFT')
      const selectedVersionId = draftSummary?.id || form.currentPublishedVersion?.id

      setExistingForm(form)
      setTitle(form.title || '')
      setDescription(form.description || '')

      if (!selectedVersionId) {
        setLoadedVersion(null)
        setSectionKey(null)
        setQuestions([createQuestion()])
        setSimpleEditable(true)
        setIsEditing(false)
        return
      }

      const versionResponse = await adminApi.getFormVersionById(id, selectedVersionId)
      const version = versionResponse.data?.data
      if (!version) {
        throw new Error('Không thể tải cấu trúc checklist.')
      }

      const editor = mapVersionToSimpleEditor(version)
      setLoadedVersion(version)
      setSectionKey(editor.sectionKey)
      setQuestions(editor.questions.length ? editor.questions : [createQuestion()])
      setSimpleEditable(editor.compatible)
      setIsEditing(false)

      if (!editor.compatible) {
        setNoticeMessage(
          'Checklist này có nhiều phần hoặc cấu hình nâng cao nên đang được hiển thị đầy đủ '
          + 'ở chế độ chỉ đọc. Dùng Quản lý phiên bản để chỉnh sửa an toàn.',
        )
      }
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message
          || error?.message
          || 'Không thể tải chi tiết checklist.',
      )
    } finally {
      setLoading(false)
    }
  }, [id, isDetailMode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadExistingChecklist()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadExistingChecklist])

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
        itemKey: null,
        questionKey: null,
        code: null,
        title: target.title ? `${target.title} (bản sao)` : '',
        options: target.options.map((option) => ({
          ...option,
          id: createId(),
          optionKey: null,
          value: '',
        })),
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
    },
    sections: [
      {
        sectionKey: sectionKey || createId(),
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
            itemKey: question.itemKey || createId(),
            itemType: 'QUESTION',
            displayOrder: questionIndex,
            title: null,
            description: null,
            mediaUrl: null,
            question: {
              questionKey: question.questionKey || createId(),
              code: question.code
                || `Q_${questionIndex + 1}_${question.id.replace(/-/g, '').slice(0, 8)}`,
              metricCode: null,
              title: questionTitle,
              helpText: null,
              fieldType: question.fieldType,
              required: true,
              readOnly: false,
              critical: false,
              excludeFromScore: true,
              weight: null,
              validationConfig: null,
              displayConfig: null,
              options: choiceOptions.map((label, optionIndex) => ({
                optionKey: question.options[optionIndex]?.optionKey || createId(),
                value: question.options[optionIndex]?.value
                  || toOptionValue(label, optionIndex),
                label,
                scoreValue: null,
                compliant: null,
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
        (
          question.options.length < 2
          || question.options.some((option) => !option.label.trim())
        ),
    )

    if (invalidChoice) {
      return 'Câu hỏi dạng lựa chọn cần có ít nhất 2 tùy chọn.'
    }

    return ''
  }

  const updateExistingDraft = async (formId, versionPayload) => {
    const versionsResponse = await adminApi.getFormVersions(formId, {
      page: 0,
      size: 1,
      status: 'DRAFT',
      sort: 'versionNumber,desc',
    })
    const draftSummary = versionsResponse.data?.data?.content?.[0]

    if (!draftSummary?.id) {
      throw new Error('Không tìm thấy bản nháp hiện có để tiếp tục.')
    }

    const draftResponse = await adminApi.getFormVersionById(formId, draftSummary.id)
    const draft = draftResponse.data?.data

    if (draft?.lockVersion === undefined || draft?.lockVersion === null) {
      throw new Error('Phản hồi bản nháp không có phiên bản khóa.')
    }

    await adminApi.updateFormVersion(formId, draft.id, {
      ...versionPayload,
      lockVersion: draft.lockVersion,
    })
  }

  const handleDiscardPendingDraft = async () => {
    if (!pendingFormId) {
      return
    }

    setConfirmModal({
      isOpen: true
    })
  }

  const executeDiscardPendingDraft = async () => {

    try {
      setSaving(true)
      setErrorMessage('')
      await adminApi.deleteForm(pendingFormId)
      clearPendingDraft()
      setPendingDraft(null)
      setTitle('')
      setDescription('')
      setQuestions([createQuestion()])
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message
          || 'Không thể hủy checklist đang tạo dở. Vui lòng thử lại.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (isDetailMode && !simpleEditable) {
      setErrorMessage(
        'Checklist có cấu trúc nâng cao nên không thể lưu bằng trình chỉnh sửa đơn giản.',
      )
      return
    }

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
      setSuccessMessage('')

      const versionPayload = buildVersionPayload(resolvedTitle, resolvedDescription)

      if (isDetailMode) {
        if (loadedVersion?.status === 'DRAFT') {
          await adminApi.updateFormVersion(id, loadedVersion.id, {
            ...versionPayload,
            lockVersion: loadedVersion.lockVersion,
          })
        } else {
          await adminApi.createFormVersion(id, versionPayload)
        }

        try {
          await adminApi.updateForm(id, {
            title: resolvedTitle,
            description: resolvedDescription || null,
            subjectType: existingForm?.subjectType || 'PROCESS',
            ownerDepartmentId: existingForm?.ownerDepartment?.id || null,
          })
        } catch (metadataError) {
          await loadExistingChecklist()
          setTitle(resolvedTitle)
          setDescription(resolvedDescription)
          setIsEditing(true)
          setErrorMessage(
            metadataError?.response?.data?.message
              || 'Nội dung bản nháp đã được lưu nhưng chưa cập nhật được tiêu đề hoặc mô tả. '
                + 'Vui lòng thử lưu lại.',
          )
          return
        }

        setSuccessMessage('Đã lưu thay đổi vào bản nháp checklist.')
        await loadExistingChecklist()
        return
      }

      let formId = pendingFormId
      if (!formId) {
        const formResponse = await adminApi.createForm({
          code: createChecklistCode(resolvedTitle),
          title: resolvedTitle,
          description: resolvedDescription || null,
          subjectType: 'PROCESS',
          ownerDepartmentId: null,
        })

        formId = formResponse.data?.data?.id
        if (!formId) {
          throw new Error('Phản hồi tạo checklist không có mã định danh.')
        }
      } else {
        await adminApi.updateForm(formId, {
          title: resolvedTitle,
          description: resolvedDescription || null,
          subjectType: 'PROCESS',
          ownerDepartmentId: null,
        })
      }

      const nextPendingDraft = {
        formId,
        editor: {
          title,
          description,
          questions,
        },
      }
      persistPendingDraft(nextPendingDraft)
      setPendingDraft(nextPendingDraft)

      try {
        await adminApi.createFormVersion(formId, versionPayload)
        clearPendingDraft()
        setPendingDraft(null)
        navigate(`/admin/quality/checklists/${formId}/edit`)
      } catch (versionError) {
        if (versionError?.response?.status === 409) {
          try {
            await updateExistingDraft(formId, versionPayload)
            clearPendingDraft()
            setPendingDraft(null)
            navigate(`/admin/quality/checklists/${formId}/edit`)
            return
          } catch (recoveryError) {
            setErrorMessage(
              recoveryError?.response?.status === 409
                ? 'Bản nháp đã được thay đổi ở nơi khác. Hãy tải lại trang trước khi thử tiếp.'
                : recoveryError?.response?.data?.message
                  || recoveryError?.message
                  || 'Không thể cập nhật bản nháp hiện có.',
            )
            return
          }
        }

        setErrorMessage(
          `Thông tin checklist #${formId} đã được tạo nhưng chưa tạo được bản nháp. `
          + 'Nhấn "Thử tạo lại bản nháp" để tiếp tục mà không tạo thêm checklist mới.',
        )
      }
    } catch (error) {
      setErrorMessage(
        error?.response?.status === 409
          ? 'Checklist đã được cập nhật ở nơi khác. Hãy tải lại trang trước khi lưu tiếp.'
          : error?.response?.data?.message
            || (isDetailMode
              ? 'Không thể lưu thay đổi checklist. Vui lòng thử lại.'
              : 'Không thể tạo checklist mới. Vui lòng kiểm tra dữ liệu và thử lại.'),
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
                <div className="ccp-topbar-actions">
                  {isDetailMode && (
                    <button
                      className="ccp-manage-button"
                      onClick={() => navigate(`/admin/quality/checklists/${id}/edit`)}
                      type="button"
                    >
                      Quản lý phiên bản
                    </button>
                  )}
                  {isDetailMode && simpleEditable && !isEditing && (
                    <button
                      className="ccp-edit-button"
                      onClick={() => {
                        setSuccessMessage('')
                        setErrorMessage('')
                        setNoticeMessage('')
                        setIsEditing(true)
                      }}
                      type="button"
                    >
                      Chỉnh sửa
                    </button>
                  )}
                  {isDetailMode && isEditing && (
                    <button
                      className="ccp-cancel-button"
                      disabled={saving}
                      onClick={() => {
                        setSuccessMessage('')
                        setIsEditing(false)
                        loadExistingChecklist()
                      }}
                      type="button"
                    >
                      Hủy chỉnh sửa
                    </button>
                  )}
                  {pendingFormId && (
                    <button
                      className="ccp-discard-button"
                      disabled={saving}
                      onClick={handleDiscardPendingDraft}
                      type="button"
                    >
                      <DeleteOutlined /> Hủy bản nháp
                    </button>
                  )}
                  {(!isDetailMode || isEditing) && (
                    <button
                      className="ccp-save-button"
                      disabled={saving || loading || !simpleEditable}
                      onClick={handleSave}
                      type="button"
                    >
                      {saving ? <LoadingOutlined spin /> : <SaveOutlined />}
                      {isDetailMode
                        ? 'Lưu thay đổi'
                        : pendingFormId
                          ? 'Thử tạo lại bản nháp'
                          : 'Lưu bản nháp'}
                    </button>
                  )}
                </div>
              </div>

              {successMessage && (
                <div className="ccp-success" role="status">
                  {successMessage}
                </div>
              )}

              {noticeMessage && (
                <div className="ccp-info" role="status">
                  {noticeMessage}
                </div>
              )}

              {errorMessage && (
                <div className="ccp-error" role="alert">
                  {errorMessage}
                </div>
              )}

              {loading ? (
                <div className="ccp-loading">
                  <LoadingOutlined spin /> Đang tải dữ liệu checklist...
                </div>
              ) : (
              <>
              <section className="ccp-form-shell">
                <div className="ccp-title-card">
                  <div className="ccp-accent" />
                  <input
                    aria-label="Tiêu đề checklist"
                    className="ccp-title-input"
                    disabled={!formControlsEnabled}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Mẫu không có tiêu đề"
                    value={title}
                  />
                  <input
                    aria-label="Mô tả checklist"
                    className="ccp-description-input"
                    disabled={!formControlsEnabled}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Mô tả biểu mẫu"
                    value={description}
                  />
                </div>

                {simpleEditable && (
                <div className="ccp-question-list">
                  {questions.map((question, questionIndex) => (
                    <article className="ccp-question-card" key={question.id}>
                      <div className="ccp-question-main">
                        <input
                          aria-label={`Câu hỏi ${questionIndex + 1}`}
                          className="ccp-question-title"
                          disabled={!formControlsEnabled}
                          onChange={(event) =>
                            updateQuestion(question.id, 'title', event.target.value)
                          }
                          placeholder="Câu hỏi không có tiêu đề"
                          value={question.title}
                        />

                        <QuestionTypeSelect
                          disabled={!formControlsEnabled}
                          onChange={(nextFieldType) =>
                            updateQuestion(question.id, 'fieldType', nextFieldType)
                          }
                          value={question.fieldType}
                        />
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
                                disabled={!formControlsEnabled}
                                onChange={(event) =>
                                  updateOption(question.id, option.id, event.target.value)
                                }
                                placeholder={`Tùy chọn ${optionIndex + 1}`}
                                value={option.label}
                              />
                              <button
                                aria-label="Xóa tùy chọn"
                                className="ccp-icon-button"
                                disabled={!formControlsEnabled || question.options.length <= 1}
                                onClick={() => removeOption(question.id, option.id)}
                                type="button"
                              >
                                <CloseOutlined />
                              </button>
                            </div>
                          ))}

                          <button
                            className="ccp-add-option"
                            disabled={!formControlsEnabled}
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
                          disabled={!formControlsEnabled}
                          onClick={addQuestion}
                          type="button"
                        >
                          <PlusCircleOutlined />
                        </button>
                        <button
                          aria-label="Nhân bản câu hỏi"
                          className="ccp-icon-button"
                          disabled={!formControlsEnabled}
                          onClick={() => duplicateQuestion(question.id)}
                          type="button"
                        >
                          <CopyOutlined />
                        </button>
                        <button
                          aria-label="Xóa câu hỏi"
                          className="ccp-icon-button ccp-icon-button--danger"
                          disabled={!formControlsEnabled}
                          onClick={() => removeQuestion(question.id)}
                          type="button"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                )}
              </section>
              {!simpleEditable && loadedVersion && (
                <ChecklistReadOnlyVersion version={loadedVersion} />
              )}
              </>
              )}
            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Hủy bản nháp checklist"
        message={pendingFormId ? `Hủy checklist #${pendingFormId} đang tạo dở? Dữ liệu này sẽ bị xóa khỏi hệ thống.` : ''}
        danger={true}
        onConfirm={() => {
          executeDiscardPendingDraft()
          setConfirmModal({ isOpen: false })
        }}
        onCancel={() => setConfirmModal({ isOpen: false })}
      />
    </div>
  )
}

export default ChecklistCreatePage
