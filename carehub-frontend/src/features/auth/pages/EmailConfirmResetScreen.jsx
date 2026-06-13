import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { authApi } from '../api/authApi.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import Icon from '../../../shared/components/Icon.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import '../../../styles/EmailConfirmScreen.css'

const emailConfirmSteps = [
  'Xác nhận email',
  'Xác thực OTP',
  'Tạo mật khẩu mới',
]

function EmailConfirmResetScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email
  const otp = location.state?.otp
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!email || !otp) {
    return <Navigate to={AUTH_ROUTES.emailConfirm} replace />
  }

  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = /[^A-Za-z0-9\s]/.test(password)
  const hasNoWhitespace = password.length > 0 && !/\s/.test(password)
  const ruleComplex = hasUppercase && hasLowercase && hasNumber && hasSpecialChar
  const isStrongPassword = hasMinLength && ruleComplex && hasNoWhitespace

  const getRuleClass = (isValid) => {
    if (!password) return 'rule-item'
    return isValid ? 'rule-item is-valid' : 'rule-item is-invalid'
  }

  const getRuleIcon = (isValid) => {
    if (!password) return <span className="rule-dot" />
    return <Icon className="rule-icon" name={isValid ? 'check' : 'info'} />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!isStrongPassword) {
      setErrorMessage('Mật khẩu chưa đạt đủ điều kiện')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận chưa khớp')
      return
    }

    try {
      setIsSubmitting(true)
      await authApi.completeFirstLoginSetup({ email, otp, newPassword: password })
      navigate(AUTH_ROUTES.emailConfirmSuccess)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể hoàn tất thiết lập'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-bg">
      <div className="forgot-card">
        <div className="email-confirm-icon">
          <Icon name="user" />
          <span className="email-confirm-icon__check">
            <Icon name="check" />
          </span>
        </div>

        <h1>Tạo mật khẩu mới</h1>
        <p>Vui lòng tạo mật khẩu mới để bảo mật tài khoản của bạn</p>

        <StepIndicator activeStep={3} steps={emailConfirmSteps} />

        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">Mật khẩu mới</label>
          <div className="input-wrap">
            <Icon className="input-icon" name="lock" />
            <input
              id="new-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu mới"
              type="password"
              value={password}
            />
          </div>

          <ul className="password-rules">
            <li className={getRuleClass(hasMinLength)}>
              {getRuleIcon(hasMinLength)}
              <span>Ít nhất 8 ký tự</span>
            </li>
            <li className={getRuleClass(ruleComplex)}>
              {getRuleIcon(ruleComplex)}
              <span>Bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt</span>
            </li>
            <li className={getRuleClass(hasNoWhitespace)}>
              {getRuleIcon(hasNoWhitespace)}
              <span>Không chứa khoảng trắng</span>
            </li>
          </ul>

          <label htmlFor="confirm-new-password">Xác thực mật khẩu mới</label>
          <div className="input-wrap">
            <Icon className="input-icon" name="lock" />
            <input
              id="confirm-new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              type="password"
              value={confirmPassword}
            />
          </div>
          {errorMessage && <p className="error">{errorMessage}</p>}

          <button className="primary-btn" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Đang xác nhận...' : 'Xác nhận'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default EmailConfirmResetScreen
