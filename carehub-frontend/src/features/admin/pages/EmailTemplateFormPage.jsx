import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LoadingOutlined } from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/EmailTemplateFormPage.css'

const EVENT_OPTIONS = {
  CME_HOURS_BELOW_REQUIREMENT: {
    label: 'Cảnh báo thiếu giờ CME',
    category: 'TRAINING',
    audiences: ['EMPLOYEE', 'MANAGER'],
    variables: ['recipient_name', 'manager_name', 'employee_name', 'employee_code', 'current_hours', 'required_hours', 'missing_hours', 'deadline', 'department'],
  },
  EXAM_ASSIGNED: {
    label: 'Thông báo giao bài thi',
    category: 'EVALUATION',
    audiences: ['EMPLOYEE'],
    variables: ['recipient_name', 'employee_name', 'employee_code', 'exam_name', 'due_at', 'max_attempts'],
  },
  QUALITY_COMPLIANCE_BELOW_TARGET: {
    label: 'Cảnh báo tỷ lệ tuân thủ thấp',
    category: 'QUALITY',
    audiences: ['MANAGER'],
    variables: ['recipient_name', 'manager_name', 'department', 'compliance_rate', 'target_rate', 'period'],
  },
  PERSONAL_COMPLIANCE_ISSUE: {
    label: 'Vấn đề tuân thủ cá nhân',
    category: 'QUALITY',
    audiences: ['EMPLOYEE'],
    variables: ['recipient_name', 'employee_name', 'employee_code', 'form_name', 'result', 'score', 'submitted_at'],
  },
}

const CATEGORY_LABELS = { TRAINING: 'Đào tạo', EVALUATION: 'Đánh giá', QUALITY: 'Chất lượng' }
const AUDIENCE_LABELS = { EMPLOYEE: 'Nhân viên', MANAGER: 'Quản lý' }

function generatedCode(name) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
  return normalized ? `CUSTOM_${normalized}`.slice(0, 80) : ''
}

