import Sidebar from '../../features/staff/components/sidebar'
import Header from '../../features/staff/components/Header'
import AdminHeader from '../../features/admin/components/AdminHeader'
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
function AppShell({ title, breadcrumbs, back, className, children }) {
  const roles = getRolesFromAccessToken(tokenStorage.getAccessToken())
  const isAdmin = hasAnyRole(roles, [AUTH_ROLE.admin])
  const isManager = hasAnyRole(roles, [AUTH_ROLE.manager])
  const roleClassName = isAdmin
    ? 'app-shell--admin'
    : isManager
      ? 'app-shell--manager'
      : 'app-shell--staff'

  return (
    <div
      className={`app-shell ${roleClassName}${className ? ` ${className}` : ''}`}
      style={{ '--app-sidebar-width': isAdmin ? '222px' : '240px' }}
    >
      <Sidebar />
      <div className="app-shell__content">
        {isAdmin ? (
          <AdminHeader title={title} breadcrumbs={breadcrumbs} back={back} />
        ) : (
          <Header title={title} breadcrumbs={breadcrumbs} back={back} />
        )}
        <main className="app-shell__body dashboard-body">{children}</main>
      </div>
    </div>
  )
}

export default AppShell
