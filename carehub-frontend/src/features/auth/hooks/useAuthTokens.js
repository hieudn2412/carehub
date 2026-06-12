import { tokenStorage } from '../services/tokenStorage.js'

export function useAuthTokens() {
  const saveTokens = ({ accessToken, refreshToken }) => {
    tokenStorage.setAccessToken(accessToken)
    tokenStorage.setRefreshToken(refreshToken)
  }

  return {
    clearTokens: tokenStorage.clear,
    saveTokens,
  }
}