function EmailTemplateFormPage() {
  const { showToast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(id && id !== 'new')
  const bodyRef = useRef(null)
  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [systemManaged, setSystemManaged] = useState(false)
  const [version, setVersion] = useState(null)
  const [allowedVariables, setAllowedVariables] = useState([])
  const [eventOptions, setEventOptions] = useState(EVENT_OPTIONS)
  const [form, setForm] = useState({
    code: '',
    name: '',
    eventType: 'CME_HOURS_BELOW_REQUIREMENT',
    category: 'TRAINING',
    audience: 'EMPLOYEE',
    active: true,
    subject: '',
    body: '',
  })

  useEffect(() => {
    let activeRequest = true
    adminApi.getNotificationEvents()
      .then((response) => {
        if (!activeRequest) return
        const definitions = response.data?.data || []
        if (definitions.length === 0) return
        setEventOptions(Object.fromEntries(definitions.map((definition) => [
          definition.eventType,
          {
            label: definition.displayName,
            category: definition.category,
            audiences: definition.audiences,
            variables: definition.allowedVariables,
          },
        ])))
      })
      .catch((error) => console.error('Không thể tải danh mục sự kiện thông báo', error))
    return () => {
      activeRequest = false
    }
  }, [])

  useEffect(() => {
    if (!isEditMode) return
    let activeRequest = true
    adminApi.getEmailTemplateById(id)
      .then((response) => {
        if (!activeRequest) return
        const template = response.data?.data
        if (!template) throw new Error('Template not found')
        const eventType = template.eventType || 'CME_HOURS_BELOW_REQUIREMENT'
        const definition = EVENT_OPTIONS[eventType]
        setForm({
          code: template.code || '',
          name: template.name || '',
          eventType,
          category: template.category || definition.category,
          audience: template.audience || definition.audiences[0],
          active: template.active,
          subject: template.subject || '',
          body: template.body || '',
        })
        setSystemManaged(Boolean(template.systemManaged))
        setVersion(template.version ?? null)
        setAllowedVariables(template.allowedVariables || [])
      })
      .catch((error) => {
        console.error('Không thể tải biểu mẫu email', error)
        showToast('Không tìm thấy biểu mẫu email.', 'error')
        navigate('/admin/notifications/email-templates')
      })
      .finally(() => {
        if (activeRequest) setLoading(false)
      })
    return () => {
      activeRequest = false
    }
  }, [id, isEditMode, navigate, showToast])

  const variables = useMemo(() => (
    allowedVariables.length > 0 ? allowedVariables : eventOptions[form.eventType].variables
  ), [allowedVariables, eventOptions, form.eventType])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleNameChange = (value) => {
    setForm((current) => ({
      ...current,
      name: value,
      code: isEditMode ? current.code : generatedCode(value),
    }))
  }

  const handleEventChange = (eventType) => {
    const definition = eventOptions[eventType]
    setAllowedVariables([])
    setForm((current) => ({
      ...current,
      eventType,
      category: definition.category,
      audience: definition.audiences[0],
    }))
  }

  const handleInsertVariable = (variable) => {
    const textarea = bodyRef.current
    const placeholder = `{{${variable}}}`
    if (!textarea) {
      updateField('body', form.body + placeholder)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    updateField('body', form.body.slice(0, start) + placeholder + form.body.slice(end))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*).', 'warning')
      return
    }
    setSubmitting(true)
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      subject: form.subject.trim(),
      version,
    }
    try {
      if (isEditMode) {
        await adminApi.updateEmailTemplate(id, payload)
      } else {
        await adminApi.createEmailTemplate(payload)
      }
      showToast(isEditMode ? 'Cập nhật biểu mẫu email thành công!' : 'Tạo biểu mẫu email thành công!', 'success')
      navigate('/admin/notifications/email-templates')
    } catch (error) {
      console.error('Không thể lưu biểu mẫu email', error)
      showToast(error.response?.data?.message || 'Không thể lưu biểu mẫu email.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const eventDefinition = eventOptions[form.eventType]
  const breadcrumbs = [
    { label: 'Danh sách biểu mẫu email thông báo', link: '/admin/notifications/email-templates' },
    { label: isEditMode ? 'Chỉnh sửa biểu mẫu' : 'Tạo mới biểu mẫu' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="etf-page">
              <div className="etf-title-card">
                <h1 className="etf-title">{isEditMode ? 'Chỉnh sửa biểu mẫu' : 'Tạo mới biểu mẫu'}</h1>
                <p className="etf-subtitle">Tùy chỉnh nội dung và biến động của email thông báo.</p>
              </div>

              {loading ? (
                <div className="etf-card" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải dữ liệu biểu mẫu...
                </div>
              ) : (
                <form className="etf-card" onSubmit={handleSubmit}>
                  <div className="etf-grid">
                    <div className="etf-field">
                      <label className="etf-label">Tên biểu mẫu<span>*</span></label>
                      <input className="etf-input" value={form.name} onChange={(event) => handleNameChange(event.target.value)} required />
                    </div>
                    <div className="etf-field">
                      <label className="etf-label">Mã biểu mẫu<span>*</span></label>
                      <input
                        className="etf-input"
                        value={form.code}
                        onChange={(event) => updateField('code', event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                        disabled={systemManaged}
                        required
                      />
                    </div>
                    <div className="etf-field">
                      <label className="etf-label">Sự kiện kích hoạt</label>
                      <select className="etf-select" value={form.eventType} onChange={(event) => handleEventChange(event.target.value)} disabled={systemManaged}>
                        {Object.entries(eventOptions).map(([value, option]) => (
                          <option key={value} value={value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="etf-field">
                      <label className="etf-label">Đối tượng nhận</label>
                      <select
                        className="etf-select"
                        value={form.audience}
                        onChange={(event) => { setAllowedVariables([]); updateField('audience', event.target.value) }}
                        disabled={systemManaged || eventDefinition.audiences.length === 1}
                      >
                        {eventDefinition.audiences.map((audience) => (
                          <option key={audience} value={audience}>{AUDIENCE_LABELS[audience]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="etf-field">
                      <label className="etf-label">Danh mục</label>
                      <input className="etf-input" value={CATEGORY_LABELS[form.category]} disabled />
                    </div>
                    <div className="etf-field">
                      <label className="etf-label">Trạng thái</label>
                      <select className="etf-select" value={form.active ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => updateField('active', event.target.value === 'ACTIVE')}>
                        <option value="ACTIVE">Hoạt động</option>
                        <option value="INACTIVE">Ngừng hoạt động</option>
                      </select>
                    </div>
                  </div>

                  <div className="etf-field">
                    <label className="etf-label">Tiêu đề email<span>*</span></label>
                    <input className="etf-input" value={form.subject} onChange={(event) => updateField('subject', event.target.value)} required />
                  </div>
                  <div className="etf-field">
                    <label className="etf-label">Nội dung email<span>*</span></label>
                    <textarea ref={bodyRef} className="etf-textarea" value={form.body} onChange={(event) => updateField('body', event.target.value)} required />
                  </div>
                  <div className="etf-variables-block">
                    <span className="etl-variables-title">Biến hỗ trợ (nhấn để chèn):</span>
                    {variables.map((variable) => (
                      <button key={variable} type="button" className="etf-var-pill" onClick={() => handleInsertVariable(variable)}>
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                  <div className="etf-actions">
                    <button type="submit" className="etf-btn-submit" disabled={submitting}>
                      {submitting ? 'Đang lưu...' : 'Lưu biểu mẫu'}
                    </button>
                    <button type="button" className="etf-btn-cancel" onClick={() => navigate('/admin/notifications/email-templates')} disabled={submitting}>
                      Huỷ bỏ
                    </button>
                  </div>
                </form>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default EmailTemplateFormPage
