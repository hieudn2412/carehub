import { useState } from 'react'
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import FormField from '../../../shared/components/FormField.jsx'
import SecurityBadge from '../../../shared/components/SecurityBadge.jsx'

function ForgotAccountScreen({ onBack, onNext }) {
  const [account, setAccount] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <AuthShell showNotice>
      <section className="auth-card auth-card--forgot auth-card--forgot-account">
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

export default ForgotAccountScreen
