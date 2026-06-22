import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  ImportOutlined,
  IdcardOutlined,
  BankOutlined,
  DatabaseOutlined,
  CheckSquareOutlined,
  OrderedListOutlined,
  SlidersOutlined,
  BellOutlined,
  MailOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import logo from '../../../assets/logo.png'
import '../styles/AdminSidebar.css'

const navSections = [
  {
    label: 'TỔNG QUAN',
    items: [
      { icon: <DashboardOutlined />, label: 'Dashboard', path: '/admin/dashboard' },
    ],
  },
  {
    label: 'TÀI KHOẢN',
    items: [
      { icon: <TeamOutlined />, label: 'Quản lý tài khoản', path: '/admin/accounts' },
    ],
  },
  {
    label: 'HỆ THỐNG',
    items: [
      { icon: <FileTextOutlined />, label: 'System logs', path: '/admin/system-logs' },
      { icon: <SettingOutlined />, label: 'Cấu hình hệ thống', path: '/admin/system-settings' },
      { icon: <ImportOutlined />, label: 'Import logs', path: '/admin/system/import-logs' },
    ],
  },
  {
    label: 'DỮ LIỆU THAM CHIẾU',
    items: [
      { icon: <IdcardOutlined />, label: 'Danh sách nhân viên gốc', path: '/admin/reference/employees' },
      { icon: <BankOutlined />, label: 'Danh mục phòng ban gốc', path: '/admin/reference/departments' },
      { icon: <DatabaseOutlined />, label: 'Import data', path: '/admin/reference/import' },
    ],
  },
  {
    label: 'CHẤT LƯỢNG',
    items: [
      { icon: <CheckSquareOutlined />, label: 'Quản lý checklist', path: '/admin/quality/checklists' },
      { icon: <OrderedListOutlined />, label: 'Checklist được giao', path: '/admin/quality/assigned' },
      { icon: <SlidersOutlined />, label: 'Cài đặt thang điểm', path: '/admin/quality/scoring' },
      { icon: <ImportOutlined />, label: 'Import Google Form', path: '/admin/form-imports' },
    ],
  },

  {
    label: 'THÔNG BÁO',
    items: [
      { icon: <BellOutlined />, label: 'Cấu hình thông báo', path: '/admin/notifications/settings' },
      { icon: <MailOutlined />, label: 'Email templates', path: '/admin/notifications/email-templates' },
    ],
  },
]

function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname

  const handleLogout = async () => {
    await logoutUser()
    navigate(AUTH_ROUTES.login, { replace: true })
  }

  const isLinkActive = (itemPath) => {
    if (itemPath === '/admin/dashboard') {
      return currentPath === itemPath
    }
    return currentPath === itemPath || currentPath.startsWith(itemPath)
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__logo">
        <img className="admin-sidebar__logo-icon" src={logo} alt="VietDuc Care Logo" />
        <div>
          <p className="admin-sidebar__logo-name">VietDuc Care</p>
          <span className="admin-sidebar__logo-sub">Quản trị hệ thống</span>
        </div>
      </div>

      <nav className="admin-sidebar__nav">
        {navSections.map((section) => (
          <div key={section.label} className="admin-sidebar__section">
            <p className="admin-sidebar__section-label">{section.label}</p>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={() =>
                  `admin-sidebar__item ${isLinkActive(item.path) ? 'admin-sidebar__item--active' : ''}`
                }
              >
                <span className="admin-sidebar__item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <button className="admin-sidebar__logout" onClick={handleLogout}>
          <LogoutOutlined />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}

export default AdminSidebar
