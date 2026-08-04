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
  DownOutlined,
  LeftOutlined,
  SearchOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'
import {
  AUTH_ROLE,
  hasAnyRole,
} from '../../auth/utils/authNavigation.js'
import { getRolesFromAccessToken } from '../../auth/utils/jwt.js'
import { staffApi } from '../api/staffApi.js'
import logo from '../../../assets/logo.png'
import AdminSidebar from '../../admin/components/AdminSidebar'
import '../styles/StaffDashBoardScreen.css'

function normalizeSearchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

/* TODO(ui-refactor): component này đang là "facade" sidebar duy nhất của app
   (AppShell dùng nó; khi user là admin nó render AdminSidebar). Bước hợp nhất
   vật lý AdminSidebar + Sidebar thành một AppSidebar nhận config menu theo
   role vẫn còn nợ — làm khi có điều kiện test đủ 3 role trên trình duyệt. */
function Sidebar({ alertSummary = {} }) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const navRef = useRef(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobileClosing, setIsMobileClosing] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [pendingRoute, setPendingRoute] = useState(null)

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])
  const isManager = hasAnyRole(roles, [AUTH_ROLE.manager])
  const [assignedChecklistAccess, setAssignedChecklistAccess] = useState({
    accessToken: null,
    hasAssignment: false,
  })
  const hasAssignedChecklist = assignedChecklistAccess.accessToken === accessToken
    && assignedChecklistAccess.hasAssignment
  const unreadCount = Number(alertSummary.unreadCount) || 0
  const pendingExamCount = Number(alertSummary.pendingExamCount) || 0

  useEffect(() => {
    let active = true

    if (isAdmin || isManager) {
      return () => {
        active = false
      }
    }

    staffApi.getAssignedForms({ page: 0, size: 1, sort: 'id,desc' })
      .then((response) => {
        if (!active) {
          return
        }

        const page = response.data?.data
        const content = Array.isArray(page?.content) ? page.content : []
        const totalElements = Number(page?.totalElements)

        setAssignedChecklistAccess({
          accessToken,
          hasAssignment: Number.isFinite(totalElements) ? totalElements > 0 : content.length > 0,
        })
      })
      .catch(() => {
        if (active) {
          setAssignedChecklistAccess({ accessToken, hasAssignment: false })
        }
      })

    return () => {
      active = false
    }
  }, [isAdmin, isManager, accessToken])

  const isLinkActive = (itemPath) => {
    if (itemPath === '/staff/professional-competency') {
      return currentPath.startsWith('/staff/professional-competency')
        || currentPath.startsWith('/staff/exam/take')
    }
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
        ...(!isManager ? [
          { icon: <BarChartOutlined />, label: 'Chất lượng chăm sóc', path: '/staff/reports/checklist-dashboard' },
        ] : []),
        ...(!isManager && hasAssignedChecklist ? [
          { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/staff/quality/history' },
        ] : []),
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
    window.addEventListener('staff-sidebar-toggle', handleMenuToggle)
    return () => window.removeEventListener('staff-sidebar-toggle', handleMenuToggle)
  }, [isAdmin, isMobileClosing, isMobileOpen])

  useEffect(() => {
    if (isAdmin || (!isMobileOpen && !isMobileClosing)) return undefined

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || isMobileClosing) return

      setPendingRoute(null)
      setIsMobileClosing(true)
      setIsMobileOpen(false)
    }
    document.body.classList.add('staff-sidebar-open')
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.classList.remove('staff-sidebar-open')
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isAdmin, isMobileClosing, isMobileOpen])

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

  const closeStaffMobileMenu = (route = null) => {
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

  const examMenuItem = {
    icon: <FileDoneOutlined />,
    label: 'Năng lực chuyên môn',
    route: '/staff/professional-competency',
    alertCount: pendingExamCount,
  }
  const notificationMenuItem = {
    icon: <BellOutlined />,
    label: 'Thông báo',
    route: '/staff/notifications',
    alertCount: unreadCount,
  }
  const priorityItems = [
    ...(pendingExamCount > 0 ? [examMenuItem] : []),
    ...(unreadCount > 0 ? [notificationMenuItem] : []),
  ]

  const mobileOnlyMenuGroups = [
    ...(priorityItems.length > 0 ? [{
      title: 'Cần xử lý',
      items: priorityItems,
    }] : []),
    {
      title: 'Trang chủ',
      items: [
        {
          icon: <DashboardOutlined />,
          label: 'Dashboard tổng quan',
          route: isManager ? '/manager/dashboard' : '/staff/dashboard',
        },
      ],
    },
    {
      title: 'Theo dõi cá nhân',
      items: [
        {
          icon: <ClockCircleOutlined />,
          label: 'Giờ đào tạo liên tục',
          route: '/staff/training',
        },
        {
          icon: <BarChartOutlined />,
          label: 'Tiến độ đào tạo',
          route: '/staff/training-status',
        },
        {
          icon: <CheckSquareOutlined />,
          label: 'Tuân thủ quy trình, quy định',
          route: '/staff/competency',
        },
        {
          icon: <TrophyOutlined />,
          label: 'Năng lực chuyên môn',
          route: '/staff/professional-competency',
        },
      ],
    },
    {
      title: 'Bài kiểm tra',
      items: [
        ...(pendingExamCount > 0 ? [] : [examMenuItem]),
        {
          icon: <HistoryOutlined />,
          label: 'Lịch sử bài kiểm tra',
          route: '/staff/exam/history',
        },
      ],
    },
    ...(!isManager ? [
      {
        title: 'Tuân thủ',
        items: [
          ...(hasAssignedChecklist ? [
            {
              icon: <FileDoneOutlined />,
              label: 'Bảng kiểm được giao',
              route: '/staff/checklists',
            },
            {
              icon: <HistoryOutlined />,
              label: 'Lịch sử đánh giá',
              route: '/staff/quality/history',
            },
          ] : []),
        ],
      },
    ] : [
      {
        title: 'Quản lý khoa',
        items: [
          {
            icon: <BarChartOutlined />,
            label: 'Dashboard giờ đào tạo',
            route: '/manager/reports/training-dashboard',
          },
          {
            icon: <TrophyOutlined />,
            label: 'Dashboard năng lực chuyên môn',
            route: '/manager/reports/quality-dashboard',
          },
          {
            icon: <CheckSquareOutlined />,
            label: 'Chất lượng chăm sóc',
            route: '/manager/reports/checklist-dashboard',
          },
          {
            icon: <CheckSquareOutlined />,
            label: 'Tuân thủ theo kỹ thuật',
            route: '/manager/compliance-by-technique',
          },
          {
            icon: <BarChartOutlined />,
            label: 'Dashboard năng lực',
            route: '/manager/competency-summary',
          },
          {
            icon: <TeamOutlined />,
            label: 'Nhân sự và giờ đào tạo',
            route: '/manager/employees',
          },
          {
            icon: <FileDoneOutlined />,
            label: 'Kết quả năng lực chuyên môn',
            route: '/manager/exam-results',
          },
          {
            icon: <CheckSquareOutlined />,
            label: 'Thực hiện đánh giá',
            route: '/manager/quality/checklists',
          },
          {
            icon: <HistoryOutlined />,
            label: 'Lịch sử đánh giá',
            route: '/manager/quality/history',
          },
        ],
      },
    ]),
    {
      title: 'Tài khoản',
      items: [
        {
          icon: <UserOutlined />,
          label: 'Hồ sơ cá nhân',
          route: '/staff/profile',
        },
        ...(unreadCount > 0 ? [] : [notificationMenuItem]),
      ],
    },
  ].filter((group) => group.items.length > 0)

  const mobileAlertCountByRoute = new Map(
    mobileOnlyMenuGroups
      .flatMap((group) => group.items)
      .filter((item) => item.alertCount > 0)
      .map((item) => [item.route, item.alertCount])
  )
  const desktopAlignedMobileGroups = navSections.map((section) => ({
    title: section.label,
    items: section.items.map((item) => ({
      icon: item.icon,
      label: item.label,
      route: item.path,
      alertCount: item.path === '/staff/professional-competency'
        ? pendingExamCount
        : mobileAlertCountByRoute.get(item.path) || 0,
    })),
  }))
  const mobileMenuGroups = isManager
    ? desktopAlignedMobileGroups
    : [
        ...(unreadCount > 0 ? [{
          title: 'Cần xử lý',
          items: [notificationMenuItem],
        }] : []),
        ...desktopAlignedMobileGroups.map((group) => {
          const groupWithMobileUtilities = group.title === 'Tài khoản'
            ? {
                ...group,
                items: [
                  ...group.items,
                  ...(unreadCount > 0 ? [] : [notificationMenuItem]),
                ],
              }
            : group

          return groupWithMobileUtilities
        }),
      ]

  const normalizedSearchKeyword = normalizeSearchText(searchKeyword.trim())
  const isSearching = normalizedSearchKeyword.length > 0
  const filteredMobileItems = mobileMenuGroups
    .flatMap((group) => group.items)
    .filter((item) =>
      normalizeSearchText(item.label).includes(normalizedSearchKeyword)
    )

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="sidebar__backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => closeStaffMobileMenu()}
        />
      )}
      <aside
        className={`sidebar sidebar--staff-user${isMobileOpen ? ' sidebar--mobile-open' : ''}`}
        aria-label="Điều hướng chính"
        onTransitionEnd={handleSidebarTransitionEnd}
      >
        <div className="staff-mobile-menu" aria-hidden={!isMobileOpen}>
            <div className="staff-mobile-menu__topbar">
              <button
                type="button"
                className="staff-mobile-menu__back"
                aria-label="Quay lại nội dung trang"
                tabIndex={isMobileOpen ? 0 : -1}
                onClick={() => closeStaffMobileMenu()}
              >
                <LeftOutlined />
              </button>
              <div className="staff-mobile-menu__brand">
                <img src={logo} alt="" aria-hidden="true" />
                <span>VietDuc Care</span>
              </div>
            </div>

            <label className="staff-mobile-menu__search">
              <SearchOutlined aria-hidden="true" />
              <input
                type="search"
                value={searchKeyword}
                placeholder="Tìm chức năng..."
                aria-label="Tìm chức năng"
                tabIndex={isMobileOpen ? 0 : -1}
                onChange={(event) => setSearchKeyword(event.target.value)}
              />
            </label>

            <nav className="staff-mobile-menu__content" aria-label="Chức năng của nhân viên">
              {!isSearching && mobileMenuGroups.map((group) => (
                <section key={group.title} className="staff-mobile-menu__section">
                  <h2>{group.title}</h2>
                  <div className="staff-mobile-menu__grid">
                    {group.items.map((item) => {
                      const active = isLinkActive(item.route)
                      return (
                        <NavLink
                          key={item.route}
                          to={item.route}
                          className={`staff-mobile-menu__item${active ? ' staff-mobile-menu__item--active' : ''}`}
                          tabIndex={isMobileOpen ? 0 : -1}
                          onClick={(event) => {
                            event.preventDefault()
                            closeStaffMobileMenu(item.route)
                          }}
                        >
                          <span className="staff-mobile-menu__item-icon" aria-hidden="true">
                            {item.icon}
                            {item.alertCount > 0 && (
                              <span className="staff-mobile-menu__item-alert-dot" />
                            )}
                          </span>
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </section>
              ))}

              {isSearching && filteredMobileItems.length > 0 && (
                <section className="staff-mobile-menu__section" aria-label="Kết quả tìm kiếm">
                  <div className="staff-mobile-menu__grid">
                    {filteredMobileItems.map((item) => {
                      const active = isLinkActive(item.route)
                      return (
                        <NavLink
                          key={item.route}
                          to={item.route}
                          className={`staff-mobile-menu__item${active ? ' staff-mobile-menu__item--active' : ''}`}
                          tabIndex={isMobileOpen ? 0 : -1}
                          onClick={(event) => {
                            event.preventDefault()
                            closeStaffMobileMenu(item.route)
                          }}
                        >
                          <span className="staff-mobile-menu__item-icon" aria-hidden="true">
                            {item.icon}
                            {item.alertCount > 0 && (
                              <span className="staff-mobile-menu__item-alert-dot" />
                            )}
                          </span>
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </section>
              )}

              {isSearching && filteredMobileItems.length === 0 && (
                <div className="staff-mobile-menu__empty" role="status">
                  Không tìm thấy chức năng phù hợp
                </div>
              )}
            </nav>

            <button
              type="button"
              className="staff-mobile-menu__logout"
              tabIndex={isMobileOpen ? 0 : -1}
              onClick={handleLogout}
            >
              <LogoutOutlined />
              Đăng xuất
            </button>
        </div>

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
