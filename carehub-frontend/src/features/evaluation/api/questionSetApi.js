import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const questionSetApi = {
  listQuestionSets(params) {
    return httpClient.get('/question-sets', {
      headers: authHeaders(),
      params,
    })
  },

  getQuestionSet(setId) {
    return httpClient.get(`/question-sets/${setId}`, {
      headers: authHeaders(),
    })
  },

  createQuestionSet(payload) {
    return httpClient.post('/question-sets', payload, {
      headers: authHeaders(),
    })
  },

  updateQuestionSet(setId, payload) {
    return httpClient.put(`/question-sets/${setId}`, payload, {
      headers: authHeaders(),
    })
  },

  activateQuestionSet(setId) {
    return httpClient.post(`/question-sets/${setId}/activate`, {}, {
      headers: authHeaders(),
    })
  },

  deactivateQuestionSet(setId) {
    return httpClient.post(`/question-sets/${setId}/deactivate`, {}, {
      headers: authHeaders(),
    })
  },

  archiveQuestionSet(setId) {
    return httpClient.delete(`/question-sets/${setId}`, {
      headers: authHeaders(),
    })
  },

  duplicateQuestionSet(setId) {
    return httpClient.post(`/question-sets/${setId}/duplicate`, {}, {
      headers: authHeaders(),
    })
  },

  exportQuestionSet(setId, format = 'csv') {
    return httpClient.get(`/question-sets/${setId}/export`, {
      headers: authHeaders(),
      params: { format },
      responseType: 'blob',
    })
  },

  previewQuestionSet(payload) {
    return httpClient.post('/question-sets/preview', payload, {
      headers: authHeaders(),
    })
  },
}
