import { createContext, useContext } from 'react'

const defaultAdapter = {
  Sidebar: null,
  Header: null,
  AdminSidebar: null,
  AdminHeader: null,
  resolveRole: () => 'staff',
}

const AppShellAdapterContext = createContext(defaultAdapter)

export function AppShellAdapterProvider({ adapter, children }) {
  return (
    <AppShellAdapterContext.Provider value={adapter || defaultAdapter}>
      {children}
    </AppShellAdapterContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppShellAdapter() {
  return useContext(AppShellAdapterContext)
}
