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
}
