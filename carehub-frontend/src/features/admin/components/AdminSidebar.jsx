import { useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
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
  LogoutOutlined,
  HistoryOutlined,
  BookOutlined,
  AuditOutlined,
  FolderOutlined,
  CarryOutOutlined,
  ApartmentOutlined,
  CalculatorOutlined,
  AimOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import logo from '../../../assets/logo.png'
import '../styles/AdminSidebar.css'

const navSections = [
  {
    label: 'TÀI KHOẢN',
    items: [
      { icon: <TeamOutlined />, label: 'Quản lý tài khoản', path: '/admin/accounts' },
    ],
  },
  {
    label: 'DỮ LIỆU THAM CHIẾU',
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
      { icon: <AuditOutlined />, label: 'Yêu cầu', path: '/admin/training/requirements' },
      { icon: <SlidersOutlined />, label: 'Các hình thức đào tạo', path: '/admin/training/activity-types' },
    ],
  },
  {
    label: 'ĐÁNH GIÁ',
    items: [
      { icon: <OrderedListOutlined />, label: 'Danh mục câu hỏi', path: '/admin/evaluation/categories' },
      { icon: <CarryOutOutlined />, label: 'Bộ câu hỏi', path: '/admin/evaluation/question-sets' },
      { icon: <FolderOutlined />, label: 'Ngân hàng câu hỏi', path: '/admin/evaluation/question-bank' },
      { icon: <CheckSquareOutlined />, label: 'Quy tắc phân loại', path: '/admin/evaluation/classification-rules' },
      { icon: <SlidersOutlined />, label: 'Cấu hình bài kiểm tra', path: '/admin/evaluation/configs' },
    ],
  },
  {
    label: 'CHẤT LƯỢNG',
    items: [
      { icon: <CheckSquareOutlined />, label: 'Danh sách checklist', path: '/admin/quality/checklists' },
      { icon: <CarryOutOutlined />, label: 'Checklist được giao', path: '/admin/quality/assigned' },
      { icon: <ApartmentOutlined />, label: 'Biểu mẫu chất lượng', path: '/admin/quality/templates' },
      { icon: <CalculatorOutlined />, label: 'Công thức chỉ số', path: '/admin/quality/formulas' },
      { icon: <AimOutlined />, label: 'Mục tiêu chất lượng', path: '/admin/quality/targets' },
      { icon: <TrophyOutlined />, label: 'Cài đặt thang điểm', path: '/admin/quality/scoring' },
      { icon: <ImportOutlined />, label: 'Import Google Form', path: '/admin/form-imports' },
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
