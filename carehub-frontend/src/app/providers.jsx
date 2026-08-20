import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '../shared/context/ToastContext.jsx'
import { AppShellAdapterProvider } from '../shared/context/AppShellAdapterContext.jsx'
import Sidebar from '../features/staff/components/sidebar.jsx'
import Header from '../features/staff/components/Header.jsx'
import AdminSidebar from '../features/admin/components/AdminSidebar.jsx'
import AdminHeader from '../features/admin/components/AdminHeader.jsx'
import { tokenStorage } from '../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../shared/auth/jwt.js'
import { AUTH_ROLE, hasAnyRole } from '../features/auth/utils/authNavigation.js'
import { AuthProvider } from '../features/auth/context/AuthContext.jsx'

const appShellAdapter = {
  Sidebar,
  Header,
  AdminSidebar,
  AdminHeader,
  resolveRole() {
    const roles = getRolesFromAccessToken(tokenStorage.getAccessToken())
    if (hasAnyRole(roles, [AUTH_ROLE.admin])) return 'admin'
    if (hasAnyRole(roles, [AUTH_ROLE.manager])) return 'manager'
    return 'staff'
  },
}

function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <AppShellAdapterProvider adapter={appShellAdapter}>
        <ToastProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ToastProvider>
      </AppShellAdapterProvider>
    </BrowserRouter>
  )
}

export default AppProviders
