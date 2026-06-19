import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useNotifications } from '../../staff/hooks/useNotifications'
import { staffApi } from '../../staff/api/staffApi'
import '../styles/AdminHeader.css'

function AdminHeader({ title = 'Trang chủ', userName = '', roleName = '', breadcrumbs }) {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    staffApi.getProfile()
      .then(res => {
        setProfile(res.data?.data)
      })
      .catch(err => console.error("Error loading admin header profile", err))
  }, [])

  const displayName = profile?.fullName || userName
  const displayRole = profile?.roles?.map(r => r.name).join(', ') || roleName || 'Quản trị viên'
  const avatarLetter = displayName ? displayName.trim().split(' ').pop().charAt(0).toUpperCase() : 'A'
  const [showNotifications, setShowNotifications] = useState(false)
  const popoverRef = useRef(null)
  const notifyRef = useRef(null)

  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
  } = useNotifications()

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target) &&
        notifyRef.current && !notifyRef.current.contains(event.target)
      ) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getIcon = (type) => {
    switch (type) {
      case 'DANGER':
        return <WarningOutlined />
      case 'WARNING':
        return <InfoCircleOutlined />
      case 'SUCCESS':
        return <CheckCircleOutlined />
      default:
        return <InfoCircleOutlined />
    }
  }

  const getIconWrapperColorClass = (type) => {
    switch (type) {
      case 'DANGER':
        return 'danger'
      case 'WARNING':
        return 'warning'
      case 'SUCCESS':
        return 'success'
      default:
        return 'warning'
    }
  }

  const renderDescription = (text) => {
    if (!text) return null
    const match = text.match(/(\d+\s*\/\s*120\s*(?:h|giờ))/i)
    if (match) {
      const matchedText = match[1]
      const parts = text.split(matchedText)
      return (
        <p className="notify-item__desc">
          {parts[0]}<span className="highlight-red">{matchedText}</span>{parts[1]}
        </p>
      )
    }
    return <p className="notify-item__desc">{text}</p>
  }

  const renderGroup = (label, groupItems) => {
    if (groupItems.length === 0) return null
    return (
      <div className="notify-group">
        <p className="notify-group__label">{label}</p>
        {groupItems.map(item => (
          <div
            key={item.id}
            className={`notify-item ${!item.isRead ? 'notify-item--unread' : ''}`}
            onClick={() => markAsRead(item.id)}
          >
            <div className={`notify-item__icon-wrapper notify-item__icon-wrapper--${getIconWrapperColorClass(item.type)}`}>
              {getIcon(item.type)}
            </div>
            <div className="notify-item__content">
              <p className="notify-item__title">{item.title}</p>
              {renderDescription(item.description)}
              <p className="notify-item__footer">{item.sender} - {item.createdAt}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <header className="dashboard-header">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <div className="dashboard-header__breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1
            if (isLast) {
              return (
                <span key={index} style={{ color: '#1a1a1a', fontWeight: 600 }}>
                  {item.label}
                </span>
              )
            }
            return (
              <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.link ? (
                  <Link to={item.link} style={{ color: '#6b7280', textDecoration: 'none' }}>
                    {item.label}
                  </Link>
                ) : (
                  <span style={{ color: '#6b7280' }}>{item.label}</span>
                )}
                <span style={{ color: '#9ca3af', fontSize: 12 }}>›</span>
              </span>
            )
          })}
        </div>
      ) : (
        <h1 className="dashboard-header__title">{title}</h1>
      )}

      <div className="dashboard-header__right">
        <div className="dashboard-header__notify-container">
          <div
            ref={notifyRef}
            className="dashboard-header__notify"
            onClick={() => setShowNotifications(prev => !prev)}
          >
            <BellOutlined />
            {unreadCount > 0 && <span className="dashboard-header__notify-dot"></span>}
          </div>

          {showNotifications && (
            <div className="notify-popover" ref={popoverRef}>
              <div className="notify-popover__header">
                <div className="notify-popover__title-area">
                  <h3 className="notify-popover__title">Thông báo</h3>
                  <p className="notify-popover__subtitle">
                    Bạn có <span>{unreadCount} thông báo</span> hôm nay
                  </p>
                </div>
                <button className="notify-popover__mark-read" onClick={markAllAsRead}>
                  Đánh dấu đã đọc
                </button>
              </div>

              <div className="notify-popover__body">
                {renderGroup('Hôm nay', notifications.filter(n => n.group === 'Hôm nay'))}
                {renderGroup('Tuần này', notifications.filter(n => n.group === 'Tuần này'))}
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-header__profile">
          <div className="dashboard-header__avatar">
            {avatarLetter}
          </div>
          <div className="dashboard-header__info">
            <p className="dashboard-header__name">{displayName}</p>
            <span className="dashboard-header__role">{displayRole}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AdminHeader
