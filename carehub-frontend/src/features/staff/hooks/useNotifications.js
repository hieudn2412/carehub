import { useEffect, useState } from 'react'
import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Thiếu giờ đào tạo liên tục CME',
    description: 'Tổng giờ CME 5 năm của bạn hiện tại là 98 / 120h. Cần bổ sung thêm 22h trước kỳ đánh giá. Vui lòng cập nhật hồ sơ đào tạo.',
    sender: 'Hệ thống',
    createdAt: '04/06/2026 07:00',
    type: 'DANGER',
    isRead: false,
    group: 'Hôm nay',
  },
  {
    id: 2,
    title: 'Bài kiểm tra được phân công',
    description: 'Quản lý đã giao bài kiểm tra Kỹ năng điều dưỡng cơ bản. Hạn chót: 10/06/2026.',
    sender: 'Trần Văn Hùng(Quản lý)',
    createdAt: '04/06/2026 07:00',
    type: 'WARNING',
    isRead: false,
    group: 'Hôm nay',
  },
  {
    id: 3,
    title: 'Hồ sơ đào tạo đã được duyệt',
    description: 'Hồ sơ Hồi sức cơ bản BLS (8h) đã được quản lý xác nhận và cộng vào tổng giờ CME.',
    sender: 'Hệ thống',
    createdAt: '02/06/2026 09:15',
    type: 'SUCCESS',
    isRead: true,
    group: 'Tuần này',
  },
]

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // ── GIẢ LẬP DỮ LIỆU TỪ SERVER ───────────────────────────
    const timer = setTimeout(() => {
      setNotifications(MOCK_NOTIFICATIONS)
      setLoading(false)
    }, 300)

    return () => clearTimeout(timer)

    /*
    // SAU NÀY CÓ API BACKEND, BẠN CHỈ CẦN MỞ COMMENT ĐOẠN NÀY:
    const token = tokenStorage.getAccessToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    httpClient.get('/user/notifications', { headers })
      .then(res => {
        setNotifications(res.data.data)
      })
      .catch(err => {
        setError(err.message || 'Lỗi khi tải thông báo')
      })
      .finally(() => {
        setLoading(false)
      })
    */
  }, [])

  // Đánh dấu tất cả là đã đọc
  const markAllAsRead = async () => {
    // 1. Cập nhật Local State cho UI mượt mà lập tức
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))

    /*
    // 2. Gọi API Backend để lưu vào cơ sở dữ liệu
    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await httpClient.post('/user/notifications/read-all', {}, { headers })
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đã đọc trên server', err)
    }
    */
  }

  // Đánh dấu một thông báo cụ thể là đã đọc
  const markAsRead = async (id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    )

    /*
    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await httpClient.patch(`/user/notifications/${id}/read`, {}, { headers })
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đã đọc', err)
    }
    */
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
