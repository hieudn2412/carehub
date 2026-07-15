import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const promptTemplateApi = {
  list(params) {
    return httpClient.get('/prompt-templates', { headers: authHeaders(), params })
  },

  get(id) {
    return httpClient.get(`/prompt-templates/${id}`, { headers: authHeaders() })
  },

  getActive(provider, model) {
    return httpClient.get('/prompt-templates/active', {
      headers: authHeaders(),
      params: { provider, model },
    })
  },

  create(payload) {
    return httpClient.post('/prompt-templates', payload, { headers: authHeaders() })
  },

  activate(id) {
    return httpClient.put(`/prompt-templates/${id}/activate`, {}, { headers: authHeaders() })
  },
}
