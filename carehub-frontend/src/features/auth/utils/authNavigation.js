import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { getRolesFromAccessToken } from './jwt.js'

export const AUTH_ROLE = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  user: 'USER',
  systemJob: 'SYSTEM_JOB',
}

export const ADMIN_ROLES = [AUTH_ROLE.admin]

function normalizeRoles(roles) {
  return roles.map((role) => String(role).replace(/^ROLE_/, '').toUpperCase())
}

export function hasAnyRole(roles, allowedRoles) {
  if (!allowedRoles?.length) {
    return true
  }

  const normalizedRoles = normalizeRoles(roles)
  const normalizedAllowedRoles = normalizeRoles(allowedRoles)

  return normalizedAllowedRoles.some((role) => normalizedRoles.includes(role))
}

export function getDefaultAuthenticatedRoute(roles) {
  const normalizedRoles = normalizeRoles(roles)

  if (normalizedRoles.includes(AUTH_ROLE.admin)) {
    return '/admin/dashboard'
  }

  if (normalizedRoles.includes(AUTH_ROLE.manager)) {
    return '/manager/dashboard'
  }

  if (normalizedRoles.includes(AUTH_ROLE.user)) {
    return AUTH_ROUTES.staffDashboard
  }

  return '/training'
}

export function isPathAllowedForRoles(path, roles) {
  if (!path) {
    return false
  }

  if (path.startsWith('/admin')) {
    return hasAnyRole(roles, ADMIN_ROLES)
  }

  return true
}

export function getPostLoginRoute(accessToken, requestedPath) {
  const roles = getRolesFromAccessToken(accessToken)

  if (isPathAllowedForRoles(requestedPath, roles)) {
    return requestedPath
  }

  return getDefaultAuthenticatedRoute(roles)
}
