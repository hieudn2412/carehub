import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { authApi } from '../api/authApi.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import AuthShell from '../components/AuthShell.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import FormField from '../../../shared/components/FormField.jsx'
import Icon from '../../../shared/components/Icon.jsx'
import SecurityBadge from '../../../shared/components/SecurityBadge.jsx'

function ForgotAccountScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim()
    setErrorMessage('')

    if (!normalizedEmail) {
      setErrorMessage('Vui lòng nhập email')
      return
    }

    try {
      setIsSubmitting(true)
      await authApi.forgotPassword({ email: normalizedEmail })
      navigate(AUTH_ROUTES.otp, { state: { email: normalizedEmail } })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể gửi mã OTP'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell showNotice>
      <section className="auth-card auth-card--forgot auth-card--forgot-account">
        <SecurityBadge />
        <header className="auth-card__header">
          <h1>Quên mật khẩu</h1>
          <p>
            Nhập email của bạn.
            <br />
            Chúng tôi sẽ gửi OTP để đặt lại mật khẩu
          </p>
        </header>

        <StepIndicator activeStep={1} />

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            error={errorMessage}
            icon={<Icon name="user" />}
            label="Email"
            onChange={setEmail}
            placeholder="Nhập email"
            value={email}
          />

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}
          </button>
        </form>

        <Link className="back-link" to={AUTH_ROUTES.login}>
          <Icon name="arrowLeft" /> Quay lại trang đăng nhập
        </Link>
      </section>
    </AuthShell>
  )
}

export default ForgotAccountScreen
