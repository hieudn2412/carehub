import { useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  FileAddOutlined,
  SettingOutlined,
  ImportOutlined,
  BankOutlined,
  DatabaseOutlined,
  CheckSquareOutlined,
  SlidersOutlined,
  LogoutOutlined,
  HistoryOutlined,
  BookOutlined,
  AuditOutlined,
  CalculatorOutlined,
  AimOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DownloadOutlined,
  BellOutlined,
  MailOutlined,
  UserOutlined,
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
      { icon: <TeamOutlined />, label: 'Danh sách tài khoản', path: '/admin/accounts' },
    ],
  },
  {
    label: 'DỮ LIỆU NỀN',
    items: [
      { icon: <TeamOutlined />, label: 'Danh sách nhân viên gốc', path: '/admin/reference/employees' },
      { icon: <BankOutlined />, label: 'Danh mục phòng ban gốc', path: '/admin/reference/departments' },
      { icon: <DatabaseOutlined />, label: 'Import data', path: '/admin/reference/import' },
      { icon: <HistoryOutlined />, label: 'Lịch sử đồng bộ', path: '/admin/reference/sync-history' },
    ],
  },
  {
    label: 'ĐÀO TẠO',
    items: [
      { icon: <BookOutlined />, label: 'Giờ đào tạo nhân viên', path: '/training/employees' },
      { icon: <FileSearchOutlined />, label: 'Duyệt minh chứng', path: '/admin/training/evidence-review' },
      { icon: <AuditOutlined />, label: 'Cấu hình yêu cầu', path: '/admin/training/requirements' },
      { icon: <SlidersOutlined />, label: 'Loại hoạt động đào tạo', path: '/admin/training/activity-types' },
    ],
  },
  {
    label: 'CHẤT LƯỢNG',
    items: [
      { icon: <CheckSquareOutlined />, label: 'Bảng kiểm', path: '/admin/quality/checklists' },
      { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/admin/quality/history' },
      { icon: <CalculatorOutlined />, label: 'Công thức chỉ số', path: '/admin/quality/formulas' },
      { icon: <AimOutlined />, label: 'Mục tiêu chất lượng', path: '/admin/quality/targets' },
    ],
  },
  {
    label: 'ĐÁNH GIÁ',
    items: [
      { icon: <FileAddOutlined />, label: 'Tạo câu hỏi từ tài liệu', path: '/admin/evaluation/question-documents' },
      { icon: <FileTextOutlined />, label: 'Ngân hàng câu hỏi', path: '/admin/evaluation/question-bank' },
      { icon: <BookOutlined />, label: 'Bộ câu hỏi', path: '/admin/evaluation/question-sets' },
      { icon: <DatabaseOutlined />, label: 'Danh mục câu hỏi', path: '/admin/evaluation/categories' },
      { icon: <AuditOutlined />, label: 'Quy tắc phân loại', path: '/admin/evaluation/classification-rules' },
      { icon: <SlidersOutlined />, label: 'Cấu hình đề kiểm tra', path: '/admin/evaluation/configs' },
    ],
  },
  {
    label: 'DASHBOARD & BÁO CÁO',
    items: [
      { icon: <BarChartOutlined />, label: 'Dashboard đào tạo', path: '/admin/reports/training-dashboard' },
      { icon: <LineChartOutlined />, label: 'Dashboard chất lượng', path: '/admin/reports/quality-dashboard' },
      { icon: <DownloadOutlined />, label: 'Xuất báo cáo đào tạo', path: '/admin/reports/export-training' },
      { icon: <DownloadOutlined />, label: 'Xuất báo cáo chất lượng', path: '/admin/reports/export-quality' },
    ],
  },
  {
    label: 'HỆ THỐNG',
    items: [
      { icon: <SettingOutlined />, label: 'Cấu hình hệ thống', path: '/admin/system-settings' },
      { icon: <FileTextOutlined />, label: 'System logs', path: '/admin/system-logs' },
      { icon: <ImportOutlined />, label: 'Import logs', path: '/admin/system/import-logs' },
    ],
  },
  {
    label: 'THÔNG BÁO',
    items: [
      { icon: <BellOutlined />, label: 'Cấu hình thông báo', path: '/admin/notifications/settings' },
      { icon: <MailOutlined />, label: 'Mẫu email', path: '/admin/notifications/email-templates' },
    ],
  },
  {
    label: 'TÀI KHOẢN TÔI',
    items: [
      { icon: <UserOutlined />, label: 'Hồ sơ cá nhân', path: '/admin/profile' },
    ],
  },
]

function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const navRef = useRef(null)

  // Restore scroll position
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('admin-sidebar-scroll')
    if (savedScroll && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScroll, 10)
    }
  }, [])

  const handleScroll = (e) => {
    sessionStorage.setItem('admin-sidebar-scroll', String(e.target.scrollTop))
  }

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

      <nav ref={navRef} onScroll={handleScroll} className="admin-sidebar__nav">
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
