import { authApi } from '../api/authApi.js'
import { tokenStorage } from './tokenStorage.js'

export async function logoutUser() {
  const refreshToken = tokenStorage.getRefreshToken()

  tokenStorage.clear()

  if (!refreshToken) {
    return
  }

  try {
    await authApi.logout({ refreshToken })
  } catch {
    // Local logout must still finish when the server is unavailable.
  }
}
