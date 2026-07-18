import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import '../styles/training.css'

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
        setErrorMessage(getApiErrorMessage(error, 'Không tải được loại đào tạo'))
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
      setErrorMessage(getApiErrorMessage(error, 'Không lưu được hình thức đào tạo'))
    } finally {
      setIsSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Các hình thức đào tạo', link: '/admin/training/activity-types' },
    { label: isEdit ? 'Cập nhật hình thức' : 'Thêm hình thức đào tạo mới' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="training-form-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Header Panel */}
              <div className="atl-title-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 className="atl-title">{isEdit ? 'Cập nhật hình thức đào tạo' : 'Thêm hình thức đào tạo mới'}</h1>
                  <p className="atl-subtitle">Thiết lập các thông số hoạt động và giới hạn tích lũy giờ</p>
                </div>
                <div>
                  <Link className="training-button" to="/admin/training/activity-types" style={{ textDecoration: 'none' }}>
                    Quay lại
                  </Link>
                </div>
              </div>

              {/* Form Content */}
              <div className="training-panel training-panel--form" style={{ background: '#fff', borderRadius: 16, border: '1px solid #cbd5e1', padding: 32, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)' }}>
                {isLoading ? (
                  <div className="training-skeleton" style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    Đang tải thông tin biểu mẫu...
                  </div>
                ) : (
                  <form className="training-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {errorMessage && (
                      <div className="training-message training-message--error" style={{ padding: '12px 16px', background: '#ffebeb', color: '#d32f2f', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>
                        {errorMessage}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Mã hình thức *</label>
                      <input
                        type="text"
                        style={{ border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#334155', background: codeLocked ? '#f1f5f9' : '#fff' }}
                        disabled={codeLocked}
                        maxLength={50}
                        minLength={2}
                        placeholder="Ví dụ: HOI_THAO, TAP_HUAN"
                        onChange={(event) => updateField('code', event.target.value)}
                        required
                        value={form.code}
                      />
                      {codeLocked && <small style={{ color: '#64748b', fontSize: 12 }}>Hình thức này đã phát sinh dữ liệu liên kết nên không thể đổi mã.</small>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Tên hình thức đào tạo *</label>
                      <input
                        type="text"
                        style={{ border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#334155' }}
                        maxLength={255}
                        placeholder="Nhập tên gọi hình thức..."
                        onChange={(event) => updateField('name', event.target.value)}
                        required
                        value={form.name}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Mô tả chi tiết</label>
                      <textarea
                        style={{ border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#334155', fontFamily: 'inherit' }}
                        maxLength={2000}
                        rows={4}
                        placeholder="Mô tả tóm tắt ý nghĩa hình thức đào tạo này..."
                        onChange={(event) => updateField('description', event.target.value)}
                        value={form.description}
                      />
                    </div>

                    <div className="training-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Đơn vị tính thời gian *</label>
                        <select
                          style={{ border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#334155', background: '#fff', cursor: 'pointer' }}
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

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Tối đa giờ / hồ sơ</label>
                        <input
                          type="number"
                          style={{ border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#334155' }}
                          min="0.01"
                          step="0.01"
                          placeholder="Không giới hạn"
                          onChange={(event) => updateField('maxCreditedHoursPerRecord', event.target.value)}
                          value={form.maxCreditedHoursPerRecord}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Thứ tự hiển thị *</label>
                        <input
                          type="number"
                          style={{ border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#334155' }}
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
          </main>
        </div>
      </div>
    </div>
  )
}

export default ActivityTypeFormPage
