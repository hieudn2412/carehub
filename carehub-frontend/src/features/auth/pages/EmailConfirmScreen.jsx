import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/routes.js'

const steps = [
  { label: 'Xác nhận email' },
  { label: 'Xác thực OTP' },
  { label: 'Tạo mật khẩu mới' },
]

function EmailConfirmScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (email.trim()) {
      navigate(AUTH_ROUTES.otp)
    }
  }

  return (
    <div className="modal-bg">
      <div className="forgot-card">
        <div className="icon-wrap">
          <span className="icon-main">✉</span>
          <span className="icon-badge">✓</span>
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
              <div className={`step-circle ${index === 0 ? 'active' : ''}`}>{index + 1}</div>
              <span className={`step-label ${index === 0 ? 'active' : ''}`}>{step.label}</span>
              {index < steps.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email-confirm">Email</label>
          <div className="input-wrap">
            <span className="input-icon">👤</span>
            <input
              id="email-confirm"
              type="email"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {submitted && !email.trim() && <p className="error">Vui lòng nhập email</p>}
          <button type="submit" className="primary-btn">
            Gửi mã OTP
          </button>
        </form>
      </div>
    </div>
  )
}

export default EmailConfirmScreen
