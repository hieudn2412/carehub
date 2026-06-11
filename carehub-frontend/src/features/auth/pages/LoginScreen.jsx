import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import AuthShell from '../components/AuthShell.jsx'
import BrandLogo from '../../../shared/components/BrandLogo.jsx'
import FormField from '../../../shared/components/FormField.jsx'
import heartBeatIcon from '../../../assets/monitor-heart-beat-36.png'
import { AUTH_ROUTES } from '../../../app/router.jsx'


function LoginScreen() {
  const navigate = useNavigate()
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
            <img src={heartBeatIcon} alt="" />
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
            <Link className="text-button" to={AUTH_ROUTES.forgotPassword}>
              Quên mật khẩu?
            </Link>
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
