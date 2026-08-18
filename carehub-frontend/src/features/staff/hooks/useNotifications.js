import { useCallback, useEffect, useState } from 'react'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { notificationsApi } from '../api/notificationsApi.js'

const NOTIFICATION_SYNC_EVENT = 'carehub:notification-state-changed'

export function publishNotificationStateChange(detail = {}) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_SYNC_EVENT, { detail }))
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
  const [pendingExamCount, setPendingExamCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listResponse, countResponse, assignmentResponse] = await Promise.all([
        notificationsApi.list({ page: 0, size: 8 }),
        notificationsApi.getUnreadCount(),
        myExamApi.listAssignments().catch(() => ({ data: { data: [] } })),
      ])
      setNotifications((listResponse.data?.data?.content || []).map(mapNotification))
      setUnreadCount(countResponse.data?.data?.unreadCount || 0)
      const assignments = assignmentResponse.data?.data || []
      setPendingExamCount((Array.isArray(assignments) ? assignments : []).filter((assignment) => (
        assignment.actionable
      )).length)
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

  useEffect(() => {
    const handleNotificationStateChange = (event) => {
      const detail = event.detail || {}

      if (detail.refresh) {
        load()
        return
      }

      if (detail.markAllRead) {
        setNotifications((current) => current.map((item) => ({
          ...item,
          read: true,
          isRead: true,
        })))
      } else if (detail.readId != null) {
        setNotifications((current) => current.map((item) => (
          item.id === detail.readId
            ? { ...item, read: true, isRead: true }
            : item
        )))
      }

      if (Number.isFinite(detail.unreadCount)) {
        setUnreadCount(Math.max(0, detail.unreadCount))
      } else if (Number.isFinite(detail.decrementUnreadBy)) {
        setUnreadCount((current) => Math.max(0, current - detail.decrementUnreadBy))
      }
    }

    window.addEventListener(NOTIFICATION_SYNC_EVENT, handleNotificationStateChange)
    return () => window.removeEventListener(NOTIFICATION_SYNC_EVENT, handleNotificationStateChange)
  }, [load])

  const markAllAsRead = async () => {
    const previous = notifications
    const previousCount = unreadCount
    setNotifications((current) => current.map((item) => ({ ...item, read: true, isRead: true })))
    setUnreadCount(0)
    try {
      await notificationsApi.markAllAsRead()
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
      await notificationsApi.markAsRead(id)
    } catch (requestError) {
      console.error('Không thể đánh dấu thông báo đã đọc', requestError)
      load()
    }
  }

  return { notifications, unreadCount, pendingExamCount, loading, error, markAllAsRead, markAsRead, reload: load }
}
