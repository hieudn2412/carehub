import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const trainingGroupApi = {
  list(q) {
    return httpClient.get('/training-groups', {
      headers: authHeaders(),
      params: q ? { q } : {},
    })
  },

  get(id) {
    return httpClient.get(`/training-groups/${id}`, {
      headers: authHeaders(),
    })
  },

  create(data) {
    return httpClient.post('/training-groups', data, {
      headers: authHeaders(),
    })
  },

  update(id, data) {
    return httpClient.put(`/training-groups/${id}`, data, {
      headers: authHeaders(),
    })
  },

  delete(id) {
    return httpClient.delete(`/training-groups/${id}`, {
      headers: authHeaders(),
    })
  },
}
