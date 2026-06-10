import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import SecurityBadge from '../../../shared/components/SecurityBadge.jsx'
import { AUTH_ROUTES } from '../constants/routes.js'

function OtpScreen() {
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

  const hasError = submitted && otp.join('').length < 6

  return (
    <AuthShell showNotice>
      <section className="auth-card auth-card--forgot">
        <SecurityBadge />
        <header className="auth-card__header">
          <h1>Xác thực OTP</h1>
          <p>
            Chúng tôi đã gửi mã OTP đến email:
            <br />
            <strong>abc@gmail.com</strong>
            <br />
            Vui lòng nhập mã để tiếp tục
          </p>
        </header>

        <StepIndicator activeStep={2} />

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            if (otp.join('').length === 6) {
              navigate(AUTH_ROUTES.resetPassword)
            }
          }}
        >
          <div className="otp-group">
            <div className="otp-group__heading">
              <span>Nhập mã OTP</span>
              {hasError && <span className="form-field__error">Sai mã OTP</span>}
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

          <button className="primary-button" type="submit">
            Xác nhận
          </button>
        </form>

        <div className="resend-line">
          <span>Chưa nhận được mã?</span>
          <button className="text-button" type="button">
            Gửi lại OTP
          </button>
          <span>(56s)</span>
        </div>

        <button
          className="back-link"
          onClick={() => navigate(AUTH_ROUTES.forgotPassword)}
          type="button"
        >
          <ArrowLeftOutlined /> Quay lại
        </button>
      </section>
    </AuthShell>
  )
}

export default OtpScreen
