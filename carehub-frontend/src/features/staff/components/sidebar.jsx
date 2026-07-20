import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  TrophyOutlined,
  EditOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  DownOutlined
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import { AUTH_ROLE, hasAnyRole } from '../../auth/utils/authNavigation.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import logo from '../../../assets/logo.png'
import '../styles/StaffDashBoardScreen.css'

function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const navRef = useRef(null)

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
    return currentPath === itemPath || currentPath.startsWith(itemPath)
  }

  // Base items for all staff members
  const navSections = [
    {
      label: 'Trang chủ',
      items: [
        { icon: <DashboardOutlined />, label: 'Dashboard', path: isAdmin ? '/admin/dashboard' : isManager ? '/manager/dashboard' : '/staff/dashboard' },
      ],
    },
  ]

  // Manager specific features
  if (isManager) {
    navSections.push({
      label: 'Quản lý khoa',
      items: [
        { icon: <BarChartOutlined />, label: 'Dashboard giờ đào tạo', path: '/manager/reports/training-dashboard' },
        { icon: <TrophyOutlined />, label: 'Dashboard tuân thủ', path: '/manager/reports/quality-dashboard' },
        { icon: <CheckSquareOutlined />, label: 'Dashboard bảng kiểm', path: '/manager/reports/checklist-dashboard' },
        { icon: <FileDoneOutlined />, label: 'Dashboard bài kiểm tra', path: '/manager/reports/exam-dashboard' },
        { icon: <TeamOutlined />, label: 'Nhân sự & Giờ đào tạo', path: '/manager/employees' },
        { icon: <FileDoneOutlined />, label: 'Kết quả thi nhân sự', path: '/manager/exam-results' },
        { icon: <CheckSquareOutlined />, label: 'Bảng kiểm chất lượng', path: '/manager/quality/checklists' },
        { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/manager/quality/history' },
        { icon: <BarChartOutlined />, label: 'Năng lực theo lĩnh vực', path: '/manager/competency-by-field' },
        { icon: <CheckSquareOutlined />, label: 'Tuân thủ kỹ thuật', path: '/manager/compliance-by-technique' },
        { icon: <TrophyOutlined />, label: 'Tổng hợp năng lực', path: '/manager/competency-summary' },
      ],
    })
  }

  // Personal/Staff features
  navSections.push(
    {
      label: 'ĐÁNH GIÁ',
      items: [
        { icon: <FileTextOutlined />, label: 'Tạo câu hỏi từ tài liệu', path: '/staff/generate-questions' },
      ],
    },
    {
      label: 'Năng lực của tôi',
      items: [
        { icon: <TrophyOutlined />, label: 'Năng lực của tôi', path: '/staff/competency' },
      ],
    },
    {
      label: 'Đào tạo của tôi',
      items: [
        { icon: <ClockCircleOutlined />, label: 'Giờ đào tạo', path: '/staff/training' },
        { icon: <BarChartOutlined />, label: 'Trạng thái đào tạo', path: '/staff/training-status' },
      ],
    }
  )

  // Admin không cần Kiểm tra và Phiếu kiểm tra
  if (!isAdmin) {
    navSections.push(
      {
        label: 'Kiểm tra',
        items: [
          { icon: <EditOutlined />, label: 'Làm bài thi', path: '/staff/exam/take' },
          { icon: <HistoryOutlined />, label: 'Lịch sử thi', path: '/staff/exam/history' },
        ],
      },
      {
        label: 'Phiếu kiểm tra',
        items: [
          { icon: <CheckSquareOutlined />, label: 'Phiếu được giao', path: '/staff/checklists' },
        ],
      }
    )
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
    const savedScroll = sessionStorage.getItem('staff-sidebar-scroll')
    if (savedScroll && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScroll, 10)
    }
  }, [])

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
    <aside className="sidebar">
      <div className="sidebar__logo">
        <img className="sidebar__logo-icon" src={logo} alt="VietDuc Care Logo" />
        <div>
          <p className="sidebar__logo-name">VietDuc Care</p>
          <span className="sidebar__logo-sub">
            {isAdmin ? 'Quản trị viên' : isManager ? 'Trưởng khoa / Phòng' : 'Nhân viên y tế'}
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
  )
}

export default Sidebar
