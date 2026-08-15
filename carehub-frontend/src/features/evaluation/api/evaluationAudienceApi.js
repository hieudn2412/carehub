import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const token = tokenStorage.getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const evaluationAudienceApi = {
  preview(ruleJson) {
    return httpClient.post('/evaluation-audiences/preview', { ruleJson }, { headers: authHeaders() })
  },
  list() {
    return httpClient.get('/evaluation-audiences', { headers: authHeaders() })
  },
  create(payload) {
    return httpClient.post('/evaluation-audiences', payload, { headers: authHeaders() })
  },
  update(id, payload) {
    return httpClient.put(`/evaluation-audiences/${id}`, payload, { headers: authHeaders() })
  },
  activate(id) {
    return httpClient.post(`/evaluation-audiences/${id}/activate`, {}, { headers: authHeaders() })
  },
  archive(id) {
    return httpClient.delete(`/evaluation-audiences/${id}`, { headers: authHeaders() })
  },
}
