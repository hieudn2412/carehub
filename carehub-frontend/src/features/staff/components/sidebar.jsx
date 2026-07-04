import { NavLink, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  EditOutlined,
  HistoryOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import logo from '../../../assets/logo.png'
import '../styles/StaffDashBoardScreen.css'

const navSections = [
  {
    label: 'Trang chủ',
    items: [
      { icon: <DashboardOutlined />, label: 'Dashboard', path: '/staff/dashboard' },
    ],
  },
  {
    label: 'Đào tạo',
    items: [
      { icon: <ClockCircleOutlined />, label: 'Giờ đào tạo', path: '/staff/training' },
      { icon: <BarChartOutlined />, label: 'Trạng thái đào tạo', path: '/staff/training-status' },
    ],
  },
  {
    label: 'Kiểm tra',
    items: [
      { icon: <EditOutlined />, label: 'Làm bài thi', path: '/staff/exam/take' },
      { icon: <HistoryOutlined />, label: 'Lịch sử thi', path: '/staff/exam/history' },
    ],
  },
  {
    label: 'Tài khoản',
    items: [
      { icon: <BellOutlined />, label: 'Thông báo', path: '/staff/notifications' },
      { icon: <UserOutlined />, label: 'Hồ sơ cá nhân', path: '/staff/profile' },
    ],
  },
]

function Sidebar() {
  const navigate = useNavigate()

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
          <span className="sidebar__logo-sub">Quản trị hệ thống</span>
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
