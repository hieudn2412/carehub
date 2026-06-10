import { useState } from 'react'
import { HeartFilled, LockOutlined, UserOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import BrandLogo from '../../../shared/components/BrandLogo.jsx'
import FormField from '../../../shared/components/FormField.jsx'

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

export default LoginScreen
