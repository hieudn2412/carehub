import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const adminApi = {
  getUsers(params) {
    return httpClient.get('/users', {
      headers: authHeaders(),
      params,
    })
  },

  getDepartments() {
    return httpClient.get('/departments', {
      headers: authHeaders(),
    })
  },

  getRoles() {
    return httpClient.get('/roles', {
      headers: authHeaders(),
    })
  },

  getUserById(id) {
    return httpClient.get(`/user/${id}`, {
      headers: authHeaders(),
    })
  },

  exportUsers(params) {
    return httpClient.get('/users/export', {
      headers: authHeaders(),
      params,
    })
  },

  getImportLogs(params) {
    return httpClient.get('/system/import-logs', {
      headers: authHeaders(),
      params,
    })
  },
}
