import React, { useEffect, useState } from 'react'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { trainingGroupApi } from '../api/trainingGroupApi.js'
import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import '../styles/TrainingGroupFormPage.css'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

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
    httpClient.get('/users', { headers: authHeaders(), params: { size: 500 } })
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
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-content modal-content--lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Chỉnh sửa nhóm đào tạo' : 'Tạo nhóm đào tạo mới'}</h3>
          <button className="modal-close" onClick={() => onClose(false)}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Tên nhóm <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Điều dưỡng mới tuyển"
                maxLength={100}
                required
              />
            </div>
            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                className="form-control"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả mục đích của nhóm đào tạo"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Trạng thái</label>
              <select
                className="form-control"
                value={form.active ? 'active' : 'inactive'}
                onChange={e => setForm({ ...form, active: e.target.value === 'active' })}
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Khóa</option>
              </select>
            </div>
            <div className="form-group">
              <label>Thành viên ({form.memberIds.length} đã chọn)</label>
              <div className="member-select-list">
                {users.length === 0 ? (
                  <p className="text-muted">Đang tải danh sách nhân viên...</p>
                ) : (
                  users.map(user => (
                    <label key={user.id} className="member-checkbox">
                      <input
                        type="checkbox"
                        checked={form.memberIds.includes(user.id)}
                        onChange={() => handleMemberToggle(user.id)}
                      />
                      <span>{user.employeeCode} - {user.name}</span>
                      {user.departmentName && <small className="text-muted"> ({user.departmentName})</small>}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn--secondary" onClick={() => onClose(false)}>Hủy</button>
            <button type="submit" className="btn btn--primary" disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo mới')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TrainingGroupFormPage
