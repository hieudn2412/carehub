import { useEffect, useState } from 'react'
import Modal from '../../../shared/components/Modal.jsx'
import { staffApi } from '../api/staffApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'

function EditProfileModal({ isOpen, profile, onClose, onSaved }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', birthday: '', gender: '' })
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm({
      fullName: profile?.fullName || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      birthday: profile?.birthday || '',
      gender: profile?.gender === true ? 'true' : profile?.gender === false ? 'false' : '',
    })
    setErrorMessage('')
  }, [isOpen, profile])

  if (!isOpen) return null

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    try {
      setSubmitting(true)
      const response = await staffApi.updateProfile({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        birthday: form.birthday || null,
        gender: form.gender === '' ? null : form.gender === 'true',
      })
      onSaved(response.data?.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể cập nhật hồ sơ cá nhân.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal className="profile-edit-modal" title="Chỉnh sửa hồ sơ cá nhân" onClose={submitting ? undefined : onClose} footer={<><button className="ch-btn ch-btn--secondary" disabled={submitting} onClick={onClose} type="button">Hủy</button><button className="ch-btn ch-btn--primary" disabled={submitting} form="edit-profile-form" type="submit">{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</button></>}>
      <form className="profile-edit-form" id="edit-profile-form" onSubmit={handleSubmit}>
        {errorMessage && <div className="modal-alert modal-alert--error" role="alert">{errorMessage}</div>}
        <div className="profile-edit-form__field">
          <label htmlFor="profile-full-name">Họ và tên <span aria-hidden="true">*</span></label>
          <input id="profile-full-name" maxLength={150} onChange={updateField('fullName')} required value={form.fullName} />
        </div>
        <div className="profile-edit-form__field">
          <label htmlFor="profile-email">Email <span aria-hidden="true">*</span></label>
          <input id="profile-email" maxLength={255} onChange={updateField('email')} required type="email" value={form.email} />
        </div>
        <div className="profile-edit-form__field">
          <label htmlFor="profile-phone">Số điện thoại</label>
          <input id="profile-phone" inputMode="tel" maxLength={20} onChange={updateField('phone')} placeholder="Chưa cập nhật" value={form.phone} />
        </div>
        <div className="profile-edit-form__field">
          <label htmlFor="profile-birthday">Ngày sinh</label>
          <input id="profile-birthday" max={new Date().toISOString().slice(0, 10)} onChange={updateField('birthday')} type="date" value={form.birthday} />
        </div>
        <div className="profile-edit-form__field profile-edit-form__field--gender">
          <label htmlFor="profile-gender">Giới tính</label>
          <select id="profile-gender" onChange={updateField('gender')} value={form.gender}><option value="">Chưa cập nhật</option><option value="true">Nam</option><option value="false">Nữ</option></select>
        </div>
        <p className="profile-edit-form__note"><span aria-hidden="true">i</span>Mã nhân viên, khoa/phòng và chức danh do quản trị viên quản lý.</p>
      </form>
    </Modal>
  )
}

export default EditProfileModal
