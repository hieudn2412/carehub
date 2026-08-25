import { useEffect, useState } from 'react'
import Modal from '../../../shared/components/Modal.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import { staffApi } from '../api/staffApi.js'
import { getApiErrorMessage } from '../../../shared/api/apiError.js'

function EditProfileModal({ isOpen, profile, onClose, onSaved }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', birthday: '', gender: '' })
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const today = new Date()
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().slice(0, 10)
  const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()).toISOString().slice(0, 10)

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

  const handlePhoneChange = (event) => {
    let inputVal = event.target.value
    
    if (!inputVal) {
      setForm((current) => ({ ...current, phone: '' }))
      return
    }

    let cleaned = inputVal.replace(/[^\d+]/g, '')

    if (cleaned.startsWith('0')) {
      cleaned = '+84' + cleaned.substring(1)
    } else if (cleaned.length > 0 && /^[1-9]/.test(cleaned)) {
      if (cleaned.startsWith('84')) {
        cleaned = '+' + cleaned
      } else {
        cleaned = '+84' + cleaned
      }
    }

    if (cleaned.startsWith('+840')) {
      cleaned = '+84' + cleaned.substring(4)
    }

    if (cleaned.length > 12) {
      cleaned = cleaned.substring(0, 12)
    }

    setForm((current) => ({ ...current, phone: cleaned }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    const phoneVal = form.phone.trim()
    if (phoneVal && phoneVal !== '+84' && phoneVal.length !== 12) {
      setErrorMessage('Số điện thoại không hợp lệ. Vui lòng nhập đủ 10 số.')
      return
    }

    if (form.birthday) {
      const birthDate = new Date(form.birthday)
      const todayDate = new Date()
      let age = todayDate.getFullYear() - birthDate.getFullYear()
      const m = todayDate.getMonth() - birthDate.getMonth()
      if (m < 0 || (m === 0 && todayDate.getDate() < birthDate.getDate())) {
        age--
      }
      if (age < 18 || age > 100) {
        setErrorMessage('Độ tuổi không hợp lệ. Nhân viên phải từ 18 đến 100 tuổi.')
        return
      }
    }

    try {
      setSubmitting(true)
      const response = await staffApi.updateProfile({
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        phone: (phoneVal === '+84' ? null : phoneVal) || null,
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
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" maxLength={255} onChange={updateField('email')} type="email" value={form.email} />
        </div>
        <div className="profile-edit-form__field">
          <label htmlFor="profile-phone">Số điện thoại</label>
          <input id="profile-phone" inputMode="tel" maxLength={12} onChange={handlePhoneChange} placeholder="+84" value={form.phone} />
        </div>
        <div className="profile-edit-form__field">
          <label htmlFor="profile-birthday">Ngày sinh</label>
          <KeyboardDatePicker id="profile-birthday" min={minDate} max={maxDate} onChange={(val) => setForm((current) => ({ ...current, birthday: val }))} value={form.birthday} />
        </div>
        <div className="profile-edit-form__field profile-edit-form__field--gender">
          <label htmlFor="profile-gender">Giới tính</label>
          <SearchableSelect
            id="profile-gender"
            onChange={val => updateField('gender')({ target: { value: val } })}
            value={form.gender}
            searchable={false}
            placeholder="Chưa cập nhật"
            options={[
              { value: 'true', label: 'Nam' },
              { value: 'false', label: 'Nữ' },
            ]}
          />
        </div>
        <p className="profile-edit-form__note"><span aria-hidden="true">i</span>Mã nhân viên, khoa/phòng và chức danh do quản trị viên quản lý.</p>
      </form>
    </Modal>
  )
}

export default EditProfileModal
