import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const notificationsApi = {
  list(params) {
    return httpClient.get('/me/notifications', {
      headers: authHeaders(),
      params,
    })
  },

  get(id) {
    return httpClient.get(`/me/notifications/${id}`, {
      headers: authHeaders(),
    })
  },

  getUnreadCount() {
    return httpClient.get('/me/notifications/unread-count', {
      headers: authHeaders(),
    })
  },

  markAsRead(id) {
    return httpClient.patch(`/me/notifications/${id}`, { read: true }, {
      headers: authHeaders(),
    })
  },

  markAllAsRead() {
    return httpClient.patch('/me/notifications/read-status', { read: true }, {
      headers: authHeaders(),
    })
  },

  delete(id) {
    return httpClient.delete(`/me/notifications/${id}`, {
      headers: authHeaders(),
    })
  },
}
