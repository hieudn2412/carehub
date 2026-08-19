import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { authApi } from '../api/authApi.js'
import { getApiErrorMessage } from '../../../shared/api/apiError.js'
import AuthShell from '../components/AuthShell.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import FormField from '../../../shared/components/FormField.jsx'
import Icon from '../../../shared/components/Icon.jsx'
import SecurityBadge from '../../../shared/components/SecurityBadge.jsx'
import { useOtpExpiry } from '../hooks/useOtpExpiry.js'

function ResetPasswordScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email
  const otp = location.state?.otp
  const otpExpiresAt = location.state?.otpExpiresAt
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { formattedRemaining, isExpired } = useOtpExpiry(otpExpiresAt)

  if (!email || !otp) {
    return <Navigate to={AUTH_ROUTES.forgotPassword} replace />
  }

  const hasMinLength = password.length >= 4
  const hasVisibleCharacter = password.trim().length > 0
  const isValidPassword = hasMinLength && hasVisibleCharacter

  const getRuleClass = (isValid) => {
    if (!password) {
      return ''
    }

    return isValid ? 'is-valid' : 'is-invalid'
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (isExpired) {
      setErrorMessage('Mã OTP đã hết hạn. Vui lòng quay lại và gửi mã mới.')
      return
    }

    if (!isValidPassword) {
      setErrorMessage('Mật khẩu phải có ít nhất 4 ký tự và không được chỉ gồm khoảng trắng')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận chưa khớp')
      return
    }

    try {
      setIsSubmitting(true)
      await authApi.resetPassword({ email, otp, newPassword: password })
      navigate(AUTH_ROUTES.login)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể đặt lại mật khẩu'))
    } finally {
      setIsSubmitting(false)
    }
  }

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

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            autoComplete="new-password"
            icon={<Icon name="lock" />}
            label="Mật khẩu mới"
            onChange={setPassword}
            placeholder="Nhập mật khẩu mới"
            type="password"
            value={password}
          />
          <ul className="password-rules">
            <li className={getRuleClass(hasMinLength)}>Ít nhất 4 ký tự</li>
            <li className={getRuleClass(hasVisibleCharacter)}>Không chỉ gồm khoảng trắng</li>
          </ul>

          <FormField
            autoComplete="new-password"
            error={isExpired ? '' : errorMessage}
            icon={<Icon name="lock" />}
            label="Xác thực mật khẩu mới"
            onChange={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            type="password"
            value={confirmPassword}
          />

          {!isExpired && (
            <p className="otp-expiry-note">
              Mã OTP còn hiệu lực trong <strong>{formattedRemaining}</strong>
            </p>
          )}
          {isExpired && (
            <p className="form-field__error" role="alert">
              Mã OTP đã hết hạn. Vui lòng quay lại và gửi mã mới.
            </p>
          )}

          <button
            className="primary-button"
            disabled={isSubmitting || isExpired}
            type="submit"
          >
            {isSubmitting ? 'Đang xác nhận...' : 'Xác nhận'}
          </button>
        </form>

        <Link
          className="back-link"
          to={AUTH_ROUTES.otp}
          state={{ email, otpExpiresAt }}
        >
          <Icon name="arrowLeft" /> Quay lại
        </Link>
      </section>
    </AuthShell>
  )
}

export default ResetPasswordScreen
