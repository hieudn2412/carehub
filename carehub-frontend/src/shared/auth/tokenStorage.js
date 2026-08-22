let accessToken = null
let requiresFirstLoginSetup = false

export const tokenStorage = {
  getAccessToken() {
    return accessToken
  },

  hasAccessToken() {
    return Boolean(this.getAccessToken())
  },

  setAccessToken(token) {
    accessToken = token || null
  },

  getRefreshToken() {
    return null
  },

  setRefreshToken() {
    // Refresh credentials live only in the HttpOnly carehub_refresh cookie.
  },

  getRequiresFirstLoginSetup() {
    return requiresFirstLoginSetup
  },

  setRequiresFirstLoginSetup(value) {
    requiresFirstLoginSetup = Boolean(value)
  },

  clear() {
    accessToken = null
    requiresFirstLoginSetup = false
    window.sessionStorage.removeItem('carehub.accessToken')
    window.sessionStorage.removeItem('carehub.refreshToken')
    window.sessionStorage.removeItem('carehub.requiresFirstLoginSetup')
    window.localStorage.removeItem('token')
  },
}
