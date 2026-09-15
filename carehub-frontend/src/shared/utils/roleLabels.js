const ROLE_LABELS = {
  ADMIN: 'Quản lý cấp Bệnh Viện',
  ADMINISTRATOR: 'Quản lý cấp Bệnh Viện',
  MANAGER: 'Quản lý cấp Khoa',
  USER: 'Nhân viên',
  STAFF: 'Nhân viên',
}

function getRoleValue(role) {
  if (typeof role === 'string') return role
  return role?.code || role?.name || role?.displayName || ''
}

export function formatRoleLabel(role, fallback = '') {
  const value = String(getRoleValue(role)).trim()
  const normalized = value.replace(/^ROLE_/, '').toUpperCase()

  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized]
  if (normalized.includes('ADMIN')) return ROLE_LABELS.ADMIN
  if (normalized.includes('MANAGER')) return ROLE_LABELS.MANAGER
  if (normalized.includes('USER') || normalized.includes('STAFF')) return ROLE_LABELS.USER

  return value || fallback
}

export function formatRoleLabels(roles, fallback = '') {
  const labels = (Array.isArray(roles) ? roles : [])
    .map((role) => formatRoleLabel(role))
    .filter(Boolean)

  return Array.from(new Set(labels)).join(', ') || formatRoleLabel(fallback)
}
