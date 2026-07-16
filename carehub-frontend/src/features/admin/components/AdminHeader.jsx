import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  BookOutlined,
  DashboardOutlined,
} from '@ant-design/icons'
import { useNotifications } from '../../staff/hooks/useNotifications'
import { staffApi } from '../../staff/api/staffApi'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import AccountDropdown from '../../../shared/components/AccountDropdown.jsx'
import '../styles/AdminHeader.css'

function getFallbackLink(label, roles = []) {
  const isAdm = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isMgr = roles.some(r => String(r).toUpperCase().includes('MANAGER'))
  const lbl = String(label).toLowerCase().trim()
  
  if (lbl.includes('chất lượng') || lbl.includes('checklist') || lbl.includes('bảng kiểm')) {
    return isAdm ? '/admin/quality/checklists' : '/manager/quality/checklists'
  }
  if (lbl.includes('đào tạo')) {
    return '/training/employees'
  }
  if (lbl.includes('đánh giá') || lbl.includes('lịch sử')) {
    return isAdm ? '/admin/quality/history' : '/manager/quality/history'
  }
  if (lbl.includes('nhân sự') || lbl.includes('nhân viên')) {
    return isAdm ? '/admin/reference/employees' : '/manager/employees'
  }
  if (lbl.includes('phòng ban')) {
    return '/admin/reference/departments'
  }
  if (lbl.includes('hệ thống') || lbl.includes('log') || lbl.includes('cấu hình hệ thống')) {
    return '/admin/system-settings'
  }
  if (lbl.includes('thông báo')) {
    return '/admin/notifications/settings'
  }
  if (lbl.includes('mẫu email')) {
    return '/admin/notifications/email-templates'
  }
  if (lbl.includes('quy tắc phân loại')) {
    return '/admin/evaluation/classification-rules'
  }
  if (lbl.includes('bộ câu hỏi')) {
    return '/admin/evaluation/question-sets'
  }
  if (lbl.includes('danh mục câu hỏi')) {
    return '/admin/evaluation/categories'
  }
  if (lbl.includes('ngân hàng câu hỏi')) {
    return '/admin/evaluation/question-bank'
  }
  if (lbl.includes('cấu hình đề')) {
    return '/admin/evaluation/configs'
  }
  if (lbl.includes('tạo câu hỏi từ tài liệu')) {
    return '/admin/evaluation/question-documents'
  }
  if (lbl === 'trang chủ' || lbl === 'home') {
    return isAdm ? '/admin/dashboard' : (isMgr ? '/manager/dashboard' : '/staff/dashboard')
  }
  return null
}

function AdminHeader({ title = 'Trang chủ', userName = '', roleName = '', breadcrumbs }) {
  const [profile, setProfile] = useState(null)
  
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)

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

  const renderNotificationContent = () => {
    if (notifications.length === 0) {
      return (
        <div className="notify-popover__empty">
          <p>Không có thông báo mới nào</p>
        </div>
      )
    }

    return (
      <div className="notify-popover__list">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`notify-item ${item.read ? 'read' : ''}`}
            onClick={() => markAsRead(item.id)}
          >
            <div className={`notify-item__icon ${item.type?.toLowerCase()}`}>
              {getIcon(item.type)}
            </div>
            <div className="notify-item__content">
              <p className="notify-item__text">{item.message}</p>
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
            const resolvedLink = item.link || getFallbackLink(item.label, roles)
            if (isLast) {
              return (
                <span key={index} style={{ color: '#1a1a1a', fontWeight: 600 }}>
                  {item.label}
                </span>
              )
            }
            return (
              <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {resolvedLink ? (
                  <Link to={resolvedLink} style={{ color: '#6b7280', textDecoration: 'none' }} className="hover:text-[#1890ff] transition-colors">
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

      <div className="dashboard-header__quick-nav">
        <Link to="/admin/dashboard" className="dashboard-header__quick-link" title="Dashboard">
          <DashboardOutlined />
        </Link>
        <Link to="/training/employees" className="dashboard-header__quick-link" title="Giờ đào tạo nhân viên">
          <BookOutlined />
        </Link>
      </div>

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
                {renderNotificationContent()}
              </div>
            </div>
          )}
        </div>

        <AccountDropdown
          avatarLetter={avatarLetter}
          displayName={displayName}
          displayRole={displayRole}
          profilePath="/admin/profile"
        />
      </div>
    </header>
  )
}

export default AdminHeader
