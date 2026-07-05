import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { getPermissionsFromAccessToken, getRolesFromAccessToken } from '../../auth/utils/jwt.js'

export const EVALUATION_PERMISSION = {
  questionAuthor: 'QUESTION_AUTHOR',
  questionReviewer: 'QUESTION_REVIEWER',
  questionSetManager: 'QUESTION_SET_MANAGER',
  examConfigManager: 'EXAM_CONFIG_MANAGER',
  examPublisher: 'EXAM_PUBLISHER',
  assignmentManager: 'ASSIGNMENT_MANAGER',
  resultViewer: 'RESULT_VIEWER',
  auditViewer: 'AUDIT_VIEWER',
}

export const ALL_EVALUATION_PERMISSIONS = Object.values(EVALUATION_PERMISSION)

export function getCurrentEvaluationAccess() {
  const token = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(token).map(normalize)
  const permissions = getPermissionsFromAccessToken(token).map(normalize)
  const isAdmin = roles.includes('ADMIN')

  return {
    roles,
    permissions,
    isAdmin,
    canAccessEvaluation: isAdmin || ALL_EVALUATION_PERMISSIONS.some((permission) => permissions.includes(permission)),
    hasAny(requiredPermissions = []) {
      if (isAdmin) return true
      if (!requiredPermissions.length) return true
      return requiredPermissions.map(normalize).some((permission) => permissions.includes(permission))
    },
  }
}

export function hasAnyEvaluationPermission(requiredPermissions = []) {
  return getCurrentEvaluationAccess().hasAny(requiredPermissions)
}

function normalize(value) {
  return String(value || '').replace(/^ROLE_/, '').toUpperCase()
}
