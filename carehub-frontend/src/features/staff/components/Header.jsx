import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  FormOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { useNotifications } from '../hooks/useNotifications'
import { staffApi } from '../api/staffApi'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import AccountDropdown from '../../../shared/components/AccountDropdown.jsx'
import HeaderBackNavigation from '../../../shared/components/HeaderBackNavigation.jsx'
import '../../admin/styles/AdminHeader.css'

function getFallbackLink(label, roles = []) {
  const isAdm = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isMgr = roles.some(r => String(r).toUpperCase().includes('MANAGER'))
  const lbl = String(label).toLowerCase().trim()

  if (lbl.includes('chất lượng') || lbl.includes('checklist') || lbl.includes('quy trình')) {
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
  if (lbl.includes('cấu hình đề') || lbl.includes('quản lý bài kiểm tra')) {
    return '/admin/evaluation/exam-management'
  }
  if (lbl.includes('tạo câu hỏi từ tài liệu')) {
    return '/admin/evaluation/question-documents'
  }
  if (lbl === 'trang chủ') {
    return isAdm ? '/admin/dashboard' : (isMgr ? '/manager/dashboard' : '/staff/dashboard')
  }
  return null
}

function Header({ title = 'Trang chủ', userName = '', roleName = '', breadcrumbs, back }) {
  const [profile, setProfile] = useState(null)

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))

  useEffect(() => {
    staffApi.getProfile()
      .then(res => {
        setProfile(res.data?.data)
      })
      .catch(err => console.error("Error loading header profile", err))
  }, [])

  const displayName = profile?.fullName || userName
  const displayRole = profile?.roles?.map(r => r.name).join(', ') || roleName
  const avatarLetter = displayName ? displayName.trim().split(' ').pop().charAt(0).toUpperCase() : 'U'
  const [showNotifications, setShowNotifications] = useState(false)
  const popoverRef = useRef(null)
  const notifyRef = useRef(null)

  const {
    notifications,
    unreadCount,
    pendingExamCount,
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

  const getNotificationTone = (type) => {
    switch (type) {
      case 'DANGER':
        return 'danger'
      case 'WARNING':
        return 'warning'
      case 'SUCCESS':
        return 'success'
      default:
        return 'info'
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
          <button
            type="button"
            key={item.id}
            className={`notify-item${item.read ? '' : ' notify-item--unread'}`}
            onClick={() => markAsRead(item.id)}
          >
            <div className={`notify-item__icon-wrapper notify-item__icon-wrapper--${getNotificationTone(item.type)}`}>
              {getIcon(item.type)}
            </div>
            <div className="notify-item__content">
              <p className="notify-item__desc">{item.message}</p>
              <p className="notify-item__footer">{item.sender} - {item.createdAt}</p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <header className="dashboard-header dashboard-header--staff">
      <div className="dashboard-header__main">
        <button
          type="button"
          className="dashboard-header__menu-button"
          aria-label="Mở menu điều hướng"
          onClick={() => window.dispatchEvent(new CustomEvent(isAdmin ? 'admin-sidebar-toggle' : 'staff-sidebar-toggle'))}
        >
          <MenuOutlined />
        </button>
        <div className="dashboard-header__navigation">
          {back ? <HeaderBackNavigation {...back} /> : null}
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <div className="dashboard-header__breadcrumbs">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                const resolvedLink = item.link || item.path || item.route || getFallbackLink(item.label, roles)
                if (isLast) {
                  return (
                    <span key={index} className="dashboard-header__breadcrumb-current">
                      {item.label}
                    </span>
                  )
                }
                return (
                  <span key={index} className="dashboard-header__breadcrumb-item">
                    {resolvedLink ? (
                      <Link to={resolvedLink}>
                        {item.label}
                      </Link>
                    ) : (
                      <span>{item.label}</span>
                    )}
                    <span className="dashboard-header__breadcrumb-separator">›</span>
                  </span>
                )
              })}
            </div>
          ) : (
            <h1 className="dashboard-header__title">{title}</h1>
          )}
        </div>
      </div>

      <div className="dashboard-header__right">
        <Link
          to="/staff/exam/take"
          className="dashboard-header__exam-notify"
          title={`${pendingExamCount} bài kiểm tra chưa làm`}
          aria-label={`${pendingExamCount} bài kiểm tra chưa làm`}
        >
          <FormOutlined />
          {pendingExamCount > 0 && <span className="dashboard-header__exam-badge">{pendingExamCount > 99 ? '99+' : pendingExamCount}</span>}
        </Link>
        <div className="dashboard-header__notify-container">
          <button
            type="button"
            ref={notifyRef}
            className="dashboard-header__notify"
            onClick={() => setShowNotifications(prev => !prev)}
            aria-label="Mở thông báo"
            aria-expanded={showNotifications}
          >
            <BellOutlined />
            {unreadCount > 0 && <span className="dashboard-header__notify-dot"></span>}
          </button>

          {showNotifications && (
            <div className="notify-popover" ref={popoverRef}>
              <div className="notify-popover__header">
                <div className="notify-popover__title-area">
                  <h3 className="notify-popover__title">Thông báo</h3>
                  <p className="notify-popover__subtitle">
                    Bạn có <span>{unreadCount} thông báo</span> hôm nay
                  </p>
                </div>
                <button
                  className="notify-popover__mark-read"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Đọc tất cả
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
          profilePath="/staff/profile"
        />
      </div>
    </header>
  )
}

export default Header
