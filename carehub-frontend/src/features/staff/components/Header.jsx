import { useState, useRef, useEffect } from 'react'
import {
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useNotifications } from '../hooks/useNotifications'

function Header({ title = 'Trang chủ', userName = 'Phạm Quốc Bảo', roleName = 'Nhân viên' }) {
  const avatarLetter = userName ? userName.split(' ').pop().charAt(0).toUpperCase() : 'U'
  const [showNotifications, setShowNotifications] = useState(false)
  const popoverRef = useRef(null)
  const notifyRef = useRef(null)

  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
  } = useNotifications()

  // Xử lý đóng popover khi click ra ngoài
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

  // Phân bổ Icon theo Type
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

  // Phân bổ màu Icon Container theo Type
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

  // Hiển thị highlight đỏ cho giờ CME
  const renderDescription = (text) => {
    if (text.includes('98 / 120h')) {
      const parts = text.split('98 / 120h')
      return (
        <p className="notify-item__desc">
          {parts[0]}<span className="highlight-red">98 / 120h</span>{parts[1]}
        </p>
      )
    }
    return <p className="notify-item__desc">{text}</p>
  }

  // Render từng nhóm thông báo (Hôm nay, Tuần này)
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
      <h1 className="dashboard-header__title">{title}</h1>

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
            <p className="dashboard-header__name">{userName}</p>
            <span className="dashboard-header__role">{roleName}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
