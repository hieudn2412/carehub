import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const evaluationImportApi = {
  listImports(params) {
    return httpClient.get('/evaluation-imports', {
      headers: authHeaders(),
      params,
    })
  },

  getImport(importJobId) {
    return httpClient.get(`/evaluation-imports/${importJobId}`, {
      headers: authHeaders(),
    })
  },

  exportErrorFile(importJobId) {
    return httpClient.get(`/evaluation-imports/${importJobId}/error-file`, {
      headers: authHeaders(),
      responseType: 'blob',
    })
  },
}
