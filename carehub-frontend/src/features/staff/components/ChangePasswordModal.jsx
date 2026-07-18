import { useState } from 'react'
import {
  LockOutlined,
  CloseOutlined,
  SaveOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  EditOutlined,
} from '@ant-design/icons'
import { staffApi } from '../api/staffApi'
import { getApiErrorMessage } from '../../auth/utils/apiError'

function ChangePasswordModal({ isOpen, onClose }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const resetForm = () => {
    setOldPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setShowOldPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleClose = () => {
    if (isSubmitting) return
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  // ── Kiểm tra điều kiện mật khẩu mới ────────────────────────
  const hasMinLength = newPassword.length >= 8
  const hasComplexity =
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[^A-Za-z0-9\s]/.test(newPassword)
  const hasNoWhitespace = newPassword.length > 0 && !/\s/.test(newPassword)

  const isStrongPassword = hasMinLength && hasComplexity && hasNoWhitespace
  const passwordsMatch = newPassword === confirmNewPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!oldPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại')
      return
    }

    if (!isStrongPassword) {
      setErrorMessage('Mật khẩu mới chưa đạt đủ điều kiện bảo mật')
      return
    }

    if (!passwordsMatch) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp')
      return
    }

    try {
      setIsSubmitting(true)
      // 1. Gọi API đổi mật khẩu ở Backend
      await staffApi.changePassword({
        oldPassword,
        newPassword,
        confirmNewPassword,
      })

      setSuccessMessage('Đổi mật khẩu thành công!')
      setOldPassword('')
      setNewPassword('')
      setConfirmNewPassword('')

      // Đóng modal sau 1.5 giây
      setTimeout(() => {
        resetForm()
        onClose()
      }, 1500)
    } catch (err) {
      // 2. Dự phòng: Nếu API Backend lỗi/chưa có dữ liệu, thông báo lỗi cụ thể
      setErrorMessage(getApiErrorMessage(err, 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại thông tin.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper render biểu tượng quy tắc
  const renderRuleIcon = (isValid) => {
    if (!newPassword) {
      return <CheckCircleFilled style={{ color: '#ccc' }} />
    }
    return isValid ? (
      <CheckCircleFilled style={{ color: '#1aaa84' }} />
    ) : (
      <CloseCircleFilled style={{ color: '#c0392b' }} />
    )
  }

  const getRuleClass = (isValid) => {
    if (!newPassword) return ''
    return isValid ? 'password-rule--valid' : 'password-rule--invalid'
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container change-password-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header__left">
            <div className="modal-header__icon-wrapper">
              <EditOutlined />
            </div>
            <div className="modal-header__title-area">
              <h3 className="modal-header__title">Đổi mật khẩu</h3>
              <p className="modal-header__sub">Đổi mật khẩu mới</p>
            </div>
          </div>
          <button type="button" className="modal-header__close" onClick={handleClose}>
            <CloseOutlined />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="modal-body">
            <p className="modal-section-title">
              <LockOutlined /> Đổi mật khẩu
            </p>

            {errorMessage && (
              <div className="modal-alert modal-alert--error">
                <ExclamationCircleFilled style={{ marginRight: 6 }} />
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="modal-alert modal-alert--success">
                <CheckCircleFilled style={{ marginRight: 6 }} />
                {successMessage}
              </div>
            )}

            {/* Mật khẩu hiện tại */}
            <div className="form-field">
              <div className="form-field__label-row">
                <label className="form-field__label">
                  Mật khẩu hiện tại <span className="required">*</span>
                </label>
                <span className="form-field__link">Quên mật khẩu?</span>
              </div>
              <div className="form-field__input-container">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  className="form-field__input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="off"
                  aria-label="Mật khẩu hiện tại"
                />
                <button
                  type="button"
                  className="form-field__toggle-visibility"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                >
                  {showOldPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
            </div>

            {/* Mật khẩu mới */}
            <div className="form-field">
              <label className="form-field__label">
                Mật khẩu mới <span className="required">*</span>
              </label>
              <div className="form-field__input-container">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-field__input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-label="Mật khẩu mới"
                />
                <button
                  type="button"
                  className="form-field__toggle-visibility"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>

              {/* Quy tắc mật khẩu */}
              <ul className="password-rules">
                <li className={`password-rule ${getRuleClass(hasMinLength)}`}>
                  <span className="password-rule__icon">{renderRuleIcon(hasMinLength)}</span>
                  Ít nhất 8 ký tự
                </li>
                <li className={`password-rule ${getRuleClass(hasComplexity)}`}>
                  <span className="password-rule__icon">{renderRuleIcon(hasComplexity)}</span>
                  Bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
                </li>
                <li className={`password-rule ${getRuleClass(hasNoWhitespace)}`}>
                  <span className="password-rule__icon">{renderRuleIcon(hasNoWhitespace)}</span>
                  Không chứa khoảng trắng
                </li>
              </ul>
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="form-field">
              <label className="form-field__label">
                Xác nhận mật khẩu mới <span className="required">*</span>
              </label>
              <div className="form-field__input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-field__input"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  autoComplete="new-password"
                  aria-label="Xác nhận mật khẩu mới"
                />
                <button
                  type="button"
                  className="form-field__toggle-visibility"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting}
            >
              <SaveOutlined /> {isSubmitting ? 'Đang lưu...' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <CloseOutlined /> Huỷ
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangePasswordModal
