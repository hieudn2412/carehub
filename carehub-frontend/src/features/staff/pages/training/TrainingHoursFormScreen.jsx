import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  CalendarOutlined,
  SaveOutlined,
  CloseOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/TrainingHours.css'

function TrainingHoursFormScreen() {
  const { id } = useParams() // empty if creating, exists if editing
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isEditMode = !!id

  const [form, setForm] = useState({
    name: '',
    date: '',
    hours: '',
    type: '',
    organizer: '',
    notes: '',
  })
  const [options, setOptions] = useState([]) // Activity types
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordVersion, setRecordVersion] = useState(null)

  // Fetch options (activity types) on mount
  useEffect(() => {
    setLoading(true)
    trainingApi.getRecordOptions()
      .then(res => {
        setOptions(res.data?.data?.activityTypes || [])
      })
      .catch(err => {
        console.error("Error fetching options", err)
      })
      .finally(() => {
        if (!isEditMode) setLoading(false)
      })
  }, [isEditMode])

  // Fetch record detail if in edit mode
  useEffect(() => {
    if (isEditMode) {
      setLoading(true)
      trainingApi.getRecord(id)
        .then(res => {
          const record = res.data?.data
          if (record) {
            if (record.workflowStatus !== 'DRAFT') {
              showToast("Chỉ có thể chỉnh sửa hồ sơ ở trạng thái Bản nháp.", "warning")
              navigate('/staff/training')
              return
            }
            setForm({
              name: record.title || '',
              date: record.startDate || '',
              hours: record.declaredHours ? String(record.declaredHours) : '',
              type: record.activityTypeId ? String(record.activityTypeId) : '',
              organizer: record.provider || '',
              notes: record.description || '',
            })
            setRecordVersion(record.version)
          }
        })
        .catch(err => {
          console.error("Error fetching record for editing", err)
          showToast("Không thể tải thông tin hồ sơ để chỉnh sửa.", "error")
          navigate('/staff/training')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [id, isEditMode, navigate])

  const required = ['name', 'date', 'hours', 'type']

  const validate = () => {
    const e = {}
    required.forEach(k => {
      if (!form[k]) e[k] = true
    })

    if (form.hours) {
      const hVal = parseFloat(form.hours)
      if (isNaN(hVal) || hVal < 0.5) {
        e.hours = 'Số giờ phải >= 0.5'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0;
  }

  const handleSave = () => {
    if (!validate()) return

    setSaving(true)
    const payload = {
      title: form.name,
      startDate: form.date,
      declaredHours: parseFloat(form.hours),
      activityTypeId: form.type ? parseInt(form.type, 10) : null,
      provider: form.organizer || null,
      description: form.notes || null,
      durationValue: parseFloat(form.hours),
      durationUnit: 'HOUR',
      version: isEditMode ? recordVersion : undefined,
    }

    const apiCall = isEditMode
      ? trainingApi.updateRecord(id, payload)
      : trainingApi.createRecord(payload)

    apiCall
      .then((res) => {
        const savedRecord = res.data?.data
        showToast(isEditMode ? "Cập nhật thành công!" : "Tạo mới thành công!", "success")
        
        // If creating a new record, automatically submit it to move from DRAFT to SUBMITTED
        if (!isEditMode && savedRecord && savedRecord.id) {
          trainingApi.submitRecord(savedRecord.id, { version: savedRecord.version })
            .then(() => {
              navigate('/staff/training')
            })
            .catch(err => {
              console.error("Error submitting record", err)
              navigate('/staff/training')
            })
        } else {
          navigate('/staff/training')
        }
      })
      .catch(err => {
        console.error("Error saving record", err)
        showToast("Lưu biểu mẫu thất bại. Vui lòng kiểm tra lại thông tin.", "error")
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const fieldStyle = (key) => ({
    width: '100%',
    padding: '10px 14px',
    border: `1px solid ${errors[key] ? '#ef4444' : '#e5e7eb'}`,
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
    transition: 'border-color 0.15s',
  })

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Giờ đào tạo', link: '/staff/training' },
          { label: isEditMode ? 'Chỉnh sửa' : 'Thêm hồ sơ' }
        ]} />
        <div className="dashboard-layout__body">
          <div className="training-page">

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Đang tải thông tin biểu mẫu...</div>
            ) : (
              <div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
                    {isEditMode ? 'Chỉnh sửa hồ sơ đào tạo' : 'Thêm hồ sơ đào tạo'}
                  </h1>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                    Nhập thông tin chi tiết của hoạt động đào tạo đã hoàn thành
                  </p>
                </div>

                <div className="detail-card">
                  {/* Name */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Tên khoá đào tạo <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ví dụ: Hồi sức cấp cứu cơ bản"
                      style={fieldStyle('name')}
                    />
                    {errors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>Bắt buộc nhập</span>}
                  </div>

                  {/* Date + Hours */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Ngày bắt đầu <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="date"
                          value={form.date}
                          onChange={e => setForm({ ...form, date: e.target.value })}
                          style={{ ...fieldStyle('date'), paddingLeft: 38 }}
                        />
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                          <CalendarOutlined style={{ color: '#9ca3af' }} />
                        </span>
                      </div>
                      {errors.date && <span style={{ color: '#ef4444', fontSize: 12 }}>Bắt buộc chọn ngày</span>}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Số giờ CME <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        value={form.hours}
                        onChange={e => setForm({ ...form, hours: e.target.value })}
                        placeholder="Ví dụ: 8"
                        style={fieldStyle('hours')}
                      />
                      {errors.hours && (
                        <span style={{ color: '#ef4444', fontSize: 12 }}>
                          {typeof errors.hours === 'string' ? errors.hours : 'Bắt buộc nhập số giờ'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Type + Provider */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Hình thức đào tạo <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value })}
                        style={{
                          ...fieldStyle('type'),
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                        }}
                      >
                        <option value="">Chọn hình thức</option>
                        {options.map(opt => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                      {errors.type && <span style={{ color: '#ef4444', fontSize: 12 }}>Bắt buộc chọn hình thức</span>}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Đơn vị tổ chức
                      </label>
                      <input
                        value={form.organizer}
                        onChange={e => setForm({ ...form, organizer: e.target.value })}
                        placeholder="Ví dụ: Bệnh viện Việt Đức"
                        style={fieldStyle('organizer')}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Ghi chú / Mô tả
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Mô tả ngắn gọn về nội dung..."
                      rows={4}
                      style={{ ...fieldStyle('notes'), resize: 'vertical' }}
                    />
                  </div>

                  {/* Form Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => navigate('/staff/training')}
                      style={{
                        padding: '10px 24px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#374151',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      disabled={saving}
                    >
                      <CloseOutlined /> Huỷ bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      style={{
                        padding: '10px 24px',
                        border: 'none',
                        borderRadius: 8,
                        background: '#1aaa84',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      disabled={saving}
                    >
                      <SaveOutlined /> {saving ? 'Đang lưu...' : 'Lưu biểu mẫu'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingHoursFormScreen
