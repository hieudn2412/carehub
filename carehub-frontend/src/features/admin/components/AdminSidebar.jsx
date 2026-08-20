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
  CalculatorOutlined,
  FileSearchOutlined,
  ScheduleOutlined,
  BarChartOutlined,
  LineChartOutlined,
  MailOutlined,
  UserOutlined,
  AppstoreOutlined,
  DownOutlined,
  LeftOutlined,
  SearchOutlined,
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
      { icon: <BankOutlined />, label: 'Danh mục phòng ban', path: '/admin/reference/departments' },
      { icon: <HistoryOutlined />, label: 'Lịch sử đồng bộ', path: '/admin/reference/sync-history' },
    ],
  },
  {
    label: 'ĐÀO TẠO LIÊN TỤC',
    items: [
      { icon: <BookOutlined />, label: 'Đào tạo liên tục', path: '/training/employees' },
      { icon: <ScheduleOutlined />, label: 'Cập nhật giờ đào tạo', path: '/staff/training' },
      { icon: <SlidersOutlined />, label: 'Hình thức đào tạo', path: '/admin/training/activity-types' },
      { icon: <DatabaseOutlined />, label: 'Lĩnh vực chuyên môn', path: '/admin/training/professional-fields' },
    ],
  },
  {
    label: 'GIÁM SÁT TUÂN THỦ',
    items: [
      { icon: <CheckSquareOutlined />, label: 'Bảng kiểm giám sát', path: '/admin/quality/checklists' },
      { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/admin/quality/history' },
      { icon: <CalculatorOutlined />, label: 'Công thức chỉ số', path: '/admin/quality/formulas' },
    ],
  },
  {
    label: 'QUẢN LÝ BÀI KIỂM TRA',
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
        ],
      },
      {
        icon: <DatabaseOutlined />,
        label: 'Danh mục câu hỏi',
        path: '/admin/evaluation/categories',
        requiredPermissions: [EVALUATION_PERMISSION.questionAuthor],
      },
      {
        icon: <FileSearchOutlined />,
        label: 'Quản lý bài kiểm tra',
        path: '/admin/evaluation/exam-management',
        requiredPermissions: [
          EVALUATION_PERMISSION.examConfigManager,
          EVALUATION_PERMISSION.examPublisher,
          EVALUATION_PERMISSION.assignmentManager,
        ],
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
    ],
  },
  {
    label: 'DASHBOARD & BÁO CÁO THỐNG KÊ',
    items: [
      { icon: <BarChartOutlined />, label: 'Đào tạo liên tục', path: '/admin/reports/training-dashboard' },
      { icon: <LineChartOutlined />, label: 'Năng lực chuyên môn', path: '/admin/reports/quality-dashboard' },
      { icon: <CheckSquareOutlined />, label: 'Giám sát tuân thủ', path: '/admin/reports/checklist-dashboard' },
      { icon: <CheckSquareOutlined />, label: 'Tuân thủ chung', path: '/admin/evaluation/compliance-by-technique' },
      {
        icon: <BarChartOutlined />,
        label: 'Chất lượng chăm sóc',
        path: '/admin/reports/competency-dashboard',
        requiredPermissions: [EVALUATION_PERMISSION.resultViewer],
      },
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

function normalizeSearchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

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
    return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
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
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobileClosing, setIsMobileClosing] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [pendingRoute, setPendingRoute] = useState(null)

  const selectedGroup = visibleGroups.find((group) => group.id === selectedGroupId)
    || visibleGroups[0]

  // Restore scroll position
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('admin-sidebar-scroll')
    if (savedScroll && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScroll, 10)
    }
  }, [])

  useEffect(() => {
    const handleMenuToggle = () => {
      if (isMobileClosing) return

      if (isMobileOpen) {
        setIsMobileClosing(true)
        setIsMobileOpen(false)
        return
      }

      setPendingRoute(null)
      setIsMobileOpen(true)
    }
    window.addEventListener('admin-sidebar-toggle', handleMenuToggle)
    return () => window.removeEventListener('admin-sidebar-toggle', handleMenuToggle)
  }, [isMobileClosing, isMobileOpen])

  useEffect(() => {
    if (!isMobileOpen && !isMobileClosing) return undefined

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || isMobileClosing) return
      setPendingRoute(null)
      setIsMobileClosing(true)
      setIsMobileOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    document.body.classList.add('admin-sidebar-open')
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.classList.remove('admin-sidebar-open')
    }
  }, [isMobileClosing, isMobileOpen])

  const handleScroll = (e) => {
    sessionStorage.setItem('admin-sidebar-scroll', String(e.target.scrollTop))
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
      navigate(AUTH_ROUTES.login, { replace: true })
    } catch (error) {
      window.alert(error?.message || 'Không thể đăng xuất. Vui lòng thử lại.')
    }
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

  const closeAdminMobileMenu = (route = null) => {
    if (!isMobileOpen || isMobileClosing) return
    setPendingRoute(route)
    setIsMobileClosing(true)
    setIsMobileOpen(false)
  }

  const handleSidebarTransitionEnd = (event) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'transform' ||
      isMobileOpen ||
      !isMobileClosing
    ) {
      return
    }

    const route = pendingRoute
    setSearchKeyword('')
    setPendingRoute(null)
    setIsMobileClosing(false)

    if (route && route !== currentPath) {
      navigate(route)
    }
  }

  const normalizedSearchKeyword = normalizeSearchText(searchKeyword.trim())
  const isSearching = normalizedSearchKeyword.length > 0
  const filteredMobileItems = (selectedGroup?.sections || [])
    .flatMap((section) => section.items)
    .filter((item) => (
      normalizeSearchText(item.label).includes(normalizedSearchKeyword)
    ))

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="admin-sidebar__backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => closeAdminMobileMenu()}
        />
      )}
      <aside
        className={`admin-sidebar ${isMobileOpen ? 'admin-sidebar--mobile-open' : ''}`}
        aria-label="Điều hướng quản trị"
        onTransitionEnd={handleSidebarTransitionEnd}
      >
      <div className="admin-mobile-menu" aria-hidden={!isMobileOpen}>
        <div className="admin-mobile-menu__topbar">
          <button
            type="button"
            className="admin-mobile-menu__back"
            aria-label="Quay lại nội dung trang"
            tabIndex={isMobileOpen ? 0 : -1}
            onClick={() => closeAdminMobileMenu()}
          >
            <LeftOutlined />
          </button>
          <div className="admin-mobile-menu__brand">
            <img src={logo} alt="" aria-hidden="true" />
            <span>VietDuc Care</span>
          </div>
        </div>

        <label className="admin-mobile-menu__search">
          <SearchOutlined aria-hidden="true" />
          <input
            type="search"
            value={searchKeyword}
            placeholder="Tìm chức năng..."
            aria-label="Tìm chức năng quản trị"
            tabIndex={isMobileOpen ? 0 : -1}
            onChange={(event) => setSearchKeyword(event.target.value)}
          />
        </label>

        <div className="admin-mobile-menu__group-switch" role="tablist" aria-label="Phân loại sidebar">
          {visibleGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={selectedGroup?.id === group.id}
              tabIndex={isMobileOpen ? 0 : -1}
              className={`admin-mobile-menu__group-button${
                selectedGroup?.id === group.id ? ' admin-mobile-menu__group-button--active' : ''
              }`}
              onClick={() => {
                handleGroupSelect(group)
                setSearchKeyword('')
              }}
            >
              {group.icon}
              <span>{group.label}</span>
            </button>
          ))}
        </div>

        <nav className="admin-mobile-menu__content" aria-label="Chức năng quản trị">
          {!isSearching && selectedGroup?.sections.map((section) => (
            <section key={section.label} className="admin-mobile-menu__section">
              <h2>{section.label}</h2>
              <div className="admin-mobile-menu__grid">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    tabIndex={isMobileOpen ? 0 : -1}
                    className={`admin-mobile-menu__item${
                      isLinkActive(item.path) ? ' admin-mobile-menu__item--active' : ''
                    }`}
                    onClick={(event) => {
                      event.preventDefault()
                      closeAdminMobileMenu(item.path)
                    }}
                  >
                    <span className="admin-mobile-menu__item-icon" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}

          {isSearching && filteredMobileItems.length > 0 && (
            <section className="admin-mobile-menu__section" aria-label="Kết quả tìm kiếm">
              <div className="admin-mobile-menu__grid">
                {filteredMobileItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    tabIndex={isMobileOpen ? 0 : -1}
                    className={`admin-mobile-menu__item${
                      isLinkActive(item.path) ? ' admin-mobile-menu__item--active' : ''
                    }`}
                    onClick={(event) => {
                      event.preventDefault()
                      closeAdminMobileMenu(item.path)
                    }}
                  >
                    <span className="admin-mobile-menu__item-icon" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          )}

          {isSearching && filteredMobileItems.length === 0 && (
            <div className="admin-mobile-menu__empty" role="status">
              Không tìm thấy chức năng phù hợp
            </div>
          )}
        </nav>

        <button
          type="button"
          className="admin-mobile-menu__logout"
          tabIndex={isMobileOpen ? 0 : -1}
          onClick={handleLogout}
        >
          <LogoutOutlined />
          Đăng xuất
        </button>
      </div>

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
                        onClick={() => setIsMobileOpen(false)}
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
        <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
          <LogoutOutlined />
          <span>Đăng xuất</span>
        </button>
      </div>
      </aside>
    </>
  )
}

export default AdminSidebar
