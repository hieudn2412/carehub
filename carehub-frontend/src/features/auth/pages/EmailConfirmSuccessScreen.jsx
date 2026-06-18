import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import Icon from '../../../shared/components/Icon.jsx'
import { tokenStorage } from '../services/tokenStorage.js'
import { getDefaultAuthenticatedRoute } from '../utils/authNavigation.js'
import { getRolesFromAccessToken } from '../utils/jwt.js'
import '../../../styles/EmailConfirmScreen.css'

function EmailConfirmSuccessScreen() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!location.state?.completed) {
      const accessToken = tokenStorage.getAccessToken()
      const nextRoute = accessToken
        ? getDefaultAuthenticatedRoute(getRolesFromAccessToken(accessToken))
        : AUTH_ROUTES.login

      navigate(nextRoute, { replace: true })
      return undefined
    }

    tokenStorage.clear()

    const timer = setTimeout(() => {
      navigate(AUTH_ROUTES.login, { replace: true })
    }, 3000)

    return () => clearTimeout(timer)
  }, [location.state?.completed, navigate])

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
