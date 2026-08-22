import { useEffect, useState } from 'react'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { trainingGroupApi } from '../api/trainingGroupApi.js'
import FormSelectField from '../../../shared/components/FormSelectField.jsx'
import '../styles/TrainingGroupFormPage.css'

function TrainingGroupFormPage({ group, onClose }) {
  const { showToast } = useToast()
  const isEdit = Boolean(group?.id)
  const [isSaving, setIsSaving] = useState(false)
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    memberIds: group?.members?.map(m => m.id) || [],
    active: group?.active !== undefined ? group.active : true,
  })

  // Load available users for member selection
  useEffect(() => {
    trainingGroupApi.listAvailableUsers({ size: 500 })
      .then(res => {
        const data = res.data?.data?.content || res.data?.data || []
        setUsers(Array.isArray(data) ? data : [])
      })
      .catch(() => setUsers([]))
  }, [])

  const handleMemberToggle = (userId) => {
    setForm(prev => {
      const ids = prev.memberIds.includes(userId)
        ? prev.memberIds.filter(id => id !== userId)
        : [...prev.memberIds, userId]
      return { ...prev, memberIds: ids }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      showToast('Vui lòng nhập tên nhóm', 'error')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        memberIds: form.memberIds,
        active: form.active,
      }
      if (isEdit) {
        await trainingGroupApi.update(group.id, payload)
        showToast('Đã cập nhật nhóm đào tạo', 'success')
      } else {
        await trainingGroupApi.create(payload)
        showToast('Đã tạo nhóm đào tạo', 'success')
      }
      onClose(true)
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể lưu nhóm đào tạo', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="ch-modal-backdrop" onClick={() => onClose(false)}>
      <div className="ch-modal ch-modal--lg" onClick={e => e.stopPropagation()}>
        <div className="ch-modal__header">
          <h3>{isEdit ? 'Chỉnh sửa nhóm đào tạo' : 'Tạo nhóm đào tạo mới'}</h3>
          <button className="ch-btn-icon" aria-label="Đóng" onClick={() => onClose(false)}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ch-modal__body">
            <div className="ch-field">
              <label>Tên nhóm <span className="ch-required">*</span></label>
              <input
                type="text"
                className="ch-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Điều dưỡng mới tuyển"
                maxLength={100}
                required
              />
            </div>
            <div className="ch-field">
              <label>Mô tả</label>
              <textarea
                className="ch-input"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả mục đích của nhóm đào tạo"
                rows={3}
              />
            </div>
            <div className="ch-field">
              <label>Trạng thái</label>
              <FormSelectField
                className="ch-input"
                value={form.active ? 'active' : 'inactive'}
                onChange={val => setForm({ ...form, active: val === 'active' })}
                options={[
                  { value: 'active', label: 'Hoạt động' },
                  { value: 'inactive', label: 'Khóa' }
                ]}
              />
            </div>
            <div className="ch-field">
              <label>Thành viên ({form.memberIds.length} đã chọn)</label>
              <div className="member-select-list">
                {users.length === 0 ? (
                  <p className="ch-text-muted">Đang tải danh sách nhân viên...</p>
                ) : (
                  users.map(user => (
                    <label key={user.id} className="member-checkbox">
                      <input
                        type="checkbox"
                        checked={form.memberIds.includes(user.id)}
                        onChange={() => handleMemberToggle(user.id)}
                      />
                      <span>{user.employeeCode} - {user.name}</span>
                      {user.departmentName && <small className="ch-text-muted"> ({user.departmentName})</small>}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="ch-modal__footer">
            <button type="button" className="ch-btn ch-btn--secondary" onClick={() => onClose(false)}>Hủy</button>
            <button type="submit" className="ch-btn ch-btn--primary" disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo mới')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TrainingGroupFormPage
