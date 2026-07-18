import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const questionSetCategoryApi = {
  listCategories(params) {
    return httpClient.get('/question-set-categories', {
      headers: authHeaders(),
      params,
    })
  },

  getCategory(categoryId) {
    return httpClient.get(`/question-set-categories/${categoryId}`, {
      headers: authHeaders(),
    })
  },

  createCategory(payload) {
    return httpClient.post('/question-set-categories', payload, {
      headers: authHeaders(),
    })
  },

  updateCategory(categoryId, payload) {
    return httpClient.put(`/question-set-categories/${categoryId}`, payload, {
      headers: authHeaders(),
    })
  },

  archiveCategory(categoryId) {
    return httpClient.delete(`/question-set-categories/${categoryId}`, {
      headers: authHeaders(),
    })
  },
}
