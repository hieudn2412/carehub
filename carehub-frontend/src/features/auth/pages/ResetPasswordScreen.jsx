import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import FormField from '../../../shared/components/FormField.jsx'
import SecurityBadge from '../../../shared/components/SecurityBadge.jsx'
import { AUTH_ROUTES } from '../constants/routes.js'

function ResetPasswordScreen() {
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

  const getRuleClass = (isValid) => {
    if (!password) {
      return ''
    }

    return isValid ? 'is-valid' : 'is-invalid'
  }

  const confirmError =
    submitted && password && confirmPassword && password !== confirmPassword
      ? 'Mật khẩu xác nhận chưa khớp'
      : ''

  return (
    <AuthShell>
      <section className="auth-card auth-card--reset-password">
        <SecurityBadge />
        <header className="auth-card__header">
          <h1>Đặt lại mật khẩu</h1>
          <p>
            Vui lòng tạo mật khẩu mới để bảo mật
            <br />
            tài khoản của bạn
          </p>
        </header>

        <StepIndicator activeStep={3} />

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            if (password && confirmPassword && password === confirmPassword) {
              navigate(AUTH_ROUTES.login)
            }
          }}
        >
          <FormField
            icon={<LockOutlined />}
            label="Mật khẩu mới"
            onChange={setPassword}
            placeholder="Nhập mật khẩu mới"
            type="password"
            value={password}
          />
          <ul className="password-rules">
            <li className={getRuleClass(hasMinLength)}>Ít nhất 8 ký tự</li>
            <li
              className={getRuleClass(
                hasUppercase && hasLowercase && hasNumber && hasSpecialChar,
              )}
            >
              Bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
            </li>
            <li className={getRuleClass(hasNoWhitespace)}>Không chứa khoảng trắng</li>
          </ul>

          <FormField
            error={confirmError}
            icon={<LockOutlined />}
            label="Xác thực mật khẩu mới"
            onChange={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            type="password"
            value={confirmPassword}
          />

          <button className="primary-button" type="submit">
            Xác nhận
          </button>
        </form>

        <Link className="back-link" to={AUTH_ROUTES.otp}>
          <ArrowLeftOutlined /> Quay lại
        </Link>
      </section>
 
    </AuthShell>
  )
}

export default ResetPasswordScreen
