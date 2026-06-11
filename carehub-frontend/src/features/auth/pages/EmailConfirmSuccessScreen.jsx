import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../../../app/router.jsx'
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
    <div className="modal-bg">
      <div className="forgot-card">
        <div className="email-confirm-icon">
          <span className="email-confirm-icon__mail">✉</span>
          <span className="email-confirm-icon__check">✓</span>
        </div>

        <h1>Hoàn tất</h1>
        <p>
          Tài khoản của bạn đã hoàn tất đăng ký.
          <br />
          Bạn sẽ được chuyển hướng đến Trang chủ
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
