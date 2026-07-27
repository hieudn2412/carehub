const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'

function apiOrigin() {
  const browserOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost'
  return new URL(API_BASE_URL, browserOrigin).origin
}

export function resolveEvidenceUrl(value) {
  if (!value || typeof value !== 'string') return ''
  try {
    return new URL(value).toString()
  } catch {
    try {
      return new URL(value, apiOrigin()).toString()
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
