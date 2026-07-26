const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'

export function resolveEvidenceUrl(value) {
  if (!value || typeof value !== 'string') return ''
  try {
    return new URL(value).toString()
  } catch {
    try {
      return new URL(value, new URL(API_BASE_URL).origin).toString()
    } catch {
      return ''
    }
  }
}

export function openEvidenceUrl(value) {
  const resolved = resolveEvidenceUrl(value)
  if (!resolved) return false
  window.open(resolved, '_blank', 'noopener,noreferrer')
  return true
}
