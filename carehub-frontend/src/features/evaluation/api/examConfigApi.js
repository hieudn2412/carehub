import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const examConfigApi = {
  listExamConfigs(params) {
    return httpClient.get('/exam-configs', {
      headers: authHeaders(),
      params,
    })
  },

  getExamConfig(configId) {
    return httpClient.get(`/exam-configs/${configId}`, {
      headers: authHeaders(),
    })
  },

  createExamConfig(payload) {
    return httpClient.post('/exam-configs', payload, {
      headers: authHeaders(),
    })
  },

  updateExamConfig(configId, payload) {
    return httpClient.put(`/exam-configs/${configId}`, payload, {
      headers: authHeaders(),
    })
  },

  activateExamConfig(configId) {
    return httpClient.post(`/exam-configs/${configId}/activate`, {}, {
      headers: authHeaders(),
    })
  },

  deactivateExamConfig(configId) {
    return httpClient.post(`/exam-configs/${configId}/deactivate`, {}, {
      headers: authHeaders(),
    })
  },

  archiveExamConfig(configId) {
    return httpClient.delete(`/exam-configs/${configId}`, {
      headers: authHeaders(),
    })
  },

  previewExamConfig(payload) {
    return httpClient.post('/exam-configs/preview', payload, {
      headers: authHeaders(),
    })
  },

  previewSavedExamConfig(configId) {
    return httpClient.post(`/exam-configs/${configId}/preview`, {}, {
      headers: authHeaders(),
    })
  },
}
