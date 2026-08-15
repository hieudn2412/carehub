import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const questionSetCategoryApi = {
  listCategories(params) {
    return httpClient.get('/question-set-categories', { headers: authHeaders(), params })
  },
}
