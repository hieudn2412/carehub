import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LockOutlined, CheckCircleFilled, CloseCircleFilled, CheckCircleOutlined } from '@ant-design/icons'
import StepIndicator from '../components/StepIndicator.jsx'
import { AUTH_ROUTES } from '../../../app/router.jsx'
import '../../../styles/EmailConfirmScreen.css'

const emailConfirmSteps = [
  'Xác nhận email',
  'Xác thực OTP',
  'Tạo mật khẩu mới',
]

function EmailConfirmResetScreen() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const hasMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecialChar = /[^A-Za-z0-9\s]/.test(password)
  const hasNoWhitespace = password.length > 0 && !/\s/.test(password)

  const ruleMinLength = hasMinLength
  const ruleComplex = hasUppercase && hasLowercase && hasNumber && hasSpecialChar
  const ruleNoSpace = hasNoWhitespace

  const getRuleIcon = (isValid) => {
    if (!password) {
      return <CheckCircleOutlined className="rule-icon" style={{ color: '#d1d5db' }} />
    }
    return isValid ? (
      <CheckCircleFilled className="rule-icon" style={{ color: '#1aaa84' }} />
    ) : (
      <CloseCircleFilled className="rule-icon" style={{ color: '#ef4444' }} />
    )
  }

  const getRuleClass = (isValid) => {
    if (!password) return 'rule-item'
    return isValid ? 'rule-item is-valid' : 'rule-item is-invalid'
  }

  const confirmError =
    submitted && password && confirmPassword && password !== confirmPassword
      ? 'Mật khẩu xác nhận chưa khớp'
      : ''

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (
      password &&
      confirmPassword &&
      password === confirmPassword &&
      ruleMinLength &&
      ruleComplex &&
      ruleNoSpace
    ) {
      navigate(AUTH_ROUTES.emailConfirmSuccess)
    }
  }

  return (
    <div className="modal-bg">
      <div className="forgot-card">
        <div className="email-confirm-icon">
          <span className="email-confirm-icon__mail">✉</span>
          <span className="email-confirm-icon__check">✓</span>
        </div>

        <h1>Tạo mật khẩu mới</h1>
        <p>Vui lòng tạo mật khẩu mới để bảo mật tài khoản của bạn</p>

        <StepIndicator activeStep={3} steps={emailConfirmSteps} />

        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">Mật khẩu mới</label>
          <div className="input-wrap">
            <LockOutlined className="input-icon" />
            <input
              id="new-password"
              type="password"
              placeholder="Nhập mật khẩu mới"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <ul className="password-rules">
            <li className={getRuleClass(ruleMinLength)}>
              {getRuleIcon(ruleMinLength)}
              <span>Ít nhất 8 ký tự</span>
            </li>
            <li className={getRuleClass(ruleComplex)}>
              {getRuleIcon(ruleComplex)}
              <span>Bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt</span>
            </li>
            <li className={getRuleClass(ruleNoSpace)}>
              {getRuleIcon(ruleNoSpace)}
              <span>Không chứa khoảng trắng</span>
            </li>
          </ul>

          <label htmlFor="confirm-new-password">Xác thực mật khẩu mới</label>
          <div className="input-wrap">
            <LockOutlined className="input-icon" />
            <input
              id="confirm-new-password"
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {confirmError && <p className="error">{confirmError}</p>}

          <button className="primary-btn" type="submit">
            Xác nhận
          </button>
        </form>
      </div>
    </div>
  )
}

export default EmailConfirmResetScreen
