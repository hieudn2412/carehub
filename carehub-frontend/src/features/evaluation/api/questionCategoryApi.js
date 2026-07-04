import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const questionCategoryApi = {
  listCategories(params) {
    return httpClient.get('/question-categories', {
      headers: authHeaders(),
      params,
    })
  },

  getCategory(categoryId) {
    return httpClient.get(`/question-categories/${categoryId}`, {
      headers: authHeaders(),
    })
  },

  createCategory(payload) {
    return httpClient.post('/question-categories', payload, {
      headers: authHeaders(),
    })
  },

  updateCategory(categoryId, payload) {
    return httpClient.put(`/question-categories/${categoryId}`, payload, {
      headers: authHeaders(),
    })
  },

  archiveCategory(categoryId) {
    return httpClient.delete(`/question-categories/${categoryId}`, {
      headers: authHeaders(),
    })
  },
}
