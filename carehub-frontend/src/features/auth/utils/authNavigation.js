import { AUTH_ROUTES } from '../constants/authRoutes.js'
import { getPermissionsFromAccessToken, getRolesFromAccessToken } from './jwt.js'

export const AUTH_ROLE = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  user: 'USER',
  systemJob: 'SYSTEM_JOB',
}

export const ADMIN_ROLES = [AUTH_ROLE.admin]

export const EVALUATION_PERMISSIONS = [
  'QUESTION_AUTHOR',
  'QUESTION_REVIEWER',
  'QUESTION_SET_MANAGER',
  'EXAM_CONFIG_MANAGER',
  'EXAM_PUBLISHER',
  'ASSIGNMENT_MANAGER',
  'RESULT_VIEWER',
  'AUDIT_VIEWER',
]

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

export function hasAnyPermission(permissions, allowedPermissions, roles = []) {
  if (!allowedPermissions?.length) {
    return false
  }

  if (hasAnyRole(roles, ADMIN_ROLES)) {
    return true
  }

  const normalizedPermissions = normalizeRoles(permissions)
  const normalizedAllowedPermissions = normalizeRoles(allowedPermissions)

  return normalizedAllowedPermissions.some((permission) => normalizedPermissions.includes(permission))
}

export function getDefaultAuthenticatedRoute(roles, permissions = []) {
  const normalizedRoles = normalizeRoles(roles)
  const normalizedPermissions = normalizeRoles(permissions)

  if (normalizedRoles.includes(AUTH_ROLE.admin)) {
    return '/admin/dashboard'
  }

  if (EVALUATION_PERMISSIONS.some((permission) => normalizedPermissions.includes(permission))) {
    return '/admin/evaluation/dashboard'
  }

  if (normalizedRoles.includes(AUTH_ROLE.manager)) {
    return '/training'
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

export function isPathAllowedForAccess(path, roles, permissions) {
  if (path?.startsWith('/admin/evaluation')) {
    return hasAnyRole(roles, ADMIN_ROLES) || hasAnyPermission(permissions, EVALUATION_PERMISSIONS, roles)
  }

  return isPathAllowedForRoles(path, roles)
}

export function getPostLoginRoute(accessToken, requestedPath) {
  const roles = getRolesFromAccessToken(accessToken)
  const permissions = getPermissionsFromAccessToken(accessToken)

  if (isPathAllowedForAccess(requestedPath, roles, permissions)) {
    return requestedPath
  }

  return getDefaultAuthenticatedRoute(roles, permissions)
}
