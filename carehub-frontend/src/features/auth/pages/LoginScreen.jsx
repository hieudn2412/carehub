import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { authApi } from '../api/authApi.js'
import { getApiErrorMessage } from '../utils/apiError.js'
import { useAuthTokens } from '../hooks/useAuthTokens.js'
import AuthShell from '../components/AuthShell.jsx'
import BrandLogo from '../../../shared/components/BrandLogo.jsx'
import FormField from '../../../shared/components/FormField.jsx'
import Icon from '../../../shared/components/Icon.jsx'
import heartBeatIcon from '../../../assets/monitor-heart-beat-36.png'

const REMEMBERED_EMPLOYEE_CODE_KEY = 'carehub.rememberedEmployeeCode'

function LoginScreen() {
  const navigate = useNavigate()
  const [employeeCode, setEmployeeCode] = useState(
    () => window.localStorage.getItem(REMEMBERED_EMPLOYEE_CODE_KEY) ?? '',
  )
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(
    () => Boolean(window.localStorage.getItem(REMEMBERED_EMPLOYEE_CODE_KEY)),
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { saveTokens } = useAuthTokens()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!employeeCode.trim() || !password) {
      setErrorMessage('Vui lòng nhập mã nhân viên và mật khẩu')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await authApi.login({
        employeeCode: employeeCode.trim(),
        password,
      })
      saveTokens(response.data.data)

      if (rememberMe) {
        window.localStorage.setItem(REMEMBERED_EMPLOYEE_CODE_KEY, employeeCode.trim())
      } else {
        window.localStorage.removeItem(REMEMBERED_EMPLOYEE_CODE_KEY)
      }

      if (response.data.data?.requiresFirstLoginSetup) {
        navigate(AUTH_ROUTES.emailConfirm)
      } else {
        navigate('/training')
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Đăng nhập không thành công'))
    } finally {
      setIsSubmitting(false)
    }
  }

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

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            autoComplete="username"
            error={errorMessage && !employeeCode.trim() ? errorMessage : ''}
            icon={<Icon name="user" />}
            label="Mã nhân viên"
            onChange={setEmployeeCode}
            placeholder="Nhập mã nhân viên"
            value={employeeCode}
          />
          <FormField
            autoComplete="current-password"
            error={errorMessage && employeeCode.trim() ? errorMessage : ''}
            icon={<Icon name="lock" />}
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

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </AuthShell>
  )
}

export default LoginScreen
