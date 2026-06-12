import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import StepIndicator from '../components/StepIndicator.jsx'
import { AUTH_ROUTES } from '../../../app/router.jsx'
import '../../../styles/EmailConfirmScreen.css'

const emailConfirmSteps = [
  'Xác nhận email',
  'Xác thực OTP',
  'Tạo mật khẩu mới',
]

function EmailConfirmOtpScreen() {
  const navigate = useNavigate()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [submitted, setSubmitted] = useState(false)
  const inputRefs = useRef([])

  const updateOtp = (value, index) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const nextOtp = [...otp]
    nextOtp[index] = digit
    setOtp(nextOtp)

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
    setSubmitted(true)
    if (otp.join('').length === 6) {
      navigate(AUTH_ROUTES.emailConfirmReset)
    }
  }

  const hasError = submitted && otp.join('').length < 6

  return (
    <div className="modal-bg">
      <div className="forgot-card">
        <div className="email-confirm-icon">
          <span className="email-confirm-icon__mail">✉</span>
          <span className="email-confirm-icon__check">✓</span>
        </div>

        <h1>Xác thực OTP</h1>
        <p>
          Chúng tôi đã gửi mã OTP đến email:
          <br />
          <strong>abc@gmail.com</strong>
          <br />
          Vui lòng nhập mã để tiếp tục
        </p>

        <StepIndicator activeStep={2} steps={emailConfirmSteps} />

        <form onSubmit={handleSubmit}>
          <div className="otp-group">
            <div className="otp-group__heading">
              <span>Nhập mã OTP</span>
              {hasError && <span className="error-msg">Sai mã OTP</span>}
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
          <button className="resend-btn" type="button">
            Gửi lại OTP
          </button>
          <span>(56s)</span>
        </div>

        <Link className="back-link" to={AUTH_ROUTES.emailConfirm}>
          <ArrowLeftOutlined /> Quay lại
        </Link>
      </div>
    </div>
  )
}

export default EmailConfirmOtpScreen
