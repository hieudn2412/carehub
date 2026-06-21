import { Navigate, useLocation } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { tokenStorage } from '../services/tokenStorage.js'
import { getRolesFromAccessToken } from '../utils/jwt.js'
import { getDefaultAuthenticatedRoute, hasAnyRole } from '../utils/authNavigation.js'

function ProtectedRoute({ allowFirstLoginSetup = false, allowedRoles = [], children }) {
  const location = useLocation()
  const accessToken = tokenStorage.getAccessToken()

  if (!accessToken) {
    return <Navigate to={AUTH_ROUTES.login} replace state={{ from: location.pathname }} />
  }

  if (tokenStorage.getRequiresFirstLoginSetup() && !allowFirstLoginSetup) {
    return <Navigate to={AUTH_ROUTES.emailConfirm} replace />
  }

  const roles = getRolesFromAccessToken(accessToken)

  if (!hasAnyRole(roles, allowedRoles)) {
    return <Navigate to={getDefaultAuthenticatedRoute(roles)} replace />
  }

  return children
}

export default ProtectedRoute
