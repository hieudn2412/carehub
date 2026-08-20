export const AUTH_EVENTS = {
  sessionInvalid: 'carehub:auth-session-invalid',
  signedOut: 'carehub:auth-signed-out',
}

export const AUTH_BROADCAST_CHANNEL = 'carehub-auth'

export function dispatchAuthEvent(type) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(type))
}
