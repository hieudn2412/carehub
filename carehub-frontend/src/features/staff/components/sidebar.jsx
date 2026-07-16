import { NavLink, useNavigate } from 'react-router-dom'
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
  FileDoneOutlined
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

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])
  const isManager = hasAnyRole(roles, [AUTH_ROLE.manager])

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
        { icon: <TeamOutlined />, label: 'Nhân sự trong khoa', path: '/manager/employees' },
        { icon: <ClockCircleOutlined />, label: 'Giờ đào tạo nhân sự', path: '/training/employees' },
        { icon: <FileDoneOutlined />, label: 'Kết quả thi nhân sự', path: '/manager/exam-results' },
        { icon: <CheckSquareOutlined />, label: 'Bảng kiểm chất lượng', path: '/manager/quality/checklists' },
        { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/manager/quality/history' },
        { icon: <BarChartOutlined />, label: 'Năng lực theo lĩnh vực', path: '/manager/competency-by-field' },
      ],
    })
  }

  // Personal/Staff features
  navSections.push(
    {
      label: 'Năng lực của tôi',
      items: [
        { icon: <TrophyOutlined />, label: 'Năng lực', path: '/staff/competency' },
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

      <nav className="sidebar__nav">
        {navSections.map((section) => (
          <div key={section.label} className="sidebar__section">
            <p className="sidebar__section-label">{section.label}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`
                }
              >
                <span className="sidebar__item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
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
