import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { LeftOutlined, LoadingOutlined } from '@ant-design/icons'
import { generateMockTemplates } from './EmailTemplatesListPage'
import '../styles/EmailTemplateFormPage.css'

const placeholderMap = [
  { raw: '{{userName}}', friendly: '[Tên người dùng]' },
  { raw: '{{employeeCode}}', friendly: '[Mã nhân viên]' },
  { raw: '{{otp}}', friendly: '[Mã OTP]' },
  { raw: '{{resetLink}}', friendly: '[Liên kết đặt lại mật khẩu]' },
  { raw: '{{title}}', friendly: '[Tiêu đề nội dung]' },
  { raw: '{{content}}', friendly: '[Nội dung chi tiết]' },
  { raw: '{{deadline}}', friendly: '[Hạn chót]' },
  { raw: '{{managerName}}', friendly: '[Tên quản lý]' }
]

// Convert from raw database format {{placeholder}} to friendly [Tên tiếng Việt] for UI editing
const toFriendlyFormat = (text) => {
  if (!text) return ''
  let result = text
  placeholderMap.forEach(item => {
    result = result.replaceAll(item.raw, item.friendly)
  })
  return result
}

// Convert from friendly [Tên tiếng Việt] to raw format {{placeholder}} for database saving
const toRawFormat = (text) => {
  if (!text) return ''
  let result = text
  placeholderMap.forEach(item => {
    result = result.replaceAll(item.friendly, item.raw)
  })
  return result
}

function EmailTemplateFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form Fields State
  const [code, setCode] = useState('')
  const [category, setCategory] = useState('Đào tạo')
  const [trigger, setTrigger] = useState('Tự động · hàng tuần')
  const [active, setActive] = useState('Hoạt động')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const mockDatabase = useMemo(() => generateMockTemplates(), [])

  // Helper to load mockup/fallback fields from name/code or localStorage
  const getEnrichedFields = (tpl) => {
    const storedCat = localStorage.getItem(`tpl_cat_${tpl.id}`)
    const storedTrigger = localStorage.getItem(`tpl_trig_${tpl.id}`)

    let defaultCat = storedCat || 'Đào tạo'
    let defaultTrigger = storedTrigger || 'Tự động · hàng tuần'

    if (!storedCat && !storedTrigger) {
      const name = tpl.code?.toLowerCase() || ''
      if (name.includes('thi') || name.includes('trượt') || name.includes('đánh giá')) {
        defaultCat = 'Đánh giá'
        defaultTrigger = name.includes('trượt') ? 'Tự động · khi không đạt' : 'Tự động · được giao'
      } else if (name.includes('tỷ lệ') || name.includes('chất lượng') || name.includes('tuân thủ')) {
        defaultCat = 'Chất lượng'
        defaultTrigger = 'Tự động · hàng ngày'
      }
    }

    return {
      category: defaultCat,
      trigger: defaultTrigger
    }
  }

  // Load template data if editing
  useEffect(() => {
    if (!isEditMode) return

    setLoading(true)
    adminApi.getEmailTemplateById(id)
      .then(res => {
        const tpl = res.data?.data
        if (tpl) {
          setCode(tpl.code || '')
          setSubject(toFriendlyFormat(tpl.subject || ''))
          setBody(toFriendlyFormat(tpl.body || ''))
          setActive(tpl.active ? 'Hoạt động' : 'Ngừng hoạt động')
          
          const enriched = getEnrichedFields(tpl)
          setCategory(enriched.category)
          setTrigger(enriched.trigger)
          setLoading(false)
        } else {
          loadMockFallback()
        }
      })
      .catch(err => {
        console.warn('GET template by ID failed. Using mock fallback.', err)
        loadMockFallback()
      })
  }, [id, isEditMode])

  const loadMockFallback = () => {
    const mockTpl = mockDatabase.find(t => String(t.id) === String(id))
    if (mockTpl) {
      setCode(mockTpl.code || '')
      setSubject(toFriendlyFormat(mockTpl.subject || ''))
      setBody(toFriendlyFormat(mockTpl.body || ''))
      setActive(mockTpl.active ? 'Hoạt động' : 'Ngừng hoạt động')
      
      const enriched = getEnrichedFields(mockTpl)
      setCategory(enriched.category)
      setTrigger(enriched.trigger)
    } else {
      alert('Không tìm thấy biểu mẫu!')
      navigate('/admin/notifications/email-templates')
    }
    setLoading(false)
  }

  // Insert variable tag at current cursor position in textarea
  const handleInsertVariable = (variableText) => {
    const textarea = document.getElementById('bodyTextarea')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = body
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)
    
    setBody(before + variableText + after)

    // Focus and put cursor right after the variable
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variableText.length, start + variableText.length)
    }, 0)
  }

  // Handle Form Submission
  const handleSubmit = (e) => {
    e.preventDefault()

    if (!code.trim() || !subject.trim() || !body.trim()) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)')
      return
    }

    setSubmitting(true)

    const payload = {
      code: code.trim(),
      subject: toRawFormat(subject.trim()),
      body: toRawFormat(body),
      active: active === 'Hoạt động',
      mandatory: false
    }

    const apiPromise = isEditMode
      ? adminApi.updateEmailTemplate(id, payload)
      : adminApi.createEmailTemplate(payload)

    apiPromise
      .then(res => {
        const savedId = res.data?.data?.id || id || Date.now()
        // Save category & trigger selections locally
        localStorage.setItem(`tpl_cat_${savedId}`, category)
        localStorage.setItem(`tpl_trig_${savedId}`, trigger)
        
        alert(isEditMode ? 'Cập nhật biểu mẫu email thành công!' : 'Tạo mới biểu mẫu email thành công!')
        navigate('/admin/notifications/email-templates')
      })
      .catch(err => {
        console.warn('API save failed. Saving locally to mock database.', err)
        
        // Mock fallback persistence
        const savedId = id || String(Date.now())
        localStorage.setItem(`tpl_cat_${savedId}`, category)
        localStorage.setItem(`tpl_trig_${savedId}`, trigger)

        if (isEditMode) {
          const idx = mockDatabase.findIndex(t => String(t.id) === String(id))
          if (idx !== -1) {
            mockDatabase[idx] = {
              ...mockDatabase[idx],
              code: payload.code,
              subject: payload.subject,
              body: payload.body,
              active: payload.active
            }
          }
        } else {
          mockDatabase.push({
            id: mockDatabase.length + 1,
            code: payload.code,
            subject: payload.subject,
            body: payload.body,
            categoryName: category,
            triggerCondition: trigger,
            active: payload.active
          })
        }

        alert(isEditMode ? 'Cập nhật biểu mẫu thành công (Mock)!' : 'Tạo mới biểu mẫu thành công (Mock)!')
        navigate('/admin/notifications/email-templates')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const breadcrumbs = [
    { label: 'Danh sách biểu mẫu email thông báo', link: '/admin/notifications/email-templates' },
    { label: isEditMode ? 'Chỉnh sửa biểu mẫu' : 'Tạo mới biểu mẫu' }
  ]

  const variables = [
    { label: 'Tên người dùng', friendly: '[Tên người dùng]', raw: '{{userName}}' },
    { label: 'Mã nhân viên', friendly: '[Mã nhân viên]', raw: '{{employeeCode}}' },
    { label: 'Mã OTP', friendly: '[Mã OTP]', raw: '{{otp}}' },
    { label: 'Liên kết đặt lại mật khẩu', friendly: '[Liên kết đặt lại mật khẩu]', raw: '{{resetLink}}' },
    { label: 'Tiêu đề nội dung', friendly: '[Tiêu đề nội dung]', raw: '{{title}}' },
    { label: 'Nội dung chi tiết', friendly: '[Nội dung chi tiết]', raw: '{{content}}' },
    { label: 'Hạn chót', friendly: '[Hạn chót]', raw: '{{deadline}}' },
    { label: 'Tên quản lý', friendly: '[Tên quản lý]', raw: '{{managerName}}' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="etf-page">
              
              {/* Title Card */}
              <div className="etf-title-card">
                <h1 className="etf-title">{isEditMode ? 'Chỉnh sửa biểu mẫu' : 'Tạo mới biểu mẫu'}</h1>
                <p className="etf-subtitle">Tự tùy chỉnh nội dung và các biến động của email thông báo.</p>
              </div>

              {/* Form Content */}
              {loading ? (
                <div className="etf-card" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải dữ liệu biểu mẫu...
                </div>
              ) : (
                <form className="etf-card" onSubmit={handleSubmit}>
                  {/* Grid fields */}
                  <div className="etf-grid">
                    <div className="etf-field">
                      <label className="etf-label">Tên biểu mẫu<span>*</span></label>
                      <input
                        type="text"
                        className="etf-input"
                        placeholder="Ví dụ: Cảnh báo giờ CME"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                      />
                    </div>

                    <div className="etf-field">
                      <label className="etf-label">Danh mục</label>
                      <select
                        className="etf-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="Đào tạo">Đào tạo</option>
                        <option value="Đánh giá">Đánh giá</option>
                        <option value="Chất lượng">Chất lượng</option>
                      </select>
                    </div>

                    <div className="etf-field">
                      <label className="etf-label">Điều kiện kích hoạt</label>
                      <select
                        className="etf-select"
                        value={trigger}
                        onChange={(e) => setTrigger(e.target.value)}
                      >
                        <option value="Tự động · hàng tuần">Tự động · hàng tuần</option>
                        <option value="Tự động · được giao">Tự động · được giao</option>
                        <option value="Tự động · khi không đạt">Tự động · khi không đạt</option>
                        <option value="Tự động · hàng ngày">Tự động · hàng ngày</option>
                      </select>
                    </div>

                    <div className="etf-field">
                      <label className="etf-label">Trạng thái</label>
                      <select
                        className="etf-select"
                        value={active}
                        onChange={(e) => setActive(e.target.value)}
                      >
                        <option value="Hoạt động">Hoạt động</option>
                        <option value="Ngừng hoạt động">Ngừng hoạt động</option>
                      </select>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="etf-field">
                    <label className="etf-label">Tiêu đề email<span>*</span></label>
                    <input
                      type="text"
                      className="etf-input"
                      placeholder="Nhập tiêu đề email..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>

                  {/* Body Textarea */}
                  <div className="etf-field">
                    <label className="etf-label">Nội dung email<span>*</span></label>
                    <textarea
                      id="bodyTextarea"
                      className="etf-textarea"
                      placeholder="Nhập nội dung thư..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      required
                    />
                  </div>

                  <div className="etf-variables-block">
                    <span className="etl-variables-title">Từ khóa động hỗ trợ (Click để chèn):</span>
                    {variables.map(v => (
                      <span
                        key={v.raw}
                        className="etf-var-pill"
                        onClick={() => handleInsertVariable(v.friendly)}
                        title={`Click để chèn ${v.friendly} vào nội dung`}
                      >
                        {v.label}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="etf-actions">
                    <button
                      type="submit"
                      className="etf-btn-submit"
                      disabled={submitting}
                    >
                      {submitting ? 'Đang lưu...' : 'Lưu biểu mẫu'}
                    </button>
                    <button
                      type="button"
                      className="etf-btn-cancel"
                      onClick={() => navigate('/admin/notifications/email-templates')}
                      disabled={submitting}
                    >
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
