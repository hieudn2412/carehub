import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import Icon from '../../../shared/components/Icon.jsx'
import '../../../styles/EmailConfirmScreen.css'

function EmailConfirmSuccessScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(AUTH_ROUTES.login)
    }, 3000)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="email-confirm-page modal-bg">
      <div className="forgot-card">
        <div className="email-confirm-icon">
          <Icon name="user" />
          <span className="email-confirm-icon__check">
            <Icon name="check" />
          </span>
        </div>

        <h1>Hoàn tất</h1>
        <p>
          Tài khoản của bạn đã hoàn tất đăng ký.
          <br />
          Bạn sẽ được chuyển hướng đến trang đăng nhập
          <br />
          trong vài giây...
        </p>

        <div className="spinner-container">
          <div className="spinner" />
        </div>
      </div>
    </div>
  )
}

export default EmailConfirmSuccessScreen
