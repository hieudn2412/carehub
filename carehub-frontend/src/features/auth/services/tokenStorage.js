const ACCESS_TOKEN_KEY = 'carehub.accessToken'
const REFRESH_TOKEN_KEY = 'carehub.refreshToken'
const REQUIRES_FIRST_LOGIN_SETUP_KEY = 'carehub.requiresFirstLoginSetup'

export const tokenStorage = {
  getAccessToken() {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  },

  hasAccessToken() {
    return Boolean(this.getAccessToken())
  },

  setAccessToken(token) {
    if (!token) {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      return
    }

    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  },

  getRefreshToken() {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  },

  setRefreshToken(token) {
    if (!token) {
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
      return
    }

    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  },

  getRequiresFirstLoginSetup() {
    return window.sessionStorage.getItem(REQUIRES_FIRST_LOGIN_SETUP_KEY) === 'true'
  },

  setRequiresFirstLoginSetup(value) {
    window.sessionStorage.setItem(REQUIRES_FIRST_LOGIN_SETUP_KEY, value ? 'true' : 'false')
  },

  clear() {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    window.sessionStorage.removeItem(REQUIRES_FIRST_LOGIN_SETUP_KEY)
    window.localStorage.removeItem('token')
  },
}
