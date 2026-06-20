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

  getNotificationConfig() {
    return httpClient.get('/notifications/config', {
      headers: authHeaders(),
    })
  },

  updateNotificationConfig(data) {
    return httpClient.put('/notifications/config', data, {
      headers: authHeaders(),
    })
  },

  getEmailTemplates(params) {
    return httpClient.get('/email/templates', {
      headers: authHeaders(),
      params,
    })
  },

  getEmailTemplateById(id) {
    return httpClient.get(`/email/templates/${id}`, {
      headers: authHeaders(),
    })
  },

  createEmailTemplate(data) {
    return httpClient.post('/email/templates', data, {
      headers: authHeaders(),
    })
  },

  updateEmailTemplate(id, data) {
    return httpClient.put(`/email/templates/${id}`, data, {
      headers: authHeaders(),
    })
  },

  deleteEmailTemplate(id) {
    return httpClient.delete(`/email/templates/${id}`, {
      headers: authHeaders(),
    })
  },
}
