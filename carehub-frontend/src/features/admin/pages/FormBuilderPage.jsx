import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons'
import '../styles/FormBuilderPage.css'

// Helper to generate UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function FormBuilderPage() {
  const { id, versionId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [useMock, setUseMock] = useState(false)

  // Version schema state
  const [versionNumber, setVersionNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [settings, setSettings] = useState(null)
  const [lockVersion, setLockVersion] = useState(0)
  const [sections, setSections] = useState([])

  useEffect(() => {
    loadVersionDetails()
  }, [id, versionId, useMock])

  const loadVersionDetails = () => {
    setLoading(true)
    adminApi.getFormVersionById(id, versionId)
      .then((res) => {
        const ver = res.data?.data
        if (ver) {
          setVersionNumber(ver.versionNumber || 1)
          setTitle(ver.title || '')
          setDescription(ver.description || '')
          setSettings(ver.settings || null)
          setLockVersion(ver.lockVersion || 0)
          setSections(ver.sections || [])
          setLoading(false)
        } else {
          setUseMock(true)
        }
      })
      .catch((err) => {
        console.warn('GET version detail failed. Falling back to mockup editor state.', err)
        // Mock fallback
        setVersionNumber(1)
        setTitle('Đánh giá an toàn thuốc')
        setDescription('Bản kiểm khảo sát sự tuân thủ quy tắc sử dụng thuốc')
        setLockVersion(0)
        setSections([
          {
            id: 10,
            sectionKey: uuidv4(),
            title: 'Nội dung đánh giá',
            description: 'Các tiêu chí đo lường trực quan tại chỗ',
            displayOrder: 0,
            items: [
              {
                id: 20,
                itemKey: uuidv4(),
                itemType: 'QUESTION',
                displayOrder: 0,
                title: null,
                description: null,
                mediaUrl: null,
                question: {
                  id: 30,
                  questionKey: uuidv4(),
                  code: 'MED_RIGHT_PATIENT',
                  metricCode: 'M1',
                  title: 'Xác định đúng người bệnh trước khi dùng thuốc?',
                  helpText: 'Đối chiếu mã vòng tay người bệnh',
                  fieldType: 'SINGLE_CHOICE',
                  required: true,
                  readOnly: false,
                  critical: true,
                  excludeFromScore: false,
                  weight: 1,
                  validationConfig: null,
                  displayConfig: null,
                  options: [
                    {
                      id: 40,
                      optionKey: uuidv4(),
                      value: 'YES',
                      label: 'Có',
                      scoreValue: 1,
                      compliant: true,
                      excludeFromDenominator: false,
                      displayOrder: 0,
                    },
                    {
                      id: 41,
                      optionKey: uuidv4(),
                      value: 'NO',
                      label: 'Không',
                      scoreValue: 0,
                      compliant: false,
                      excludeFromDenominator: false,
                      displayOrder: 1,
                    },
                  ],
                },
              },
            ],
          },
        ])
        setUseMock(true)
        setLoading(false)
      })
  }

  // --- Actions ---

  const handleAddSection = () => {
    const newSection = {
      sectionKey: uuidv4(),
      title: 'Section mới',
      description: '',
      displayOrder: sections.length,
      items: [],
    }
    setSections([...sections, newSection])
  }

  const handleRemoveSection = (sectionIndex) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa section này cùng toàn bộ các câu hỏi bên trong không?')) {
      const updated = sections.filter((_, idx) => idx !== sectionIndex)
      // Re-index sections
      const reindexed = updated.map((sec, i) => ({ ...sec, displayOrder: i }))
      setSections(reindexed)
    }
  }

  const handleSectionChange = (sectionIndex, field, value) => {
    const updated = [...sections]
    updated[sectionIndex] = { ...updated[sectionIndex], [field]: value }
    setSections(updated)
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
      question: {
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
      },
    }
    updated[sectionIndex].items = [...itemsList, newItem]
    setSections(updated)
  }

  const handleRemoveItem = (sectionIndex, itemIndex) => {
    const updated = [...sections]
    const filtered = updated[sectionIndex].items.filter((_, idx) => idx !== itemIndex)
    // Re-index items
    updated[sectionIndex].items = filtered.map((item, i) => ({ ...item, displayOrder: i }))
    setSections(updated)
  }

  const handleItemChange = (sectionIndex, itemIndex, field, value) => {
    const updated = [...sections]
    updated[sectionIndex].items[itemIndex] = {
      ...updated[sectionIndex].items[itemIndex],
      [field]: value,
    }
    setSections(updated)
  }

  const handleQuestionChange = (sectionIndex, itemIndex, field, value) => {
    const updated = [...sections]
    const q = updated[sectionIndex].items[itemIndex].question || {}
    updated[sectionIndex].items[itemIndex].question = { ...q, [field]: value }
    setSections(updated)
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
    setSections(updated)
  }

  const handleRemoveOption = (sectionIndex, itemIndex, optionIndex) => {
    const updated = [...sections]
    const q = updated[sectionIndex].items[itemIndex].question
    const filtered = q.options.filter((_, idx) => idx !== optionIndex)
    q.options = filtered.map((opt, i) => ({ ...opt, displayOrder: i }))
    setSections(updated)
  }

  const handleOptionChange = (sectionIndex, itemIndex, optionIndex, field, value) => {
    const updated = [...sections]
    const opts = updated[sectionIndex].items[itemIndex].question.options
    opts[optionIndex] = { ...opts[optionIndex], [field]: value }
    setSections(updated)
  }

  // --- Save ---

  const handleSave = () => {
    // Basic validation
    if (!title) {
      alert('Vui lòng điền tiêu đề phiên bản.')
      return
    }

    // Verify duplicate question codes
    const codes = new Set()
    let duplicateCode = null
    let missingCode = false
    let hasOrderConflict = false

    sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (item.itemType === 'QUESTION' && item.question) {
          const qcode = item.question.code?.trim()
          if (!qcode) {
            missingCode = true
          } else if (codes.has(qcode)) {
            duplicateCode = qcode
          } else {
            codes.add(qcode)
          }
        }
      })
    })

    if (missingCode) {
      alert('Lỗi: Mọi câu hỏi đều phải được đặt mã câu hỏi (Question Code).')
      return
    }
    if (duplicateCode) {
      alert(`Lỗi: Trùng lặp mã câu hỏi "${duplicateCode}". Mã câu hỏi phải là duy nhất trong biểu mẫu.`)
      return
    }

    setSaving(true)

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
          const isChoiceField = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(q.fieldType)
          
          cleanedItem.question = {
            ...q,
            code: q.code.trim().toUpperCase(),
            weight: q.excludeFromScore ? null : (q.weight ? parseFloat(q.weight) : 1),
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

    if (useMock) {
      setTimeout(() => {
        setSaving(false)
        setLockVersion(prev => prev + 1)
        alert('Lưu bản thiết kế thành công! (Giả lập)')
      }, 500)
      return
    }

    adminApi.updateFormVersion(id, versionId, payload)
      .then((res) => {
        alert('Lưu bản thiết kế câu hỏi thành công!')
        setSaving(false)
        if (res.data?.data) {
          setLockVersion(res.data.data.lockVersion || 0)
        }
      })
      .catch((err) => {
        setSaving(false)
        console.error(err)
        if (err.response?.status === 409) {
          alert('Lỗi xung đột phiên bản (409): Dữ liệu biểu mẫu đã được cập nhật ở nơi khác. Vui lòng làm mới trang và chỉnh sửa lại.')
        } else {
          alert(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thiết kế câu hỏi.')
        }
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
              
              {/* Toolbar */}
              <div className="fbp-top-nav">
                <div className="fbp-back" onClick={() => navigate(`/admin/quality/checklists/${id}/edit`)}>
                  <ArrowLeftOutlined /> Quay lại cấu hình biểu mẫu
                </div>
                <button className="fbp-btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? <LoadingOutlined /> : <><SaveOutlined /> Lưu thiết kế</>}
                </button>
              </div>

              {loading ? (
                <div className="fbp-loading">
                  <LoadingOutlined /> Đang tải cấu trúc biểu mẫu...
                </div>
              ) : (
                <div className="fbp-editor-container">
                  
                  {/* General settings */}
                  <div className="fbp-meta-card">
                    <div className="fbp-form-field">
                      <label>Tiêu đề phiên bản hiển thị:</label>
                      <input
                        type="text"
                        className="fbp-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ví dụ: Đánh giá vệ sinh tay v1"
                      />
                    </div>
                    <div className="fbp-form-field">
                      <label>Mô tả bổ sung của phiên bản:</label>
                      <input
                        type="text"
                        className="fbp-input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả hướng dẫn chung..."
                      />
                    </div>
                  </div>

                  {/* Sections list */}
                  <div className="fbp-sections-list">
                    {sections.map((sec, secIdx) => (
                      <div key={sec.sectionKey || secIdx} className="fbp-section-card">
                        
                        {/* Section Header */}
                        <div className="fbp-section-header">
                          <div className="fbp-section-header-info">
                            <span className="fbp-order-tag">PHẦN {secIdx + 1}</span>
                            <input
                              type="text"
                              className="fbp-section-title-input"
                              value={sec.title || ''}
                              onChange={(e) => handleSectionChange(secIdx, 'title', e.target.value)}
                              placeholder="Nhập tên phần (Section title)..."
                            />
                          </div>
                          <button
                            className="fbp-btn-icon-danger"
                            onClick={() => handleRemoveSection(secIdx)}
                            title="Xóa section này"
                          >
                            <DeleteOutlined /> Xóa Phần
                          </button>
                        </div>
                        
                        <div style={{ marginBottom: 16 }}>
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
                          {sec.items && sec.items.map((item, itemIdx) => (
                            <div key={item.itemKey || itemIdx} className="fbp-item-box">
                              
                              {/* Item Header */}
                              <div className="fbp-item-header">
                                <div className="fbp-item-selector-group">
                                  <span className="fbp-item-number">#{itemIdx + 1}</span>
                                  <select
                                    className="fbp-mini-select"
                                    value={item.itemType}
                                    onChange={(e) => handleItemChange(secIdx, itemIdx, 'itemType', e.target.value)}
                                  >
                                    <option value="QUESTION">Câu hỏi đánh giá (Question)</option>
                                    <option value="TITLE_DESCRIPTION">Khối văn bản tự do (Header)</option>
                                    <option value="IMAGE">Khối hình ảnh (Image)</option>
                                    <option value="INSTRUCTION">Lời khuyên / Hướng dẫn (Instruction)</option>
                                  </select>
                                </div>
                                <button
                                  className="fbp-btn-item-delete"
                                  onClick={() => handleRemoveItem(secIdx, itemIdx)}
                                >
                                  Xóa
                                </button>
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
                                      <label>Tiêu đề câu hỏi / Tiêu chí đánh giá:</label>
                                      <input
                                        type="text"
                                        className="fbp-input"
                                        value={item.question.title || ''}
                                        onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'title', e.target.value)}
                                        placeholder="Nhập nội dung câu hỏi..."
                                      />
                                    </div>
                                    <div className="fbp-form-field" style={{ flex: 1 }}>
                                      <label>Mã câu hỏi (Unique Code):</label>
                                      <input
                                        type="text"
                                        className="fbp-input"
                                        value={item.question.code || ''}
                                        onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'code', e.target.value.toUpperCase())}
                                        placeholder="Vd: VS_TAY_01"
                                      />
                                    </div>
                                  </div>

                                  <div className="fbp-q-row-2">
                                    <div className="fbp-form-field">
                                      <label>Kiểu câu hỏi:</label>
                                      <select
                                        className="fbp-select-control"
                                        value={item.question.fieldType}
                                        onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'fieldType', e.target.value)}
                                      >
                                        <option value="SINGLE_CHOICE">Trắc nghiệm chọn một (Radio)</option>
                                        <option value="MULTIPLE_CHOICE">Chọn nhiều lựa chọn (Checkbox)</option>
                                        <option value="DROPDOWN">Dropdown List</option>
                                        <option value="BOOLEAN">Switch Đúng/Sai (Yes/No)</option>
                                        <option value="SHORT_TEXT">Văn bản ngắn (Short text)</option>
                                        <option value="LONG_TEXT">Ý kiến / Nhận xét (Long text)</option>
                                        <option value="NUMBER">Nhập số lượng (Number)</option>
                                        <option value="DATE">Ngày (Date)</option>
                                        <option value="DATETIME">Ngày & Giờ (DateTime)</option>
                                        <option value="USER_REF">Tra cứu nhân viên y tế</option>
                                        <option value="DEPARTMENT_REF">Tra cứu khoa phòng</option>
                                      </select>
                                    </div>

                                    <div className="fbp-q-row-checkboxes">
                                      <label className="fbp-checkbox-label">
                                        <input
                                          type="checkbox"
                                          checked={item.question.required}
                                          onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'required', e.target.checked)}
                                        /> Bắt buộc nhập
                                      </label>
                                      <label className="fbp-checkbox-label" title="Không đạt tiêu chí này sẽ làm rớt toàn bộ bảng kiểm">
                                        <input
                                          type="checkbox"
                                          checked={item.question.critical}
                                          onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'critical', e.target.checked)}
                                        /> Tiêu chí Trọng yếu (Critical)
                                      </label>
                                      <label className="fbp-checkbox-label">
                                        <input
                                          type="checkbox"
                                          checked={item.question.excludeFromScore}
                                          onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'excludeFromScore', e.target.checked)}
                                        /> Không tính điểm
                                      </label>
                                    </div>

                                    {!item.question.excludeFromScore && (
                                      <div className="fbp-form-field" style={{ width: '100px' }}>
                                        <label>Trọng số:</label>
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

                                  <div className="fbp-form-field">
                                    <label>Văn bản hướng dẫn / Giải thích:</label>
                                    <input
                                      type="text"
                                      className="fbp-input"
                                      value={item.question.helpText || ''}
                                      onChange={(e) => handleQuestionChange(secIdx, itemIdx, 'helpText', e.target.value)}
                                      placeholder="Ví dụ: Quan sát hành động trước khi tiếp xúc..."
                                    />
                                  </div>

                                  {/* Render options configs for single/multiple/dropdown choices */}
                                  {['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DROPDOWN'].includes(item.question.fieldType) && (
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

                                      <div className="fbp-options-grid">
                                        <div className="fbp-opt-th">Nhãn hiển thị (Label)</div>
                                        <div className="fbp-opt-th">Giá trị lưu (Value)</div>
                                        <div className="fbp-opt-th">Điểm số</div>
                                        <div className="fbp-opt-th" style={{ textAlign: 'center' }}>Đạt chuẩn?</div>
                                        <div className="fbp-opt-th" style={{ textAlign: 'center' }}>Hành động</div>

                                        {(item.question.options || []).map((opt, optIdx) => (
                                          <React.Fragment key={opt.optionKey || optIdx}>
                                            <div>
                                              <input
                                                type="text"
                                                className="fbp-opt-input"
                                                value={opt.label || ''}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'label', e.target.value)}
                                                placeholder="Ví dụ: Có"
                                              />
                                            </div>
                                            <div>
                                              <input
                                                type="text"
                                                className="fbp-opt-input"
                                                value={opt.value || ''}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'value', e.target.value.toUpperCase())}
                                                placeholder="YES"
                                              />
                                            </div>
                                            <div>
                                              <input
                                                type="number"
                                                className="fbp-opt-input"
                                                value={opt.scoreValue !== null ? opt.scoreValue : ''}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'scoreValue', e.target.value)}
                                                placeholder="1"
                                              />
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <input
                                                type="checkbox"
                                                checked={!!opt.compliant}
                                                onChange={(e) => handleOptionChange(secIdx, itemIdx, optIdx, 'compliant', e.target.checked)}
                                              />
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                              <button
                                                type="button"
                                                className="fbp-btn-opt-del"
                                                onClick={() => handleRemoveOption(secIdx, itemIdx, optIdx)}
                                                disabled={(item.question.options || []).length <= 1}
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              )}

                            </div>
                          ))}
                        </div>

                        {/* Add Item button */}
                        <button className="fbp-btn-add-item" onClick={() => handleAddItem(secIdx)}>
                          <PlusOutlined /> Thêm câu hỏi / phần tử mới
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Section Button */}
                  <button className="fbp-btn-add-section" onClick={handleAddSection}>
                    <PlusCircleOutlined /> Thêm phần mới (Add Section)
                  </button>

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
