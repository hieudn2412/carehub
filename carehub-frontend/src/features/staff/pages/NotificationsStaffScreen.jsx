import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BellOutlined,
  SearchOutlined,
  DeleteOutlined,
  CheckOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  CloseOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/NotificationsStaffScreen.css'

function NotificationsStaffScreen() {
  const { showToast } = useToast()
  
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [activeTab, setActiveTab] = useState('all') // all, unread, read
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const size = 10

  // Notification Detail Modal state
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Xử lý debounce cho tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(0)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Hàm tải thông báo từ API
  const fetchNotifications = () => {
    setLoading(true)
    const token = tokenStorage.getAccessToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    
    const params = {
      page,
      size,
      sort: 'createdAt,desc',
      q: debouncedQuery.trim() || '%',
    }
    
    if (activeTab === 'unread') {
      params.read = false
    } else if (activeTab === 'read') {
      params.read = true
    }

    Promise.all([
      httpClient.get('/me/notifications', { headers, params }),
      httpClient.get('/me', { headers })
    ])
      .then(([notifRes, profileRes]) => {
        const profile = profileRes.data?.data
        const currentName = profile?.fullName || ''
        const data = notifRes.data?.data
        const content = data?.content || []

        const filtered = content.filter(n => {
          // Filter out self-submit notifications for managers
          if (n.title === 'Hồ sơ CME mới chờ duyệt' && currentName && n.content.includes(currentName)) {
            return false
          }
          return true
        })

        setNotifications(filtered)
        setTotalPages(data?.totalPages || 0)
        setTotalElements(filtered.length)
        setError(null)
      })
      .catch(err => {
        console.error("Lỗi khi tải thông báo:", err)
        setError("Không thể tải danh sách thông báo. Vui lòng thử lại sau.")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchNotifications()
  }, [activeTab, debouncedQuery, page])

  // Tải chi tiết một thông báo (gắn API GET /api/v1/me/notifications/{id})
  const handleOpenDetail = async (notif) => {
    setDetailLoading(true)
    setSelectedNotification(notif)
    
    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await httpClient.get(`/me/notifications/${notif.id}`, { headers })
      
      const freshData = response.data?.data
      if (freshData) {
        setSelectedNotification(freshData)
      }

      // Tự động đánh dấu đã đọc khi xem chi tiết
      if (!notif.read) {
        handleMarkAsRead(notif.id, true)
      }
    } catch (err) {
      console.error("Lỗi khi tải chi tiết thông báo:", err)
      showToast("Không thể tải chi tiết thông báo.", "error")
    } finally {
      setDetailLoading(false)
    }
  }

  // Đánh dấu đã đọc một thông báo (gắn API POST /api/v1/me/notifications/{id}/action)
  const handleMarkAsRead = async (id, silent = false) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    
    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await httpClient.post(`/me/notifications/${id}/action`, { action: 'MARK_READ' }, { headers })
      if (!silent) {
        showToast("Đã đánh dấu là đã đọc.", "success")
      }
    } catch (err) {
      console.error("Lỗi khi đánh dấu đã đọc:", err)
      fetchNotifications()
    }
  }

  // Xóa một thông báo (gắn API DELETE /api/v1/me/notifications/{id})
  const handleDelete = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    
    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await httpClient.delete(`/me/notifications/${id}`, { headers })
      setTotalElements(prev => Math.max(0, prev - 1))
      showToast("Đã xóa thông báo thành công.", "success")
    } catch (err) {
      console.error("Lỗi khi xóa thông báo:", err)
      showToast("Không thể xóa thông báo.", "error")
      fetchNotifications()
    }
  }

  // Đánh dấu tất cả thông báo hiển thị là đã đọc
  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

    try {
      const token = tokenStorage.getAccessToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      await Promise.all(
        unread.map(n =>
          httpClient.post(`/me/notifications/${n.id}/action`, { action: 'MARK_READ' }, { headers })
        )
      )
      showToast("Đã đánh dấu đọc tất cả thông báo.", "success")
    } catch (err) {
      console.error("Lỗi khi đánh dấu tất cả đã đọc:", err)
      fetchNotifications()
    }
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setPage(newPage)
    }
  }

  // Icon phụ trợ theo loại thông báo
  const getIcon = (type) => {
    switch (type) {
      case 'DANGER': return <WarningOutlined />
      case 'WARNING': return <InfoCircleOutlined />
      case 'SUCCESS': return <CheckCircleOutlined />
      default: return <InfoCircleOutlined />
    }
  }

  const getIconClass = (type) => {
    switch (type) {
      case 'DANGER': return 'notify-icon-box--danger'
      case 'WARNING': return 'notify-icon-box--warning'
      case 'SUCCESS': return 'notify-icon-box--success'
      default: return 'notify-icon-box--info'
    }
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const d = String(date.getDate()).padStart(2, '0')
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const y = date.getFullYear()
      const hh = String(date.getHours()).padStart(2, '0')
      const mm = String(date.getMinutes()).padStart(2, '0')
      return `${d}/${m}/${y} ${hh}:${mm}`
    } catch (e) {
      return dateStr
    }
  }

  const hasUnread = notifications.some(n => !n.read)

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Thông báo" />
        <div className="dashboard-layout__body">
          <div className="notify-page-container">
            <div className="notify-card">
              <div className="notify-card__title-area">
                <div>
                  <h2 className="notify-card__title">Thông báo của tôi</h2>
                  <p className="notify-card__subtitle">Xem và quản lý tất cả các thông báo từ hệ thống dành cho bạn</p>
                </div>
              </div>

              {/* Bộ lọc & Tìm kiếm */}
              <div className="notify-filters-bar">
                <div className="notify-tabs">
                  <button 
                    onClick={() => { setActiveTab('all'); setPage(0); }}
                    className={`notify-tab-btn ${activeTab === 'all' ? 'notify-tab-btn--active' : ''}`}
                  >
                    Tất cả
                  </button>
                  <button 
                    onClick={() => { setActiveTab('unread'); setPage(0); }}
                    className={`notify-tab-btn ${activeTab === 'unread' ? 'notify-tab-btn--active' : ''}`}
                  >
                    Chưa đọc
                  </button>
                  <button 
                    onClick={() => { setActiveTab('read'); setPage(0); }}
                    className={`notify-tab-btn ${activeTab === 'read' ? 'notify-tab-btn--active' : ''}`}
                  >
                    Đã đọc
                  </button>
                </div>

                <div className="notify-actions-row">
                  <div className="training-search-container" style={{ minWidth: '240px' }}>
                    <input
                      type="text"
                      className="training-search-input"
                      placeholder="Tìm kiếm thông báo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="training-search-icon">
                      <SearchOutlined style={{ color: '#9ca3af' }} />
                    </span>
                  </div>

                  {hasUnread && (
                    <button onClick={handleMarkAllAsRead} className="notify-mark-all-btn">
                      <CheckOutlined /> Đánh dấu đã đọc tất cả
                    </button>
                  )}
                </div>
              </div>

              {/* Danh sách thông báo */}
              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                  Đang tải danh sách thông báo...
                </div>
              ) : error ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#ef4444' }}>
                  {error}
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                  Không có thông báo nào được tìm thấy.
                </div>
              ) : (
                <div className="notify-list">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`notify-item-card ${!n.read ? 'notify-item-card--unread' : ''}`}
                      onClick={() => handleOpenDetail(n)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={`notify-icon-box ${getIconClass(n.type)}`}>
                        {getIcon(n.type)}
                      </div>
                      
                      <div className="notify-item-content">
                        <div className="notify-item-header">
                          <h4 className="notify-item-title">{n.title}</h4>
                          {!n.read && <span className="notify-unread-dot" title="Chưa đọc" />}
                        </div>
                        <p className="notify-item-desc" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {n.content}
                        </p>
                        
                        <div className="notify-item-footer">
                          <span>Hệ thống</span>
                          <span>•</span>
                          <span>{formatDateTime(n.createdAt)}</span>
                        </div>
                      </div>

                      <div className="notify-item-actions">
                        {!n.read && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMarkAsRead(n.id); }}
                            className="notify-action-circle-btn notify-action-circle-btn--success"
                            title="Đánh dấu đã đọc"
                          >
                            <CheckOutlined />
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                          className="notify-action-circle-btn notify-action-circle-btn--danger"
                          title="Xóa thông báo"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phân trang */}
              {!loading && totalPages > 1 && (
                <div className="training-pagination" style={{ marginTop: '24px' }}>
                  <span className="training-pagination__info">
                    Hiển thị {notifications.length} trong số {totalElements} thông báo
                  </span>
                  <div className="training-pagination__pages">
                    <button
                      className="training-page-btn"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 0}
                    >
                      <LeftOutlined />
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        className={`training-page-btn ${page === idx ? 'training-page-btn--active' : ''}`}
                        onClick={() => handlePageChange(idx)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="training-page-btn"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages - 1}
                    >
                      <RightOutlined />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {selectedNotification && (
        <div className="notify-modal-overlay" onClick={() => setSelectedNotification(null)}>
          <div className="notify-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="notify-modal-close" onClick={() => setSelectedNotification(null)}>
              <CloseOutlined />
            </button>
            
            {detailLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải chi tiết thông báo...
              </div>
            ) : (
              <>
                <div className="notify-modal-header">
                  <div className={`notify-icon-box ${getIconClass(selectedNotification.type)}`}>
                    {getIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <h3 className="notify-modal-title">{selectedNotification.title}</h3>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      <span>Hệ thống</span> • <span>{formatDateTime(selectedNotification.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="notify-modal-content">
                  {selectedNotification.content}
                </div>
                
                <div className="notify-modal-footer">
                  {selectedNotification.deepLink && (
                    <Link 
                      to={selectedNotification.deepLink} 
                      className="training-button training-button--primary"
                      style={{ textDecoration: 'none', height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontSize: 13.5 }}
                      onClick={() => setSelectedNotification(null)}
                    >
                      <LinkOutlined style={{ marginRight: 6 }} /> Xem chi tiết
                    </Link>
                  )}
                  <button 
                    className="training-button"
                    style={{ height: 38, borderRadius: 8, fontSize: 13.5 }}
                    onClick={() => setSelectedNotification(null)}
                  >
                    Đóng
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationsStaffScreen
