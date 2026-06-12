const ACCESS_TOKEN_KEY = 'carehub.accessToken'
const REFRESH_TOKEN_KEY = 'carehub.refreshToken'

export const tokenStorage = {
  getAccessToken() {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  },

  setAccessToken(token) {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  },

  getRefreshToken() {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  },

  setRefreshToken(token) {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  },

  clear() {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}
