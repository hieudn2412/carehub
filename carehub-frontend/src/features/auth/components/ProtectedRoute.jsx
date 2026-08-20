import { Navigate, useLocation } from 'react-router-dom'
import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { getPermissionsFromAccessToken, getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import { getDefaultAuthenticatedRoute, hasAnyPermission, hasAnyRole } from '../utils/authNavigation.js'
import { useAuth } from '../context/AuthContext.jsx'

function AuthRouteStatus({ message, actionLabel, onAction }) {
  return (
    <div className="auth-route-status" role="status">
      <p>{message}</p>
      {onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function ProtectedRoute({ allowFirstLoginSetup = false, allowedRoles = [], allowedPermissions = [], children }) {
  const location = useLocation()
  const auth = useAuth()
  const accessToken = auth.accessToken

  if (auth.isChecking) {
    return <AuthRouteStatus message="Đang kiểm tra phiên đăng nhập..." />
  }

  if (auth.isUnavailable) {
    return (
      <AuthRouteStatus
        message="Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại."
        actionLabel="Thử lại"
        onAction={auth.refreshSession}
      />
    )
  }

  if (!auth.isAuthenticated || !accessToken) {
    return <Navigate to={AUTH_ROUTES.login} replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (auth.requiresFirstLoginSetup && !allowFirstLoginSetup) {
    return <Navigate to={AUTH_ROUTES.emailConfirm} replace />
  }

  const roles = getRolesFromAccessToken(accessToken)
  const permissions = getPermissionsFromAccessToken(accessToken)

  if (!hasAnyRole(roles, allowedRoles) && !hasAnyPermission(permissions, allowedPermissions, roles)) {
    return <Navigate to={getDefaultAuthenticatedRoute(roles, permissions)} replace />
  }

  return children
}

export default ProtectedRoute
