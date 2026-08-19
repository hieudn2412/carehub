import { useState } from 'react'
import MobileBackBar from './MobileBackBar.jsx'
import './MobileSearchSheet.css'
import { useAppShellAdapter } from '../context/AppShellAdapterContext.jsx'

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
  const {
    Sidebar: SidebarComponent,
    Header: HeaderComponent,
    AdminSidebar: AdminSidebarComponent,
    AdminHeader: AdminHeaderComponent,
    resolveRole,
  } = useAppShellAdapter()
  const role = resolveRole?.() || 'staff'
  const isAdmin = role === 'admin'
  const roleClassName = `app-shell--${role}`

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
      {!hideSidebar && (
        isAdmin
          ? (AdminSidebarComponent && <AdminSidebarComponent />)
          : (SidebarComponent && <SidebarComponent alertSummary={staffAlertSummary} />)
      )}
      <div className="app-shell__content">
        {!hideHeader && (
          isAdmin ? (
            AdminHeaderComponent && <AdminHeaderComponent title={title} breadcrumbs={breadcrumbs} back={back} mobileSearch={mobileSearchConfig} />
          ) : (
            HeaderComponent && <HeaderComponent
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
