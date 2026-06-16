import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const staffApi = {
  changePassword(payload) {
    return httpClient.patch('/user/change-password', payload, {
      headers: authHeaders(),
    })
  },
}
