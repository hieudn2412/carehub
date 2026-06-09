import { useRef, useState } from 'react'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  HeartFilled,
  InfoCircleFilled,
  LockOutlined,
  MailFilled,
  SafetyCertificateFilled,
  UserOutlined,
} from '@ant-design/icons'
import './App.css'

const steps = ['Nhập tài khoản', 'Xác thực OTP', 'Đặt lại mật khẩu']

function BrandLogo() {
  return (
    <div className="brand-logo" aria-label="CareHub">
      <div className="brand-logo__ring">
        <HeartFilled />
      </div>
      <span>CAREHUB</span>
    </div>
  )
}

function SecurityBadge() {
  return (
    <div className="security-badge" aria-hidden="true">
      <MailFilled />
      <SafetyCertificateFilled className="security-badge__shield" />
    </div>
  )
}

function StepIndicator({ activeStep }) {
  return (
    <div className="stepper" aria-label="Tiến trình đặt lại mật khẩu">
      {steps.map((label, index) => {
        const stepNumber = index + 1
        const isDone = stepNumber < activeStep
        const isActive = stepNumber === activeStep

        return (
          <div className="stepper__item" key={label}>
            <span
              className={[
                'stepper__circle',
                isDone ? 'is-done' : '',
                isActive ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isDone ? <CheckOutlined /> : stepNumber}
            </span>
            <span className="stepper__label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function FormField({
  error,
  icon,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <span className={`form-field__control ${error ? 'has-error' : ''}`}>
        <span className="form-field__icon">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </span>
      {error && <span className="form-field__error">{error}</span>}
    </label>
  )
}

function SupportNotice() {
  return (
    <aside className="support-notice">
      <InfoCircleFilled />
      <div>
        <strong>Không nhận được mã?</strong>
        <p>Vui lòng kiểm tra thư mục Spam trong Gmail hoặc thử lại trong 60 giây</p>
      </div>
    </aside>
  )
}

function AuthShell({ children, showNotice = false }) {
  return (
    <main className="auth-page">
      <section className="auth-scene">
        <div className="background-art" aria-hidden="true">
          <div className="art art__stethoscope"></div>
          <div className="art art__paper"></div>
          <div className="art art__pen"></div>
          <div className="art art__bottle"></div>
        </div>
        {children}
        {showNotice && <SupportNotice />}
      </section>
    </main>
  )
}

function LoginScreen({ onForgotPassword }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  const usernameError = submitted ? 'Tên đăng nhập/email không tồn tại' : ''
  const passwordError = submitted ? 'Sai mật khẩu' : ''

  return (
    <AuthShell>
      <section className="auth-card auth-card--login">
        <BrandLogo />
        <header className="auth-card__header">
          <h1>Đăng nhập</h1>
          <p>Chào mừng bạn đã quay trở lại</p>
        </header>

        <div className="divider">
          <span>
            <HeartFilled />
          </span>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
          }}
        >
          <FormField
            error={usernameError}
            icon={<UserOutlined />}
            label="Tên đăng nhập"
            onChange={setUsername}
            placeholder="Nhập tên đăng nhập hoặc email"
            value={username}
          />
          <FormField
            error={passwordError}
            icon={<LockOutlined />}
            label="Mật khẩu"
            onChange={setPassword}
            placeholder="Nhập mật khẩu"
            type="password"
            value={password}
          />

          <div className="form-options">
            <label className="remember">
              <input
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <button className="text-button" onClick={onForgotPassword} type="button">
              Quên mật khẩu?
            </button>
          </div>

          <button className="primary-button" type="submit">
            Đăng nhập
          </button>
        </form>
      </section>
    </AuthShell>
  )
}

function ForgotAccountScreen({ onBack, onNext }) {
  const [account, setAccount] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <AuthShell showNotice>
      <section className="auth-card auth-card--forgot">
        <SecurityBadge />
        <header className="auth-card__header">
          <h1>Quên mật khẩu</h1>
          <p>
            Nhập email hoặc tên đăng nhập của bạn.
            <br />
            Chúng tôi sẽ gửi OTP để đặt lại mật khẩu
          </p>
        </header>

        <StepIndicator activeStep={1} />

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            if (account.trim()) {
              onNext()
            }
          }}
        >
          <FormField
            error={submitted && !account.trim() ? 'Tên đăng nhập/email không tồn tại' : ''}
            icon={<UserOutlined />}
            label="Tên đăng nhập hoặc email"
            onChange={setAccount}
            placeholder="Nhập tên đăng nhập hoặc email"
            value={account}
          />

          <button className="primary-button" type="submit">
            Gửi mã OTP
          </button>
        </form>

        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeftOutlined /> Quay lại trang đăng nhập
        </button>
      </section>
    </AuthShell>
  )
}

function OtpScreen({ onBack, onNext }) {
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
              onNext()
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

        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeftOutlined /> Quay lại
        </button>
      </section>
    </AuthShell>
  )
}

function ResetPasswordScreen({ onBack, onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const confirmError =
    submitted && password && confirmPassword && password !== confirmPassword
      ? 'Mật khẩu xác nhận chưa khớp'
      : ''

  return (
    <AuthShell>
      <section className="auth-card auth-card--reset">
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
              onDone()
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
            <li className={password.length >= 8 ? 'is-valid' : ''}>Ít nhất 8 ký tự</li>
            <li className={/[A-Z]/.test(password) && /\d/.test(password) ? 'is-valid' : ''}>
              Bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt
            </li>
            <li className={password && !/\s/.test(password) ? 'is-valid' : 'is-invalid'}>
              Không chứa khoảng trắng
            </li>
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
      </section>
      <button className="floating-back" onClick={onBack} type="button">
        <ArrowLeftOutlined /> Quay lại
      </button>
    </AuthShell>
  )
}

function App() {
  const [screen, setScreen] = useState('login')

  if (screen === 'forgot') {
    return (
      <ForgotAccountScreen
        onBack={() => setScreen('login')}
        onNext={() => setScreen('otp')}
      />
    )
  }

  if (screen === 'otp') {
    return (
      <OtpScreen
        onBack={() => setScreen('forgot')}
        onNext={() => setScreen('reset')}
      />
    )
  }

  if (screen === 'reset') {
    return (
      <ResetPasswordScreen
        onBack={() => setScreen('otp')}
        onDone={() => setScreen('login')}
      />
    )
  }

  return <LoginScreen onForgotPassword={() => setScreen('forgot')} />
}

export default App
