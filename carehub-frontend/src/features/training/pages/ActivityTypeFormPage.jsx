import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import '../styles/training.css'
import '../styles/ActivityTypeListPage.css'

const DURATION_UNITS = [
  { value: 'HOUR', label: 'Tính theo giờ' },
  { value: 'LESSON', label: 'Tính theo tiết học' },
  { value: 'CREDIT', label: 'Tính theo tín chỉ' },
  { value: 'DAY', label: 'Tính theo ngày' },
  { value: 'MONTH', label: 'Tính theo tháng' },
  { value: 'YEAR', label: 'Tính theo năm' },
  { value: 'OTHER', label: 'Khác' },
]

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  defaultDurationUnit: 'HOUR',
  requiresEvidence: true,
  maxCreditedHoursPerRecord: '',
  sortOrder: 0,
  active: true,
  version: null,
}

function ActivityTypeFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [usageCount, setUsageCount] = useState(0)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const codeLocked = useMemo(() => isEdit && usageCount > 0, [isEdit, usageCount])

  useEffect(() => {
    if (!isEdit) return

    let mounted = true
    setIsLoading(true)
    trainingApi
      .getActivityType(id)
      .then((response) => {
        if (!mounted) return
        const item = response.data.data
        setForm({
          code: item.code ?? '',
          name: item.name ?? '',
          description: item.description ?? '',
          defaultDurationUnit: item.defaultDurationUnit ?? 'HOUR',
          requiresEvidence: Boolean(item.requiresEvidence),
          maxCreditedHoursPerRecord: item.maxCreditedHoursPerRecord ?? '',
          sortOrder: item.sortOrder ?? 0,
          active: Boolean(item.active),
          version: item.version,
        })
        setUsageCount(item.usageCount ?? 0)
      })
      .catch((error) => {
        if (!mounted) return
        setErrorMessage(getApiErrorMessage(error, 'Không tải được cách thức đào tạo'))
      })
      .finally(() => {
        if (!mounted) return
        setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [id, isEdit])

  const updateField = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSaving(true)

    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || null,
      defaultDurationUnit: form.defaultDurationUnit,
      requiresEvidence: form.requiresEvidence,
      maxCreditedHoursPerRecord: form.maxCreditedHoursPerRecord
        ? Number(form.maxCreditedHoursPerRecord)
        : null,
      sortOrder: Number(form.sortOrder),
      active: form.active,
      version: form.version,
    }

    try {
      const response = isEdit
        ? await trainingApi.updateActivityType(id, payload)
        : await trainingApi.createActivityType(payload)
      navigate(`/admin/training/activity-types/${response.data.data.id}`)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không lưu được cách thức đào tạo'))
    } finally {
      setIsSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Cách thức đào tạo', link: '/admin/training/activity-types' },
    { label: isEdit ? 'Cập nhật cách thức' : 'Thêm cách thức đào tạo mới' }
  ]

  return (
    <AppShell back={{ to: '/admin/training/activity-types', label: 'Quay lại' }} breadcrumbs={breadcrumbs}>
            <div className="training-form-page-container atl-page">

              {/* Header Panel */}
              <div className="atl-title-card">
                <div>
                  <h1 className="atl-title">{isEdit ? 'Cập nhật cách thức đào tạo' : 'Thêm cách thức đào tạo mới'}</h1>
                  <p className="atl-subtitle">Thiết lập các thông số hoạt động và giới hạn tích lũy giờ</p>
                </div>
              </div>

              {/* Form Content */}
              <div className="training-panel training-panel--form atf-card">
                {isLoading ? (
                  <LoadingState label="Đang tải thông tin biểu mẫu..." />
                ) : (
                  <form className="training-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {errorMessage && (
                      <div className="training-message training-message--error" style={{ padding: '12px 16px', background: '#ffebeb', color: '#d32f2f', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>
                        {errorMessage}
                      </div>
                    )}

                    <div className="atf-field">
                      <label className="atf-label">Mã cách thức *</label>
                      <input
                        type="text"
                        className="atf-input"
                        disabled={codeLocked}
                        maxLength={50}
                        minLength={2}
                        placeholder="Ví dụ: HOI_THAO, TAP_HUAN"
                        onChange={(event) => updateField('code', event.target.value)}
                        required
                        value={form.code}
                      />
                      {codeLocked && <small className="atf-hint">Cách thức này đã phát sinh dữ liệu liên kết nên không thể đổi mã.</small>}
                    </div>

                    <div className="atf-field">
                      <label className="atf-label">Tên cách thức đào tạo *</label>
                      <input
                        type="text"
                        className="atf-input"
                        maxLength={255}
                        placeholder="Nhập tên gọi cách thức..."
                        onChange={(event) => updateField('name', event.target.value)}
                        required
                        value={form.name}
                      />
                    </div>

                    <div className="atf-field">
                      <label className="atf-label">Mô tả chi tiết</label>
                      <textarea
                        className="atf-input"
                        maxLength={2000}
                        rows={4}
                        placeholder="Mô tả tóm tắt ý nghĩa cách thức đào tạo này..."
                        onChange={(event) => updateField('description', event.target.value)}
                        value={form.description}
                      />
                    </div>

                    <div className="ch-form-grid ch-form-grid--3">
                      <div className="atf-field">
                        <label className="atf-label">Đơn vị tính thời gian *</label>
                        <select
                          className="atf-input"
                          onChange={(event) => updateField('defaultDurationUnit', event.target.value)}
                          required
                          value={form.defaultDurationUnit}
                        >
                          {DURATION_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="atf-field">
                        <label className="atf-label">Tối đa giờ / hồ sơ</label>
                        <input
                          type="number"
                          className="atf-input"
                          min="0.01"
                          step="0.01"
                          placeholder="Không giới hạn"
                          onChange={(event) => updateField('maxCreditedHoursPerRecord', event.target.value)}
                          value={form.maxCreditedHoursPerRecord}
                        />
                      </div>

                      <div className="atf-field">
                        <label className="atf-label">Thứ tự hiển thị *</label>
                        <input
                          type="number"
                          className="atf-input"
                          min="0"
                          onChange={(event) => updateField('sortOrder', event.target.value)}
                          required
                          value={form.sortOrder}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '8px 0' }}>
                      <label className="training-check" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                          checked={form.requiresEvidence}
                          onChange={(event) => updateField('requiresEvidence', event.target.checked)}
                        />
                        Bắt buộc cung cấp tài liệu minh chứng đi kèm
                      </label>

                      <label className="training-check" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                          checked={form.active}
                          onChange={(event) => updateField('active', event.target.checked)}
                        />
                        Kích hoạt sử dụng ngay
                      </label>
                    </div>

                    <div className="training-form-actions" style={{ display: 'flex', gap: 12, borderTop: '1px solid #cbd5e1', paddingTop: 20, marginTop: 8 }}>
                      <button
                        className="tr-btn-save"
                        style={{ border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s ease' }}
                        disabled={isSaving}
                        type="submit"
                      >
                        {isSaving ? 'Đang lưu...' : 'Lưu lại'}
                      </button>
                      <Link
                        className="tr-btn-reset"
                        to="/admin/training/activity-types"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s ease' }}
                      >
                        Hủy bỏ
                      </Link>
                    </div>
                  </form>
                )}
              </div>

            </div>
    </AppShell>
  )
}

export default ActivityTypeFormPage
