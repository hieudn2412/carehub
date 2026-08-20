import { tokenStorage } from '../../../shared/auth/tokenStorage.js'

export function useAuthTokens() {
  const saveTokens = (tokens) => {
    const accessToken = tokens?.accessToken

    if (!accessToken) {
      tokenStorage.clear()
      throw new Error('Phản hồi đăng nhập không hợp lệ')
    }

    tokenStorage.setAccessToken(accessToken)
    tokenStorage.setRequiresFirstLoginSetup(Boolean(tokens?.requiresFirstLoginSetup))
  }

  return {
    clearTokens: tokenStorage.clear,
    saveTokens,
  }
}
