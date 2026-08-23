import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  TrophyOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  CheckSquareOutlined,
  FileDoneOutlined,
  DownOutlined,
  LeftOutlined,
  SearchOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { AUTH_ROUTES } from '../../auth/constants/authRoutes.js'
import { logoutUser } from '../../auth/services/logoutUser.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import {
  AUTH_ROLE,
  hasAnyRole,
} from '../../auth/utils/authNavigation.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import logo from '../../../assets/logo.png'
import '../styles/StaffDashBoardScreen.css'

function normalizeSearchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

function Sidebar({ alertSummary = {} }) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const navRef = useRef(null)
  const pendingRouteRef = useRef(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobileClosing, setIsMobileClosing] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [pendingRoute, setPendingRoute] = useState(null)

  useLayoutEffect(() => {
    pendingRouteRef.current = pendingRoute
  }, [pendingRoute])

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isManager = hasAnyRole(roles, [AUTH_ROLE.manager])
  const unreadCount = Number(alertSummary.unreadCount) || 0
  const pendingExamCount = Number(alertSummary.pendingExamCount) || 0

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
        { icon: <DashboardOutlined />, label: 'Dashboard', path: isManager ? '/manager/dashboard' : '/staff/dashboard' },
      ],
    },
    {
      label: 'Theo dõi cá nhân',
      items: [
        { icon: <ClockCircleOutlined />, label: 'Đào tạo liên tục', path: '/staff/training' },
        { icon: <CheckSquareOutlined />, label: 'Giám sát tuân thủ', path: '/staff/competency' },
        { icon: <TrophyOutlined />, label: 'Năng lực chuyên môn', path: '/staff/professional-competency' },
        ...(!isManager ? [
          { icon: <BarChartOutlined />, label: 'Chất lượng chăm sóc', path: '/staff/reports/checklist-dashboard' },
          { icon: <FileDoneOutlined />, label: 'Bảng kiểm giám sát', path: '/staff/checklists' },
        ] : []),
        ...(!isManager ? [
          { icon: <HistoryOutlined />, label: 'Lịch sử đánh giá', path: '/staff/quality/history' },
        ] : []),
      ],
    },
  ]

  // Manager specific features
  if (isManager) {
    navSections.push(
      {
        label: 'Đào tạo liên tục',
        items: [
          { icon: <BarChartOutlined />, label: 'Đào tạo liên tục', path: '/manager/reports/training-dashboard' },
        ],
      },
      {
        label: 'Giám sát tuân thủ',
        items: [
          { icon: <CheckSquareOutlined />, label: 'Tuân thủ chung', path: '/manager/compliance-by-technique' },
          { icon: <CheckSquareOutlined />, label: 'Tuân thủ theo kỹ thuật', path: '/manager/reports/checklist-dashboard' },
          { icon: <CheckSquareOutlined />, label: 'Bảng kiểm giám sát', path: '/manager/quality/checklists' },
        ],
      },
      {
        label: 'Năng lực chuyên môn',
        items: [
          { icon: <TrophyOutlined />, label: 'Năng lực chuyên môn', path: '/manager/reports/quality-dashboard' },
          // Mục này trước đây tên "Chất lượng chăm sóc" và nằm trong nhóm giám sát tuân thủ,
          // nhưng nội dung là dashboard năng lực nên thuộc về nhóm này.
          { icon: <BarChartOutlined />, label: 'Dashboard năng lực', path: '/manager/competency-summary' },
          { icon: <FileDoneOutlined />, label: 'Kết quả năng lực chuyên môn', path: '/manager/exam-results' },
        ],
      },
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

  const activeSectionLabel = activeSection?.label ?? null
  const [expandedSectionLabel, setExpandedSectionLabel] = useState(activeSectionLabel)

  useLayoutEffect(() => {
    if (!activeSectionLabel) return

    setExpandedSectionLabel(activeSectionLabel)
  }, [activeSectionLabel])

  // Restore scroll position
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('staff-sidebar-scroll')
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
    window.addEventListener('staff-sidebar-toggle', handleMenuToggle)
    return () => window.removeEventListener('staff-sidebar-toggle', handleMenuToggle)
  }, [isMobileClosing, isMobileOpen])

  useEffect(() => {
    if (!isMobileOpen && !isMobileClosing) return undefined

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
  }, [isMobileClosing, isMobileOpen])

  const handleScroll = (e) => {
    sessionStorage.setItem('staff-sidebar-scroll', String(e.target.scrollTop))
  }

  const handleSectionToggle = (sectionLabel) => {
    setExpandedSectionLabel((currentLabel) =>
      currentLabel === sectionLabel ? null : sectionLabel
    )
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
      navigate(AUTH_ROUTES.login, { replace: true })
    } catch (error) {
      window.alert(error?.message || 'Không thể đăng xuất. Vui lòng thử lại.')
    }
  }

  const closeStaffMobileMenu = (route = null) => {
    if (!isMobileOpen || isMobileClosing) return

    setPendingRoute(route)
    setIsMobileClosing(true)
    setIsMobileOpen(false)
  }

  const finishStaffMobileMenuClose = () => {
    if (!isMobileClosing) return

    const route = pendingRouteRef.current ?? pendingRoute
    pendingRouteRef.current = null
    setSearchKeyword('')
    setPendingRoute(null)
    setIsMobileClosing(false)

    if (route && route !== currentPath) {
      navigate(route)
    }
  }

  const handleSidebarTransitionEnd = (event) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'transform' ||
      isMobileOpen
    ) {
      return
    }

    finishStaffMobileMenuClose()
  }

  const handleSidebarTransitionCancel = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    finishStaffMobileMenuClose()
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
          label: 'Dashboard',
          route: isManager ? '/manager/dashboard' : '/staff/dashboard',
        },
      ],
    },
    {
      title: 'Theo dõi cá nhân',
      items: [
        {
          icon: <ClockCircleOutlined />,
          label: 'Đào tạo liên tục',
          route: '/staff/training',
        },
        {
          icon: <BarChartOutlined />,
          label: 'Tiến độ đào tạo',
          route: '/staff/training-status',
        },
        {
          icon: <CheckSquareOutlined />,
          label: 'Giám sát tuân thủ',
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
        title: 'Giám sát tuân thủ',
        items: [
          {
            icon: <FileDoneOutlined />,
            label: 'Bảng kiểm giám sát',
            route: '/staff/checklists',
          },
        ],
      },
    ] : []),
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
        onTransitionCancel={handleSidebarTransitionCancel}
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
