import { tokenStorage } from '../services/tokenStorage.js'

export function useAuthTokens() {
  const saveTokens = (tokens) => {
    const accessToken = tokens?.accessToken
    const refreshToken = tokens?.refreshToken

    if (!accessToken || !refreshToken) {
      tokenStorage.clear()
      throw new Error('Phản hồi đăng nhập không hợp lệ')
    }

    tokenStorage.setAccessToken(accessToken)
    tokenStorage.setRefreshToken(refreshToken)
    tokenStorage.setRequiresFirstLoginSetup(Boolean(tokens?.requiresFirstLoginSetup))
  }

  return {
    clearTokens: tokenStorage.clear,
    saveTokens,
  }
}
