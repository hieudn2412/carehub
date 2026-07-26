import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  TrophyOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  FileDoneOutlined,
  DownOutlined
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import {
  AUTH_ROLE,
  hasAnyRole,
} from '../../auth/utils/authNavigation.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import logo from '../../../assets/logo.png'
import AdminSidebar from '../../admin/components/AdminSidebar'
import '../styles/StaffDashBoardScreen.css'

/* TODO(ui-refactor): component này đang là "facade" sidebar duy nhất của app
   (AppShell dùng nó; khi user là admin nó render AdminSidebar). Bước hợp nhất
   vật lý AdminSidebar + Sidebar thành một AppSidebar nhận config menu theo
   role vẫn còn nợ — làm khi có điều kiện test đủ 3 role trên trình duyệt. */
function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const navRef = useRef(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])
  const isManager = hasAnyRole(roles, [AUTH_ROLE.manager])

  const isLinkActive = (itemPath) => {
    if (
      itemPath === '/admin/dashboard' ||
      itemPath === '/manager/dashboard' ||
      itemPath === '/staff/dashboard'
    ) {
      return currentPath === itemPath
    }
    return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
  }

  // Base items for all staff members
  const navSections = [
    {
      label: 'Trang chủ',
      items: [
        { icon: <DashboardOutlined />, label: 'Dashboard', path: isAdmin ? '/admin/dashboard' : isManager ? '/manager/dashboard' : '/staff/dashboard' },
      ],
    },
    {
      label: 'Theo dõi cá nhân',
      items: [
        { icon: <ClockCircleOutlined />, label: 'Giờ đào tạo liên tục', path: '/staff/training' },
        { icon: <CheckSquareOutlined />, label: 'Tuân thủ quy trình, quy định', path: '/staff/competency' },
        { icon: <TrophyOutlined />, label: 'Năng lực chuyên môn', path: '/staff/professional-competency' },
      ],
    },
  ]

  // Manager specific features
  if (isManager) {
    navSections.push({
      label: 'Quản lý khoa',
      items: [
        { icon: <BarChartOutlined />, label: 'Dashboard giờ đào tạo', path: '/manager/reports/training-dashboard' },
        { icon: <TrophyOutlined />, label: 'Dashboard năng lực chuyên môn', path: '/manager/reports/quality-dashboard' },
        { icon: <CheckSquareOutlined />, label: 'Chất lượng chăm sóc', path: '/manager/reports/checklist-dashboard' },
        { icon: <CheckSquareOutlined />, label: 'Tuân thủ quy trình, quy định', path: '/manager/compliance-by-technique' },
        { icon: <BarChartOutlined />, label: 'Dashboard năng lực', path: '/manager/competency-summary' },
        { icon: <TeamOutlined />, label: 'Nhân sự & Giờ đào tạo', path: '/manager/employees' },
        { icon: <FileDoneOutlined />, label: 'Kết quả năng lực chuyên môn', path: '/manager/exam-results' },
        { icon: <CheckSquareOutlined />, label: 'Thực hiện đánh giá', path: '/manager/quality/checklists' },
        { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/manager/quality/history' },
      ],
    })
  }

  navSections.push(
    {
      label: 'Tài khoản',
      items: [
        { icon: <UserOutlined />, label: 'Hồ sơ cá nhân', path: '/staff/profile' },
      ],
    }
  )

  const activeSection = navSections.find((section) =>
    section.items.some((item) => isLinkActive(item.path))
  )

  const [expandedSectionLabel, setExpandedSectionLabel] = useState(
    activeSection ? activeSection.label : null
  )

  // Restore scroll position
  useEffect(() => {
    if (isAdmin) return
    const savedScroll = sessionStorage.getItem('staff-sidebar-scroll')
    if (savedScroll && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScroll, 10)
    }
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin) return undefined

    const handleMenuToggle = () => setIsMobileOpen((current) => !current)
    window.addEventListener('staff-sidebar-toggle', handleMenuToggle)
    return () => window.removeEventListener('staff-sidebar-toggle', handleMenuToggle)
  }, [isAdmin])

  useEffect(() => {
    if (isAdmin || !isMobileOpen) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsMobileOpen(false)
    }
    document.body.classList.add('staff-sidebar-open')
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.classList.remove('staff-sidebar-open')
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isAdmin, isMobileOpen])

  if (isAdmin) {
    return <AdminSidebar />
  }

  const handleScroll = (e) => {
    sessionStorage.setItem('staff-sidebar-scroll', String(e.target.scrollTop))
  }

  const handleSectionToggle = (sectionLabel) => {
    setExpandedSectionLabel((currentLabel) =>
      currentLabel === sectionLabel ? null : sectionLabel
    )
  }

  const handleLogout = async () => {
    await logoutUser()
    navigate(AUTH_ROUTES.login, { replace: true })
  }

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="sidebar__backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${isMobileOpen ? 'sidebar--mobile-open' : ''}`}
        aria-label="Điều hướng chính"
      >
        <div className="sidebar__logo">
          <img className="sidebar__logo-icon" src={logo} alt="VietDuc Care Logo" />
          <div>
            <p className="sidebar__logo-name">VietDuc Care</p>
            <span className="sidebar__logo-sub">
              {isManager ? 'Trưởng khoa / Phòng' : 'Nhân viên y tế'}
            </span>
          </div>
        </div>

        <nav ref={navRef} onScroll={handleScroll} className="sidebar__nav">
          {navSections.map((section) => {
            const isExpanded = expandedSectionLabel === section.label
            const containsActiveItem = section.items.some((item) => isLinkActive(item.path))

            return (
              <div
                key={section.label}
                className={`sidebar__section ${
                  containsActiveItem ? 'sidebar__section--active' : ''
                }`}
              >
                <button
                  type="button"
                  className="sidebar__section-trigger"
                  aria-expanded={isExpanded}
                  onClick={() => handleSectionToggle(section.label)}
                >
                  <span>{section.label}</span>
                  <DownOutlined className="sidebar__section-chevron" />
                </button>

                <div
                  className={`sidebar__section-items ${
                    isExpanded ? 'sidebar__section-items--open' : ''
                  }`}
                >
                  <div className="sidebar__section-items-inner">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={() =>
                          `sidebar__item ${isLinkActive(item.path) ? 'sidebar__item--active' : ''}`
                        }
                        onClick={() => setIsMobileOpen(false)}
                      >
                        <span className="sidebar__item-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__logout" onClick={handleLogout}>
            <LogoutOutlined />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
