import { useState } from 'react'
import Sidebar from '../../features/staff/components/sidebar'
import Header from '../../features/staff/components/Header'
import AdminHeader from '../../features/admin/components/AdminHeader'
import MobileBackBar from './MobileBackBar.jsx'
import './MobileSearchSheet.css'
import { tokenStorage } from '../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../features/auth/utils/jwt.js'
import { AUTH_ROLE, hasAnyRole } from '../../features/auth/utils/authNavigation.js'

/**
 * Khung trang chuẩn: Sidebar (tự chọn theo role) + Header + <main>.
 * Thay cho pattern cũ mỗi page tự lắp dashboard-layout/Sidebar/Header.
 *
 * <AppShell title="..." breadcrumbs={[{label, link}]} back={{label, to}}>
 *   ...nội dung trang...
 * </AppShell>
 */
function AppShell({
  title,
  breadcrumbs,
  back,
  mobileSearch,
  className,
  hideSidebar = false,
  hideHeader = false,
  children,
}) {
  const [staffAlertSummary, setStaffAlertSummary] = useState({
    unreadCount: 0,
    pendingExamCount: 0,
  })
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const roles = getRolesFromAccessToken(tokenStorage.getAccessToken())
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])
  const isManager = hasAnyRole(roles, [AUTH_ROLE.manager])
  const roleClassName = isAdmin
    ? 'app-shell--admin'
    : isManager
      ? 'app-shell--manager'
      : 'app-shell--staff'

  const mobileSearchConfig = mobileSearch
    ? {
        ...mobileSearch,
        isOpen: mobileSearchOpen,
        onToggle: () => {
          if (!mobileSearchOpen) mobileSearch.onOpen?.()
          setMobileSearchOpen(current => !current)
        },
        onClose: () => {
          setMobileSearchOpen(false)
        },
      }
    : null

  return (
    <div
      className={`app-shell ${roleClassName}${hideSidebar ? ' app-shell--no-sidebar' : ''}${hideHeader ? ' app-shell--no-header' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--app-sidebar-width': isAdmin ? '222px' : '240px' }}
    >
      {!hideSidebar && <Sidebar alertSummary={staffAlertSummary} />}
      <div className="app-shell__content">
        {!hideHeader && (
          isAdmin ? (
            <AdminHeader title={title} breadcrumbs={breadcrumbs} back={back} mobileSearch={mobileSearchConfig} />
          ) : (
            <Header
              title={title}
              breadcrumbs={breadcrumbs}
              back={back}
              mobileSearch={mobileSearchConfig}
              onAlertSummaryChange={setStaffAlertSummary}
            />
          )
        )}
        <main className="app-shell__body dashboard-body">
          {back && !hideHeader && <MobileBackBar {...back} />}
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppShell
