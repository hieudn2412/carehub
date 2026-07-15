import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DownOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../features/auth/constants/authRoutes.js'
import { logoutUser } from '../../features/auth/services/logoutUser.js'
import './AccountDropdown.css'

function AccountDropdown({ avatarLetter, displayName, displayRole, profilePath }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleProfileNavigation = () => {
    setIsOpen(false)
    navigate(profilePath)
  }

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    await logoutUser()
    navigate(AUTH_ROUTES.login, { replace: true })
  }

  return (
    <div className="account-dropdown" ref={containerRef}>
      <button
        type="button"
        className="dashboard-header__profile account-dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="dashboard-header__avatar" aria-hidden="true">
          {avatarLetter}
        </span>
        <span className="dashboard-header__info">
          <span className="dashboard-header__name">{displayName}</span>
          <span className="dashboard-header__role">{displayRole}</span>
        </span>
        <DownOutlined className="account-dropdown__chevron" />
      </button>

      {isOpen && (
        <div className="account-dropdown__menu" role="menu">
          <button
            type="button"
            className="account-dropdown__item"
            role="menuitem"
            onClick={handleProfileNavigation}
          >
            <UserOutlined />
            <span>Thông tin tài khoản</span>
          </button>
          <div className="account-dropdown__divider" />
          <button
            type="button"
            className="account-dropdown__item account-dropdown__item--danger"
            role="menuitem"
            disabled={isLoggingOut}
            onClick={handleLogout}
          >
            <LogoutOutlined />
            <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountDropdown
