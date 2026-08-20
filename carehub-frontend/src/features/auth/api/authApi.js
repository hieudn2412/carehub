import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {}
}

export const authApi = {
  login(payload) {
    return httpClient.post('/auth/login', payload)
  },

  refreshToken() {
    return httpClient.post('/auth/refresh-token', {})
  },

  forgotPassword(payload) {
    return httpClient.post('/auth/forgot-password', payload)
  },

  resetPassword(payload) {
    return httpClient.post('/auth/reset-password', payload)
  },

  sendFirstLoginOtp(payload) {
    return httpClient.post('/user/first-login/send-email-otp', payload, {
      headers: authHeaders(),
    })
  },

  completeFirstLoginSetup(payload) {
    return httpClient.post('/user/first-login/complete', payload, {
      headers: authHeaders(),
    })
  },

  logout() {
    return httpClient.post('/auth/logout', {})
  },
}
