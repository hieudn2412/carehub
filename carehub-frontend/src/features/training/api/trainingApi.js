import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {}
}

export const trainingApi = {
  getFoundation() {
    return httpClient.get('/training/foundation', {
      headers: authHeaders(),
    })
  },

  getActivityTypes(params) {
    return httpClient.get('/training/activity-types', {
      headers: authHeaders(),
      params,
    })
  },

  getActivityType(id) {
    return httpClient.get(`/training/activity-types/${id}`, {
      headers: authHeaders(),
    })
  },

  createActivityType(payload) {
    return httpClient.post('/training/activity-types', payload, {
      headers: authHeaders(),
    })
  },

  updateActivityType(id, payload) {
    return httpClient.put(`/training/activity-types/${id}`, payload, {
      headers: authHeaders(),
    })
  },

  updateActivityTypeStatus(id, payload) {
    return httpClient.patch(`/training/activity-types/${id}/status`, payload, {
      headers: authHeaders(),
    })
  },

  getRecordOptions() {
    return httpClient.get('/training/records/options', {
      headers: authHeaders(),
    })
  },

  getRecord(id) {
    return httpClient.get(`/training/records/${id}`, {
      headers: authHeaders(),
    })
  },

  createRecord(payload) {
    return httpClient.post('/training/records', payload, {
      headers: authHeaders(),
    })
  },

  updateRecord(id, payload) {
    return httpClient.put(`/training/records/${id}`, payload, {
      headers: authHeaders(),
    })
  },

  submitRecord(id, payload) {
    return httpClient.post(`/training/records/${id}/submit`, payload, {
      headers: authHeaders(),
    })
  },

  listEvidence(recordId) {
    return httpClient.get(`/training/records/${recordId}/evidences`, {
      headers: authHeaders(),
    })
  },

  uploadEvidence(recordId, file) {
    const formData = new FormData()
    formData.append('file', file)

    return httpClient.post(`/training/records/${recordId}/evidences`, formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  deleteEvidence(recordId, evidenceId) {
    return httpClient.delete(`/training/records/${recordId}/evidences/${evidenceId}`, {
      headers: authHeaders(),
    })
  },

  createEvidenceDownloadUrl(recordId, evidenceId) {
    return httpClient.post(`/training/records/${recordId}/evidences/${evidenceId}/download-url`, null, {
      headers: authHeaders(),
    })
  },
}
