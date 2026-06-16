import { useEffect, useState } from 'react'
import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = tokenStorage.getAccessToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    httpClient.get('/me/notifications', { headers })
      .then(res => {
        const content = res.data?.data?.content || []
        const mapped = content.map(n => {
          // Determine group: "Hôm nay", "Tuần này", "Cũ hơn"
          let group = 'Cũ hơn'
          try {
            const date = new Date(n.createdAt)
            const now = new Date()
            const diffTime = Math.abs(now - date)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            if (diffDays <= 1) {
              group = 'Hôm nay'
            } else if (diffDays <= 7) {
              group = 'Tuần này'
            }
          } catch (e) {
            group = 'Tuần này'
          }

          // Format date to: DD/MM/YYYY HH:mm
          let formattedDate = ''
          try {
            const date = new Date(n.createdAt)
            const d = String(date.getDate()).padStart(2, '0')
            const m = String(date.getMonth() + 1).padStart(2, '0')
            const y = date.getFullYear()
            const hh = String(date.getHours()).padStart(2, '0')
            const mm = String(date.getMinutes()).padStart(2, '0')
            formattedDate = `${d}/${m}/${y} ${hh}:${mm}`
          } catch (e) {
            formattedDate = n.createdAt
          }

          return {
            id: n.id,
            title: n.title,
            description: n.content,
            sender: 'Hệ thống',
            createdAt: formattedDate,
            type: n.type, // DANGER, WARNING, SUCCESS
            isRead: n.read,
            group,
          }
        })
        setNotifications(mapped)
      })
      .catch(err => {
        console.error('Lỗi khi tải thông báo', err)
        setError(err.message || 'Lỗi khi tải thông báo')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Đánh dấu tất cả là đã đọc
  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead)
    // Cập nhật Local State lập tức
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))

    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await Promise.all(
        unread.map(n =>
          httpClient.post(`/me/notifications/${n.id}/action`, { action: 'MARK_READ' }, { headers })
        )
      )
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đã đọc trên server', err)
    }
  }

  // Đánh dấu một thông báo cụ thể là đã đọc
  const markAsRead = async (id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    )

    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await httpClient.post(`/me/notifications/${id}/action`, { action: 'MARK_READ' }, { headers })
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đã đọc', err)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAllAsRead,
    markAsRead,
  }
}

