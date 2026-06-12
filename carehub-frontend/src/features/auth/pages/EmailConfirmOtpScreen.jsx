import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
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

function EmailConfirmOtpScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [errorMessage, setErrorMessage] = useState('')
  const [isResending, setIsResending] = useState(false)
  const inputRefs = useRef([])
  const otpValue = otp.join('')

  if (!email) {
    return <Navigate to={AUTH_ROUTES.emailConfirm} replace />
  }

  const updateOtp = (value, index) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const nextOtp = [...otp]
    nextOtp[index] = digit
    setOtp(nextOtp)
    setErrorMessage('')

    if (digit && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (otpValue.length < 6) {
      setErrorMessage('Vui lòng nhập đủ 6 số OTP')
      return
    }

    navigate(AUTH_ROUTES.emailConfirmReset, { state: { email, otp: otpValue } })
  }

  const handleResendOtp = async () => {
    try {
      setIsResending(true)
      setErrorMessage('')
      await authApi.sendFirstLoginOtp({ email })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể gửi lại mã OTP'))
    } finally {
      setIsResending(false)
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

        <h1>Xác thực OTP</h1>
        <p>
          Chúng tôi đã gửi mã OTP đến email:
          <br />
          <strong>{email}</strong>
          <br />
          Vui lòng nhập mã để tiếp tục
        </p>

        <StepIndicator activeStep={2} steps={emailConfirmSteps} />

        <form onSubmit={handleSubmit}>
          <div className="otp-group">
            <div className="otp-group__heading">
              <span>Nhập mã OTP</span>
              {errorMessage && <span className="error-msg">{errorMessage}</span>}
            </div>
            <div className="otp-inputs">
              {otp.map((value, index) => (
                <input
                  aria-label={`Mã OTP số ${index + 1}`}
                  inputMode="numeric"
                  key={index}
                  maxLength={1}
                  onChange={(event) => updateOtp(event.target.value, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  ref={(node) => {
                    inputRefs.current[index] = node
                  }}
                  value={value}
                />
              ))}
            </div>
            <p>
              Mã OTP sẽ hết hạn sau <strong>05:00</strong>
            </p>
          </div>

          <button className="primary-btn" type="submit">
            Xác nhận
          </button>
        </form>

        <div className="resend-line">
          <span>Chưa nhận được mã?</span>
          <button
            className="resend-btn"
            disabled={isResending}
            onClick={handleResendOtp}
            type="button"
          >
            {isResending ? 'Đang gửi...' : 'Gửi lại OTP'}
          </button>
          <span>(56s)</span>
        </div>

        <Link className="back-link" to={AUTH_ROUTES.emailConfirm}>
          <Icon name="arrowLeft" /> Quay lại
        </Link>
      </div>
    </div>
  )
}

export default EmailConfirmOtpScreen
