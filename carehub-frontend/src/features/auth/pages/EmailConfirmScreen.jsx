import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { authApi } from '../api/authApi.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import Icon from '../../../shared/components/Icon.jsx'
import '../../../styles/EmailConfirmScreen.css'

const steps = [
  { label: 'Xác nhận email' },
  { label: 'Xác thực OTP' },
  { label: 'Tạo mật khẩu mới' },
]

function EmailConfirmScreen() {
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
      await authApi.sendFirstLoginOtp({ email: normalizedEmail })
      navigate(AUTH_ROUTES.emailConfirmOtp, { state: { email: normalizedEmail } })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể gửi mã OTP'))
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

        <h1>Thiết lập bảo mật tài khoản</h1>
        <p>
          Chỉ mất khoảng 1 phút để xác nhận email
          <br />
          và tạo mật khẩu mới.
        </p>

        <div className="steps">
          {steps.map((step, index) => (
            <div key={step.label} className="step-item">
              <div className={`step-circle ${index === 0 ? 'active' : ''}`}>
                {index + 1}
              </div>
              <span className={`step-label ${index === 0 ? 'active' : ''}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email-confirm">Email</label>
          <div className="input-wrap">
            <Icon className="input-icon" name="user" />
            <input
              id="email-confirm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Nhập email của bạn"
              type="email"
              value={email}
            />
          </div>
          {errorMessage && <p className="error">{errorMessage}</p>}
          <button className="primary-btn" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Đang gửi...' : 'Gửi mã OTP'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default EmailConfirmScreen
