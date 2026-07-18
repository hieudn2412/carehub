import { useEffect, useRef, useState } from 'react'
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
  FileSearchOutlined,
  ScheduleOutlined,
  TrophyOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DownloadOutlined,
  MailOutlined,
  UserOutlined,
  AppstoreOutlined,
  DownOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import { EVALUATION_PERMISSION, getCurrentEvaluationAccess } from '../../evaluation/utils/evaluationPermissions.js'
import logo from '../../../assets/logo.png'
import '../styles/AdminSidebar.css'

const navSections = [
  {
    label: 'TỔNG QUAN',
    items: [
      { icon: <DashboardOutlined />, label: 'Tổng quan', path: '/admin/dashboard' },
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
      { icon: <DatabaseOutlined />, label: 'Nhập dữ liệu', path: '/admin/reference/import' },
      { icon: <HistoryOutlined />, label: 'Lịch sử đồng bộ', path: '/admin/reference/sync-history' },
    ],
  },
  {
    label: 'ĐÀO TẠO',
    items: [
      { icon: <BookOutlined />, label: 'Giờ đào tạo nhân viên', path: '/training/employees' },
      { icon: <ScheduleOutlined />, label: 'Giờ đào tạo của tôi', path: '/staff/training' },
      { icon: <TrophyOutlined />, label: 'Năng lực của tôi', path: '/staff/competency' },
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
    ],
  },
  {
    label: 'ĐÁNH GIÁ',
    items: [
      {
        icon: <FileAddOutlined />,
        label: 'Tạo câu hỏi từ tài liệu',
        path: '/admin/evaluation/question-documents',
        requiredPermissions: [EVALUATION_PERMISSION.questionAuthor, EVALUATION_PERMISSION.questionReviewer],
      },
      {
        icon: <FileTextOutlined />,
        label: 'Ngân hàng câu hỏi',
        path: '/admin/evaluation/question-bank',
        requiredPermissions: [
          EVALUATION_PERMISSION.questionAuthor,
          EVALUATION_PERMISSION.questionReviewer,
          EVALUATION_PERMISSION.questionSetManager,
        ],
      },
      {
        icon: <BookOutlined />,
        label: 'Bộ câu hỏi',
        path: '/admin/evaluation/question-sets',
        requiredPermissions: [EVALUATION_PERMISSION.questionSetManager],
      },
      {
        icon: <DatabaseOutlined />,
        label: 'Danh mục bộ câu hỏi',
        path: '/admin/evaluation/question-set-categories',
        requiredPermissions: [EVALUATION_PERMISSION.questionSetManager],
      },
      {
        icon: <DatabaseOutlined />,
        label: 'Danh mục câu hỏi',
        path: '/admin/evaluation/categories',
        requiredPermissions: [EVALUATION_PERMISSION.questionAuthor],
      },
      {
        icon: <SlidersOutlined />,
        label: 'Cấu hình & Sinh đề',
        path: '/admin/evaluation/configs',
        requiredPermissions: [EVALUATION_PERMISSION.examConfigManager],
      },
      {
        icon: <FileSearchOutlined />,
        label: 'Đề kiểm tra',
        path: '/admin/evaluation/exam-papers',
        requiredPermissions: [EVALUATION_PERMISSION.examPublisher],
      },
      {
        icon: <ScheduleOutlined />,
        label: 'Giao bài kiểm tra',
        path: '/admin/evaluation/exam-assignments',
        requiredPermissions: [EVALUATION_PERMISSION.assignmentManager],
      },
      {
        icon: <TrophyOutlined />,
        label: 'Kết quả kiểm tra',
        path: '/admin/evaluation/exam-attempts',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
      {
        icon: <CalculatorOutlined />,
        label: 'Ngưỡng phân loại',
        path: '/admin/evaluation/competency-thresholds',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
      {
        icon: <BarChartOutlined />,
        label: 'Phân loại theo khoa',
        path: '/admin/evaluation/competency',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
      {
        icon: <BarChartOutlined />,
        label: 'Năng lực theo lĩnh vực',
        path: '/admin/evaluation/competency-by-field',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
      {
        icon: <CheckSquareOutlined />,
        label: 'Tuân thủ kỹ thuật',
        path: '/admin/evaluation/compliance-by-technique',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
      {
        icon: <TrophyOutlined />,
        label: 'Tổng hợp năng lực',
        path: '/admin/evaluation/competency-summary',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
      {
        icon: <AuditOutlined />,
        label: 'Mẫu prompt',
        path: '/admin/evaluation/prompt-templates',
        requiredPermissions: [EVALUATION_PERMISSION.questionAuthor],
      },
      {
        icon: <TeamOutlined />,
        label: 'Nhóm đào tạo',
        path: '/admin/evaluation/training-groups',
        requiredPermissions: [EVALUATION_PERMISSION.assignmentManager],
      },
    ],
  },
  {
    label: 'BÁO CÁO & THỐNG KÊ',
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
      {
        icon: <HistoryOutlined />,
        label: 'Audit đánh giá',
        path: '/admin/evaluation/audit-logs',
        requiredPermissions: [EVALUATION_PERMISSION.auditViewer],
      },
      {
        icon: <ImportOutlined />,
        label: 'Lịch sử import đánh giá',
        path: '/admin/evaluation/imports',
        requiredPermissions: [EVALUATION_PERMISSION.questionAuthor, EVALUATION_PERMISSION.questionReviewer],
      },
    ],
  },
  {
    label: 'THÔNG BÁO',
    items: [
      { icon: <SettingOutlined />, label: 'Cấu hình thông báo', path: '/admin/notifications/settings' },
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

const navGroups = [
  {
    id: 'management',
    label: 'Quản lý',
    icon: <AppstoreOutlined />,
    sections: navSections.slice(0, 7),
  },
  {
    id: 'system',
    label: 'Hệ thống',
    icon: <SettingOutlined />,
    sections: navSections.slice(7),
  },
]

function AdminSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const navRef = useRef(null)
  const evaluationAccess = getCurrentEvaluationAccess()

  const isLinkActive = (itemPath) => {
    if (itemPath === '/admin/dashboard') {
      return currentPath === itemPath
    }
    return currentPath === itemPath || currentPath.startsWith(itemPath)
  }

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => (
            !item.requiredPermissions || evaluationAccess.hasAny(item.requiredPermissions)
          )),
        }))
        .filter((section) => section.items.length > 0),
    }))
    .filter((group) => group.sections.length > 0)

  const activeNavigation = visibleGroups
    .flatMap((group) => group.sections.map((section) => ({ group, section })))
    .find(({ section }) => section.items.some((item) => isLinkActive(item.path)))

  const getSectionKey = (groupId, sectionLabel) => `${groupId}:${sectionLabel}`
  const [selectedGroupId, setSelectedGroupId] = useState(
    activeNavigation?.group.id || visibleGroups[0]?.id || 'management',
  )
  const [expandedSectionKey, setExpandedSectionKey] = useState(
    activeNavigation
      ? getSectionKey(activeNavigation.group.id, activeNavigation.section.label)
      : null,
  )

  const selectedGroup = visibleGroups.find((group) => group.id === selectedGroupId)
    || visibleGroups[0]

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

  const handleGroupSelect = (group) => {
    setSelectedGroupId(group.id)

    const activeSection = group.sections.find((section) => (
      section.items.some((item) => isLinkActive(item.path))
    ))
    const nextSection = activeSection || group.sections[0]
    setExpandedSectionKey(
      nextSection ? getSectionKey(group.id, nextSection.label) : null,
    )
  }

  const handleSectionToggle = (sectionKey) => {
    setExpandedSectionKey((currentKey) => (
      currentKey === sectionKey ? null : sectionKey
    ))
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__logo">
        <img className="admin-sidebar__logo-icon" src={logo} alt="Logo VietDuc Care" />
        <div>
          <p className="admin-sidebar__logo-name">VietDuc Care</p>
          <span className="admin-sidebar__logo-sub">Quản trị hệ thống</span>
        </div>
      </div>

      <nav ref={navRef} onScroll={handleScroll} className="admin-sidebar__nav">
        <div className="admin-sidebar__group-switch" role="tablist" aria-label="Nhóm điều hướng">
          {visibleGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={selectedGroup?.id === group.id}
              className={`admin-sidebar__group-button ${
                selectedGroup?.id === group.id ? 'admin-sidebar__group-button--active' : ''
              }`}
              onClick={() => handleGroupSelect(group)}
            >
              <span className="admin-sidebar__group-icon">{group.icon}</span>
              <span>{group.label}</span>
            </button>
          ))}
        </div>

        <div className="admin-sidebar__group-panel" role="tabpanel">
          {selectedGroup?.sections.map((section) => {
            const sectionKey = getSectionKey(selectedGroup.id, section.label)
            const isExpanded = expandedSectionKey === sectionKey
            const containsActiveItem = section.items.some((item) => isLinkActive(item.path))

            return (
              <div
                key={sectionKey}
                className={`admin-sidebar__section ${
                  containsActiveItem ? 'admin-sidebar__section--active' : ''
                }`}
              >
                <button
                  type="button"
                  className="admin-sidebar__section-trigger"
                  aria-expanded={isExpanded}
                  onClick={() => handleSectionToggle(sectionKey)}
                >
                  <span>{section.label}</span>
                  <DownOutlined className="admin-sidebar__section-chevron" />
                </button>

                <div className={`admin-sidebar__section-items ${
                  isExpanded ? 'admin-sidebar__section-items--open' : ''
                }`}>
                  <div className="admin-sidebar__section-items-inner">
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
                </div>
              </div>
            )
          })}
        </div>
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
