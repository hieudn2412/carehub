import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DownOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import '../styles/FormBuilderPage.css'

const CHOICE_FIELD_TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN']
const SCORABLE_FIELD_TYPES = ['SINGLE_CHOICE', 'DROPDOWN']
const FIELD_TYPE_LABELS = {
  SINGLE_CHOICE: 'Trắc nghiệm',
  MULTIPLE_CHOICE: 'Hộp kiểm',
  DROPDOWN: 'Menu thả xuống',
  BOOLEAN: 'Đúng / Sai',
  SHORT_TEXT: 'Trả lời ngắn',
  LONG_TEXT: 'Đoạn văn',
  NUMBER: 'Nhập số',
  DATE: 'Ngày',
  DATETIME: 'Ngày và giờ',
  USER_REF: 'Tra cứu nhân viên',
  DEPARTMENT_REF: 'Tra cứu khoa phòng',
}
const ITEM_TYPE_LABELS = {
  QUESTION: 'Câu hỏi',
  TITLE_DESCRIPTION: 'Tiêu đề và mô tả',
  IMAGE: 'Hình ảnh',
  INSTRUCTION: 'Hướng dẫn',
}
const OPTION_MARKER_CLASS = {
  SINGLE_CHOICE: 'radio',
  MULTIPLE_CHOICE: 'checkbox',
  DROPDOWN: 'dropdown',
}
const QUESTION_FIELD_OPTIONS = [
  { value: 'SHORT_TEXT', label: FIELD_TYPE_LABELS.SHORT_TEXT, icon: 'short-text' },
  { value: 'LONG_TEXT', label: FIELD_TYPE_LABELS.LONG_TEXT, icon: 'paragraph' },
  { value: 'SINGLE_CHOICE', label: FIELD_TYPE_LABELS.SINGLE_CHOICE, icon: 'radio' },
  { value: 'MULTIPLE_CHOICE', label: FIELD_TYPE_LABELS.MULTIPLE_CHOICE, icon: 'checkbox' },
  { value: 'DROPDOWN', label: FIELD_TYPE_LABELS.DROPDOWN, icon: 'dropdown' },
  { value: 'BOOLEAN', label: FIELD_TYPE_LABELS.BOOLEAN, icon: 'boolean' },
  { value: 'NUMBER', label: FIELD_TYPE_LABELS.NUMBER, icon: 'number' },
  { value: 'DATE', label: FIELD_TYPE_LABELS.DATE, icon: 'date' },
  { value: 'DATETIME', label: FIELD_TYPE_LABELS.DATETIME, icon: 'datetime' },
  { value: 'USER_REF', label: FIELD_TYPE_LABELS.USER_REF, icon: 'user' },
  { value: 'DEPARTMENT_REF', label: FIELD_TYPE_LABELS.DEPARTMENT_REF, icon: 'department' },
]

function QuestionTypeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = QUESTION_FIELD_OPTIONS.find((option) => option.value === value)
    || QUESTION_FIELD_OPTIONS[0]

  return (
    <div
      className={`fbp-type-select ${open ? 'is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <button
        className="fbp-type-select__trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`fbp-type-icon fbp-type-icon--${selected.icon}`} aria-hidden="true" />
        <span>{selected.label}</span>
        <DownOutlined className="fbp-type-select__chevron" />
      </button>

      {open && (
        <div className="fbp-type-select__menu" role="listbox">
          {QUESTION_FIELD_OPTIONS.map((option) => (
            <button
              className={`fbp-type-select__option ${option.value === value ? 'is-selected' : ''}`}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              role="option"
              type="button"
              aria-selected={option.value === value}
            >
              <span className={`fbp-type-icon fbp-type-icon--${option.icon}`} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper to generate UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function createDefaultQuestion() {
  return {
    questionKey: uuidv4(),
    code: `Q_${Date.now()}`,
    metricCode: null,
    title: 'Câu hỏi mới',
    helpText: '',
    fieldType: 'SINGLE_CHOICE',
    required: true,
    readOnly: false,
    critical: false,
    excludeFromScore: false,
    weight: 1,
    validationConfig: null,
    displayConfig: null,
    options: [
      {
        optionKey: uuidv4(),
        value: 'YES',
        label: 'Đạt',
        scoreValue: 1,
        compliant: true,
        excludeFromDenominator: false,
        displayOrder: 0,
      },
      {
        optionKey: uuidv4(),
        value: 'NO',
        label: 'Không đạt',
        scoreValue: 0,
        compliant: false,
        excludeFromDenominator: false,
        displayOrder: 1,
      },
    ],
  }
}

function FormBuilderPage() {
  const { id, versionId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [versionLoaded, setVersionLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [expandedItems, setExpandedItems] = useState(() => new Set())
  const [advancedItems, setAdvancedItems] = useState(() => new Set())

  // Version schema state
  const [versionNumber, setVersionNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [settings, setSettings] = useState(null)
  const [lockVersion, setLockVersion] = useState(0)
  const [sections, setSections] = useState([])

  const loadVersionDetails = useCallback(() => {
    adminApi.getFormVersionById(id, versionId)
      .then((res) => {
        const ver = res.data?.data
        if (!ver) {
          throw new Error('Phản hồi phiên bản biểu mẫu không hợp lệ.')
        }

        setVersionNumber(ver.versionNumber || 1)
        setTitle(ver.title || '')
        setDescription(ver.description || '')
        setSettings(ver.settings || null)
        setLockVersion(ver.lockVersion || 0)
        setSections(ver.sections || [])
        const firstItem = ver.sections?.[0]?.items?.[0]
        setExpandedItems(firstItem ? new Set([firstItem.itemKey]) : new Set())
        setAdvancedItems(new Set())
        setDirty(false)
        setVersionLoaded(true)
      })
      .catch((err) => {
        console.error('Không thể tải phiên bản biểu mẫu.', err)
        setVersionLoaded(false)
        setErrorMessage(
          err.response?.data?.message || 'Không thể tải cấu trúc biểu mẫu. Vui lòng thử lại.',
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, versionId])

  useEffect(() => {
    loadVersionDetails()
  }, [loadVersionDetails])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  // --- Actions ---

  const updateSections = (nextSections) => {
    setSections(nextSections)
    setDirty(true)
  }

  const getItemKey = (item, sectionIndex, itemIndex) => (
    item.itemKey || `${sectionIndex}-${itemIndex}`
  )

  const toggleItem = (itemKey) => {
    setExpandedItems((current) => {
      if (current.has(itemKey)) {
        return new Set()
      }
      return new Set([itemKey])
    })
  }

  const focusItem = (itemKey) => {
    setExpandedItems(new Set([itemKey]))
    window.requestAnimationFrame(() => {
      document.getElementById(`builder-item-${itemKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const toggleAdvancedItem = (itemKey) => {
    setAdvancedItems((current) => {
      const next = new Set(current)
      if (next.has(itemKey)) {
        next.delete(itemKey)
      } else {
        next.add(itemKey)
      }
      return next
    })
  }

  const handleBack = () => {
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Bạn vẫn muốn rời khỏi trang?')) {
      return
    }
    navigate(`/admin/quality/checklists/${id}/edit`)
  }

  const handleAddSection = () => {
    const newSection = {
      sectionKey: uuidv4(),
      title: 'Phần mới',
      description: '',
      displayOrder: sections.length,
      items: [],
    }
    updateSections([...sections, newSection])
  }

  const handleRemoveSection = (sectionIndex) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phần này cùng toàn bộ câu hỏi bên trong không?')) {
      const updated = sections.filter((_, idx) => idx !== sectionIndex)
      // Re-index sections
      const reindexed = updated.map((sec, i) => ({ ...sec, displayOrder: i }))
      updateSections(reindexed)
    }
  }

  const handleSectionChange = (sectionIndex, field, value) => {
    const updated = [...sections]
    updated[sectionIndex] = { ...updated[sectionIndex], [field]: value }
    updateSections(updated)
  }

  const handleAddItem = (sectionIndex) => {
    const updated = [...sections]
    const itemsList = updated[sectionIndex].items || []
    const newItem = {
      itemKey: uuidv4(),
      itemType: 'QUESTION',
      displayOrder: itemsList.length,
      title: '',
      description: '',
      mediaUrl: null,
      question: createDefaultQuestion(),
    }
    updated[sectionIndex].items = [...itemsList, newItem]
    updateSections(updated)
    setExpandedItems(new Set([newItem.itemKey]))
  }

  const handleRemoveItem = (sectionIndex, itemIndex) => {
    const updated = [...sections]
    const filtered = updated[sectionIndex].items.filter((_, idx) => idx !== itemIndex)
    // Re-index items
    updated[sectionIndex].items = filtered.map((item, i) => ({ ...item, displayOrder: i }))
    updateSections(updated)
  }

  const handleItemChange = (sectionIndex, itemIndex, field, value) => {
    const updated = [...sections]
    const currentItem = updated[sectionIndex].items[itemIndex]
    const nextItem = {
      ...currentItem,
      [field]: value,
    }

    if (field === 'itemType' && value === 'QUESTION' && !currentItem.question) {
      nextItem.question = createDefaultQuestion()
    }

    updated[sectionIndex].items[itemIndex] = nextItem
    updateSections(updated)
  }

  const handleQuestionChange = (sectionIndex, itemIndex, field, value) => {
    const updated = [...sections]
    const q = updated[sectionIndex].items[itemIndex].question || {}
    const nextQuestion = { ...q, [field]: value }

    if (field === 'fieldType') {
      if (CHOICE_FIELD_TYPES.includes(value) && (!q.options || q.options.length === 0)) {
        nextQuestion.options = createDefaultQuestion().options
      }

      if (!SCORABLE_FIELD_TYPES.includes(value)) {
        nextQuestion.excludeFromScore = true
        nextQuestion.critical = false
        nextQuestion.weight = null
      }
    }

    updated[sectionIndex].items[itemIndex].question = nextQuestion
    updateSections(updated)
  }

  const handleAddOption = (sectionIndex, itemIndex) => {
    const updated = [...sections]
    const q = updated[sectionIndex].items[itemIndex].question
    const opts = q.options || []
    const newOpt = {
      optionKey: uuidv4(),
      value: `OPT_${Date.now()}`,
      label: 'Lựa chọn mới',
      scoreValue: 0,
      compliant: true,
      excludeFromDenominator: false,
      displayOrder: opts.length,
    }
    q.options = [...opts, newOpt]
    updateSections(updated)
  }

  const handleRemoveOption = (sectionIndex, itemIndex, optionIndex) => {
    const updated = [...sections]
    const q = updated[sectionIndex].items[itemIndex].question
    const filtered = q.options.filter((_, idx) => idx !== optionIndex)
    q.options = filtered.map((opt, i) => ({ ...opt, displayOrder: i }))
    updateSections(updated)
  }

  const handleOptionChange = (sectionIndex, itemIndex, optionIndex, field, value) => {
    const updated = [...sections]
    const opts = updated[sectionIndex].items[itemIndex].question.options
    opts[optionIndex] = { ...opts[optionIndex], [field]: value }
    updateSections(updated)
  }

  // --- Save ---

  const handleSave = () => {
    if (!versionLoaded) {
      setErrorMessage('Chưa tải được dữ liệu phiên bản nên không thể lưu.')
      return
    }

    // Basic validation
    if (!title) {
      alert('Vui lòng điền tiêu đề phiên bản.')
      return
    }

    // Verify duplicate question codes
    const codes = new Set()
    let duplicateCode = null
    let missingCode = false
    let validationError = ''

    sections.forEach((sec, sectionIndex) => {
      if (!sec.title?.trim() && !validationError) {
        validationError = `Phần ${sectionIndex + 1} cần có tiêu đề.`
      }

      sec.items.forEach((item, itemIndex) => {
        if (item.itemType === 'QUESTION' && item.question) {
          const qcode = item.question.code?.trim().toUpperCase()
          const questionPosition = `Câu hỏi ${itemIndex + 1} của phần ${sectionIndex + 1}`

          if (!item.question.title?.trim() && !validationError) {
            validationError = `${questionPosition} cần có nội dung câu hỏi.`
          }

          if (!qcode) {
            missingCode = true
          } else if (!/^[A-Z0-9_.-]+$/.test(qcode) && !validationError) {
            validationError = `${questionPosition} có mã chứa ký tự không được hỗ trợ.`
          } else if (codes.has(qcode)) {
            duplicateCode = qcode
          } else {
            codes.add(qcode)
          }

          if (CHOICE_FIELD_TYPES.includes(item.question.fieldType)) {
            const options = item.question.options || []
            const optionValues = new Set()

            if (options.length < 2 && !validationError) {
              validationError = `${questionPosition} cần có ít nhất 2 lựa chọn.`
            }

            options.forEach((option) => {
              const normalizedValue = option.value?.trim().toLowerCase()
              if ((!option.label?.trim() || !normalizedValue) && !validationError) {
                validationError = `${questionPosition} có lựa chọn chưa đủ nhãn hoặc giá trị.`
              } else if (optionValues.has(normalizedValue) && !validationError) {
                validationError = `${questionPosition} có giá trị lựa chọn bị trùng.`
              } else {
                optionValues.add(normalizedValue)
              }
            })
          }
        }
      })
    })

    if (validationError) {
      setErrorMessage(validationError)
      return
    }
    if (missingCode) {
      setErrorMessage('Mọi câu hỏi đều phải được đặt mã câu hỏi.')
      return
    }
    if (duplicateCode) {
      setErrorMessage(`Mã câu hỏi "${duplicateCode}" đang bị trùng trong biểu mẫu.`)
      return
    }

    setSaving(true)
    setErrorMessage('')

    // Re-index all elements before saving just to be absolutely sure
    const cleanedSections = sections.map((sec, secIdx) => {
      const cleanedItems = sec.items.map((item, itemIdx) => {
        const cleanedItem = {
          ...item,
          displayOrder: itemIdx,
          title: item.title || null,
          description: item.description || null,
        }

        if (item.itemType === 'QUESTION' && item.question) {
          const q = item.question
          const isChoiceField = CHOICE_FIELD_TYPES.includes(q.fieldType)
          const isScorableField = SCORABLE_FIELD_TYPES.includes(q.fieldType)
          
          cleanedItem.question = {
            ...q,
            code: q.code.trim().toUpperCase(),
            excludeFromScore: isScorableField ? q.excludeFromScore : true,
            critical: isScorableField ? q.critical : false,
            weight: !isScorableField || q.excludeFromScore
              ? null
              : (q.weight ? parseFloat(q.weight) : 1),
            options: isChoiceField ? (q.options || []).map((opt, optIdx) => ({
              ...opt,
              displayOrder: optIdx,
              scoreValue: opt.scoreValue ? parseFloat(opt.scoreValue) : 0,
            })) : [],
          }
        } else {
          cleanedItem.question = null
        }
        return cleanedItem
      })

      return {
        ...sec,
        displayOrder: secIdx,
        description: sec.description || null,
        items: cleanedItems,
      }
    })

    const payload = {
      title,
      description: description || null,
      settings: settings,
      sections: cleanedSections,
      lockVersion: lockVersion,
    }

    adminApi.updateFormVersion(id, versionId, payload)
      .then((res) => {
        alert('Lưu bản thiết kế câu hỏi thành công!')
        setSaving(false)
        if (res.data?.data) {
          setLockVersion(res.data.data.lockVersion || 0)
        }
        setDirty(false)
      })
      .catch((err) => {
        console.error(err)
        if (err.response?.status === 409) {
          setErrorMessage('Dữ liệu biểu mẫu đã được cập nhật ở nơi khác. Hãy tải lại trang trước khi chỉnh sửa tiếp.')
        } else {
          setErrorMessage(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thiết kế câu hỏi.')
        }
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Quản lý checklist', route: '/admin/quality/checklists' },
    { label: 'Cập nhật cấu hình', route: `/admin/quality/checklists/${id}/edit` },
    { label: `Thiết kế v${versionNumber}` },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-builder-page">
              {errorMessage && (
                <div className="fbp-error" role="alert">
                  <span>{errorMessage}</span>
                  {!versionLoaded && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage('')
                        setLoading(true)
                        loadVersionDetails()
                      }}
                    >
                      Thử tải lại
                    </button>
                  )}
                </div>
              )}
              
              {/* Toolbar */}
              <div className="fbp-top-nav">
                <div className="fbp-toolbar-main">
                  <button
                    className="fbp-back"
                    onClick={handleBack}
                    type="button"
                  >
                    <ArrowLeftOutlined />
                    <span>Quay lại</span>
                  </button>
                  <div className="fbp-toolbar-title">
                    <span>Trình thiết kế checklist</span>
                    <strong>{title || `Phiên bản ${versionNumber}`}</strong>
                  </div>
                </div>
                <div className="fbp-toolbar-actions">
                  <span className={`fbp-save-state ${dirty ? 'is-dirty' : 'is-saved'}`}>
                    {dirty ? <QuestionCircleOutlined /> : <CheckCircleOutlined />}
                    {dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}
                  </span>
                  <button
                    className="fbp-btn-save"
                    onClick={handleSave}
                    disabled={saving || loading || !versionLoaded || !dirty}
                    type="button"
                  >
                    {saving ? <LoadingOutlined /> : <><SaveOutlined /> Lưu thay đổi</>}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="fbp-loading">
                  <LoadingOutlined /> Đang tải cấu trúc biểu mẫu...
                </div>
              ) : (
                <div className="fbp-workspace">
                  <aside className="fbp-outline">
                    <div className="fbp-outline__summary">
                      <span>PHIÊN BẢN {versionNumber}</span>
                      <strong>{sections.length} phần</strong>
                      <small>
                        {sections.reduce((total, section) => total + (section.items?.length || 0), 0)}
                        {' '}phần tử
                      </small>
                    </div>
                    <nav className="fbp-outline__nav" aria-label="Mục lục biểu mẫu">
                      {sections.map((section, sectionIndex) => (
                        <div className="fbp-outline__section" key={section.sectionKey || sectionIndex}>
                          <button
                            onClick={() => {
                              document.getElementById(`builder-section-${sectionIndex}`)?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                              })
                            }}
                            type="button"
                          >
                            <span>{sectionIndex + 1}</span>
                            <strong>{section.title || `Phần ${sectionIndex + 1}`}</strong>
                            <small>{section.items?.length || 0} phần tử</small>
                          </button>
                          {(section.items || []).map((item, itemIndex) => {
                            const itemKey = getItemKey(item, sectionIndex, itemIndex)
                            return (
                              <button
                                className="fbp-outline__item"
                                key={itemKey}
                                onClick={() => focusItem(itemKey)}
                                title={item.question?.title || item.title || `Phần tử ${itemIndex + 1}`}
                                type="button"
                              >
                                <span>{itemIndex + 1}</span>
                                {item.question?.title || item.title || `Phần tử ${itemIndex + 1}`}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </nav>
                    <button className="fbp-outline__add" onClick={handleAddSection} type="button">
                      <PlusOutlined /> Thêm phần
                    </button>
                  </aside>

                  <div className="fbp-editor-container">
                  
                  {/* General settings */}
                  <div className="fbp-meta-card">
                    <div className="fbp-meta-heading">
                      <span>Thông tin chung</span>
                      <p>Tên và mô tả hiển thị với người sử dụng checklist.</p>
                    </div>
                    <div className="fbp-form-field">
                      <label>Tiêu đề biểu mẫu</label>
                      <input
                        type="text"
                        className="fbp-input"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value)
                          setDirty(true)
                        }}
                        placeholder="Ví dụ: Đánh giá vệ sinh tay v1"
                      />
                    </div>
                    <div className="fbp-form-field">
                      <label>Mô tả hoặc hướng dẫn chung</label>
                      <input
                        type="text"
                        className="fbp-input"
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value)
                          setDirty(true)
                        }}
                        placeholder="Mô tả hướng dẫn chung..."
                      />
                    </div>
                  </div>

                  {/* Sections list */}
                  <div className="fbp-sections-list">
                    {sections.map((sec, secIdx) => (
                      <div
                        id={`builder-section-${secIdx}`}
                        key={sec.sectionKey || secIdx}
                        className="fbp-section-card"
                      >
                        
                        {/* Section Header */}
                        <div className="fbp-section-header">
                          <div className="fbp-section-header-info">
                            <span className="fbp-order-tag">PHẦN {secIdx + 1}</span>
                            <input
                              type="text"
                              className="fbp-section-title-input"
                              value={sec.title || ''}
                              onChange={(e) => handleSectionChange(secIdx, 'title', e.target.value)}
                              placeholder="Nhập tên phần..."
                            />
                          </div>
                          <button
                            className="fbp-btn-icon-danger"
                            onClick={() => handleRemoveSection(secIdx)}
                            title="Xóa phần này"
                            type="button"
                          >
                            <DeleteOutlined /> Xóa phần
                          </button>
                        </div>
                        
                        <div className="fbp-section-description-row">
                          <input
                            type="text"
                            className="fbp-input-sub"
                            value={sec.description || ''}
                            onChange={(e) => handleSectionChange(secIdx, 'description', e.target.value)}
                            placeholder="Nhập mô tả hoặc ghi chú phụ của phần..."
                          />
                        </div>

                        {/* Items under Section */}
                        <div className="fbp-items-list">
                          {sec.items && sec.items.map((item, itemIdx) => {
                            const itemKey = getItemKey(item, secIdx, itemIdx)
                            const isExpanded = expandedItems.has(itemKey)
                            const isAdvancedOpen = advancedItems.has(itemKey)
                            const itemTitle = item.question?.title
                              || item.title
                              || `${ITEM_TYPE_LABELS[item.itemType] || 'Phần tử'} ${itemIdx + 1}`
                            const itemTypeLabel = item.itemType === 'QUESTION'
                              ? FIELD_TYPE_LABELS[item.question?.fieldType] || 'Câu hỏi'
                              : ITEM_TYPE_LABELS[item.itemType] || 'Phần tử'

                            return (
                            <div
                              id={`builder-item-${itemKey}`}
                              key={itemKey}
                              className={`fbp-item-box fbp-item-box--${item.itemType?.toLowerCase()} ${isExpanded ? 'is-expanded' : ''}`}
                            >
                              <button
                                className="fbp-item-summary"
                                onClick={() => toggleItem(itemKey)}
                                type="button"
                                aria-expanded={isExpanded}
                              >
                                <span className="fbp-item-summary__number">{itemIdx + 1}</span>
                                <span className="fbp-item-summary__text">
                                  <strong>{itemTitle}</strong>
                                  <small>{itemTypeLabel}</small>
                                </span>
                                <span className="fbp-item-summary__badges">
                                  {item.question?.required && <span>Bắt buộc</span>}
                                  {item.question?.critical && <span className="is-critical">Trọng yếu</span>}
                                  {item.question && !item.question.excludeFromScore && <span>Có tính điểm</span>}
                                </span>
                                <span className="fbp-item-summary__chevron" aria-hidden="true">
                                  {isExpanded ? <DownOutlined /> : <RightOutlined />}
                                </span>
                              </button>

                              {isExpanded && (
                              <div className="fbp-item-editor">
                              
                              {/* Item Header */}
                              <div className="fbp-item-header">
                                <div className="fbp-item-selector-group">
                                  <span className="fbp-item-number">#{itemIdx + 1}</span>
                                  <select
                                    className="fbp-mini-select"
                                    value={item.itemType}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'itemType', e.target.value)}
                                  >
                                    <option value="QUESTION">Câu hỏi</option>
                                    <option value="TITLE_DESCRIPTION">Tiêu đề và mô tả</option>
                                    <option value="IMAGE">Hình ảnh</option>
                                    <option value="INSTRUCTION">Hướng dẫn</option>
                                  </select>
                                </div>
                                <div className="fbp-item-actions">
                                  {item.itemType === 'QUESTION' && item.question && (
                                    <button
                                      className={`fbp-btn-advanced ${isAdvancedOpen ? 'is-active' : ''}`}
                                      onClick={() => toggleAdvancedItem(itemKey)}
                                      title="Cài đặt câu hỏi"
                                      type="button"
                                      aria-expanded={isAdvancedOpen}
                                    >
                                      <SettingOutlined /> Cài đặt
                                    </button>
                                  )}
                                  <button
                                    className="fbp-btn-item-delete"
                                    onClick={() => handleRemoveItem(secIdx, itemIdx)}
                                    type="button"
                                  >
                                    <DeleteOutlined /> Xóa phần tử
                                  </button>
                                </div>
                              </div>

                              {/* Item Fields depending on type */}
                              {item.itemType === 'TITLE_DESCRIPTION' && (
                                <div className="fbp-item-fields">
                                  <input
                                    type="text"
                                    className="fbp-input"
                                    placeholder="Tiêu đề đoạn văn bản..."
                                    value={item.title || ''}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'title', e.target.value)}
                                  />
                                  <textarea
                                    className="fbp-textarea"
                                    placeholder="Nội dung văn bản mô tả..."
                                    value={item.description || ''}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'description', e.target.value)}
                                  />
                                </div>
                              )}

                              {item.itemType === 'INSTRUCTION' && (
                                <div className="fbp-item-fields">
                                  <textarea
                                    className="fbp-textarea"
                                    placeholder="Hướng dẫn thao tác cho người dùng..."
                                    value={item.description || ''}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'description', e.target.value)}
                                  />
                                </div>
                              )}

                              {item.itemType === 'IMAGE' && (
                                <div className="fbp-item-fields">
                                  <input
                                    type="text"
                                    className="fbp-input"
                                    placeholder="Đường dẫn ảnh minh họa (mediaUrl)..."
                                    value={item.mediaUrl || ''}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'mediaUrl', e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    className="fbp-input"
                                    placeholder="Tiêu đề ảnh (tùy chọn)..."
                                    value={item.title || ''}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'title', e.target.value)}
                                  />
                                </div>
                              )}

                              {item.itemType === 'QUESTION' && item.question && (
                                <div className="fbp-question-fields">
                                  <div className="fbp-q-row-1">
                                    <div className="fbp-form-field" style={{ flex: 2 }}>
                                      <label>Nội dung câu hỏi</label>
                                      <input
                                        type="text"
                                        className="fbp-input"
                                        value={item.question.title || ''}
                                        onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'title', e.target.value)}
                                        placeholder="Nhập nội dung câu hỏi..."
                                      />
                                    </div>
                                  </div>

                                  {isAdvancedOpen && (
                                    <div className="fbp-advanced-panel">
                                      <div className="fbp-settings-section">
                                        <div>
                                          <strong>Quy tắc câu hỏi</strong>
                                          <p>Thiết lập cách câu hỏi ảnh hưởng tới biểu mẫu.</p>
                                        </div>
                                        <div className="fbp-rule-group" aria-label="Quy tắc câu hỏi">
                                          <label className="fbp-checkbox-label">
                                            <input
                                              type="checkbox"
                                              checked={item.question.required}
                                              onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'required', e.target.checked)}
                                            /> Bắt buộc
                                          </label>
                                          <label className="fbp-checkbox-label" title="Không đạt tiêu chí này sẽ làm rớt toàn bộ bảng kiểm">
                                            <input
                                              type="checkbox"
                                              checked={
                                                SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                                && item.question.critical
                                              }
                                              disabled={
                                                !SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                              }
                                              onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'critical', e.target.checked)}
                                            /> Tiêu chí trọng yếu
                                          </label>
                                        </div>
                                      </div>

                                      <div className="fbp-settings-section">
                                        <div>
                                          <strong>Chấm điểm</strong>
                                          <p>Chọn một trong hai chế độ cho câu hỏi này.</p>
                                        </div>
                                        <div className="fbp-score-settings">
                                          <div className="fbp-score-mode-group" aria-label="Thiết lập chấm điểm">
                                            <label className="fbp-score-choice">
                                              <input
                                                type="radio"
                                                name={`${itemKey}-score-mode`}
                                                value="score"
                                                checked={
                                                  SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                                  && !item.question.excludeFromScore
                                                }
                                                disabled={
                                                  !SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                                }
                                                onChange={() => handleQuestionChange(secIdx, itemIdx, 'excludeFromScore', false)}
                                              />
                                              <span>Tính điểm</span>
                                            </label>
                                            <label className="fbp-score-choice">
                                              <input
                                                type="radio"
                                                name={`${itemKey}-score-mode`}
                                                value="no-score"
                                                checked={
                                                  !SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                                  || item.question.excludeFromScore
                                                }
                                                disabled={
                                                  !SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                                }
                                                onChange={() => handleQuestionChange(secIdx, itemIdx, 'excludeFromScore', true)}
                                              />
                                              <span>Không tính điểm</span>
                                            </label>
                                          </div>

                                          {SCORABLE_FIELD_TYPES.includes(item.question.fieldType)
                                            && !item.question.excludeFromScore && (
                                            <div className="fbp-form-field fbp-weight-field">
                                              <label>Hệ số</label>
                                              <input
                                                type="number"
                                                className="fbp-input"
                                                value={item.question.weight || ''}
                                                onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'weight', e.target.value)}
                                                min="0.1"
                                                step="0.1"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="fbp-settings-section fbp-settings-section--technical">
                                        <div>
                                          <strong>Kỹ thuật</strong>
                                          <p>Mã câu hỏi dùng để đồng bộ với backend/import. Chỉ chỉnh khi cần.</p>
                                        </div>
                                        <div className="fbp-form-field">
                                          <label>Mã câu hỏi</label>
                                          <input
                                            type="text"
                                            className="fbp-input"
                                            value={item.question.code || ''}
                                            onChange={(e) => handleQuestionChange(
                                              secIdx,
                                              itemIdx,
                                              'code',
                                              e.target.value.toUpperCase().replace(/[^A-Z0-9_.-]/g, ''),
                                            )}
                                            placeholder="Vd: VS_TAY_01"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div className="fbp-q-row-2">
                                    <div className="fbp-form-field">
                                      <label>Kiểu câu hỏi</label>
                                      <QuestionTypeSelect
                                        value={item.question.fieldType}
                                        onChange={(nextFieldType) => handleQuestionChange(secIdx, itemIdx, 'fieldType', nextFieldType)}
                                      />
                                    </div>
                                  </div>

                                  <div className="fbp-form-field">
                                    <label>Hướng dẫn hoặc giải thích</label>
                                    <input
                                      type="text"
                                      className="fbp-input"
                                      value={item.question.helpText || ''}
                                      onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'helpText', e.target.value)}
                                      placeholder="Ví dụ: Quan sát hành động trước khi tiếp xúc..."
                                    />
                                  </div>

                                  {/* Render options configs for single/multiple/dropdown choices */}
                                  {CHOICE_FIELD_TYPES.includes(item.question.fieldType) && (
                                    <div className="fbp-options-section">
                                      <div className="fbp-options-header">
                                        <span className="fbp-opts-title">Danh sách lựa chọn</span>
                                        <button
                                          type="button"
                                          className="fbp-btn-add-opt"
                                          onClick={() => handleAddOption(secIdx, itemIdx)}
                                        >
                                          + Thêm lựa chọn
                                        </button>
                                      </div>

                                      <div className="fbp-options-list">
                                        {(item.question.options || []).map((opt, optIdx) => (
                                          <div className="fbp-option-row" key={opt.optionKey || optIdx}>
                                            <span
                                              className={`fbp-option-marker fbp-option-marker--${OPTION_MARKER_CLASS[item.question.fieldType] || 'radio'}`}
                                              aria-hidden="true"
                                            >
                                              {item.question.fieldType === 'DROPDOWN' ? optIdx + 1 : ''}
                                            </span>
                                            <div className="fbp-option-main">
                                              <span className="fbp-option-field-label">
                                                Đáp án
                                              </span>
                                              <input
                                                type="text"
                                                className="fbp-option-label-input"
                                                aria-label={`Nhãn lựa chọn ${optIdx + 1}`}
                                                value={opt.label || ''}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'label', e.target.value)}
                                                placeholder="Ví dụ: Có"
                                              />
                                              {isAdvancedOpen && (
                                                <div className="fbp-option-advanced">
                                                  <label>Giá trị lưu</label>
                                                  <input
                                                    type="text"
                                                    className="fbp-option-value-input"
                                                    value={opt.value || ''}
                                                    onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'value', e.target.value.toUpperCase())}
                                                    placeholder="YES"
                                                  />
                                                </div>
                                              )}
                                            </div>

                                            <label className="fbp-option-score">
                                              <span>Điểm</span>
                                              <input
                                                type="number"
                                                className="fbp-option-score-input"
                                                value={opt.scoreValue !== null ? opt.scoreValue : ''}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'scoreValue', e.target.value)}
                                                placeholder="1"
                                              />
                                            </label>

                                            <label className="fbp-option-compliant">
                                              <input
                                                type="checkbox"
                                                checked={!!opt.compliant}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'compliant', e.target.checked)}
                                              />
                                              <span>Đạt chuẩn</span>
                                            </label>

                                            <button
                                              type="button"
                                              className="fbp-btn-opt-del"
                                              onClick={() => handleRemoveOption(secIdx, itemIdx, optIdx)}
                                              disabled={(item.question.options || []).length <= 1}
                                              title="Xóa lựa chọn"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              )}

                              </div>
                              )}
                            </div>
                            )
                          })}
                        </div>

                        {/* Add Item button */}
                        <button
                          className="fbp-btn-add-item"
                          onClick={() => handleAddItem(secIdx)}
                          type="button"
                        >
                          <PlusOutlined /> Thêm câu hỏi / phần tử mới
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Section Button */}
                  <button className="fbp-btn-add-section" onClick={handleAddSection} type="button">
                    <PlusCircleOutlined /> Thêm phần mới
                  </button>

                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default FormBuilderPage
