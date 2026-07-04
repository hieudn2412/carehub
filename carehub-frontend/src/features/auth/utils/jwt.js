function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')

  return window.atob(padded)
}

export function getJwtPayload(token) {
  if (!token) {
    return null
  }

  try {
    const [, payload] = token.split('.')

    if (!payload) {
      return null
    }

    return JSON.parse(decodeBase64Url(payload))
  } catch {
    return null
  }
}

export function getRolesFromAccessToken(token) {
  const roles = getJwtPayload(token)?.roles

  return Array.isArray(roles) ? roles.filter(Boolean) : []
}

export function getPermissionsFromAccessToken(token) {
  const permissions = getJwtPayload(token)?.permissions

  return Array.isArray(permissions) ? permissions.filter(Boolean) : []
}
