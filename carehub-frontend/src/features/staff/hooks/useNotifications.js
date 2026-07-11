import { useCallback, useEffect, useState } from 'react'
import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const token = tokenStorage.getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function mapNotification(notification) {
  const read = Boolean(notification.read)
  return {
    ...notification,
    message: notification.content,
    description: notification.content,
    sender: 'Hệ thống',
    rawCreatedAt: notification.createdAt,
    createdAt: formatDateTime(notification.createdAt),
    read,
    isRead: read,
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = authHeaders()
      const [listResponse, countResponse] = await Promise.all([
        httpClient.get('/me/notifications', { headers, params: { page: 0, size: 8 } }),
        httpClient.get('/me/notifications/unread-count', { headers }),
      ])
      setNotifications((listResponse.data?.data?.content || []).map(mapNotification))
      setUnreadCount(countResponse.data?.data?.unreadCount || 0)
      setError(null)
    } catch (requestError) {
      console.error('Không thể tải thông báo', requestError)
      setError(requestError.message || 'Không thể tải thông báo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const markAllAsRead = async () => {
    const previous = notifications
    const previousCount = unreadCount
    setNotifications((current) => current.map((item) => ({ ...item, read: true, isRead: true })))
    setUnreadCount(0)
    try {
      await httpClient.patch('/me/notifications/read-status', { read: true }, { headers: authHeaders() })
    } catch (requestError) {
      console.error('Không thể đánh dấu tất cả thông báo đã đọc', requestError)
      setNotifications(previous)
      setUnreadCount(previousCount)
    }
  }

  const markAsRead = async (id) => {
    const target = notifications.find((item) => item.id === id)
    if (!target || target.read) return
    setNotifications((current) => current.map((item) => (
      item.id === id ? { ...item, read: true, isRead: true } : item
    )))
    setUnreadCount((current) => Math.max(0, current - 1))
    try {
      await httpClient.patch(`/me/notifications/${id}`, { read: true }, { headers: authHeaders() })
    } catch (requestError) {
      console.error('Không thể đánh dấu thông báo đã đọc', requestError)
      load()
    }
  }

  return { notifications, unreadCount, loading, error, markAllAsRead, markAsRead, reload: load }
}
