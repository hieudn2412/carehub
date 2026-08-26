import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const providerMocks = vi.hoisted(() => ({
  adapter: null,
  roles: [],
  accessToken: 'stored-token',
}))

vi.mock('../features/staff/components/sidebar.jsx', () => ({ default: () => null }))
vi.mock('../features/staff/components/Header.jsx', () => ({ default: () => null }))
vi.mock('../features/admin/components/AdminSidebar.jsx', () => ({ default: () => null }))
vi.mock('../features/admin/components/AdminHeader.jsx', () => ({ default: () => null }))

vi.mock('../shared/auth/tokenStorage.js', () => ({
  tokenStorage: {
    getAccessToken: () => providerMocks.accessToken,
  },
}))

vi.mock('../shared/auth/jwt.js', () => ({
  getRolesFromAccessToken: () => providerMocks.roles,
}))

vi.mock('../shared/context/AppShellAdapterContext.jsx', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    AppShellAdapterProvider: ({ adapter, children }) => {
      providerMocks.adapter = adapter
      return (
        <actual.AppShellAdapterProvider adapter={adapter}>
          <div data-testid="adapter-provider">{children}</div>
        </actual.AppShellAdapterProvider>
      )
    },
  }
})

vi.mock('../shared/context/ToastContext.jsx', () => ({
  ToastProvider: ({ children }) => <div data-testid="toast-provider">{children}</div>,
}))

vi.mock('../features/auth/context/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
}))

import AppProviders from './providers.jsx'
import PageMetadata from './PageMetadata.jsx'
import {
  AppShellAdapterProvider,
  useAppShellAdapter,
} from '../shared/context/AppShellAdapterContext.jsx'

function NavigationHarness() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/staff/profile?tab=contact')}>move</button>
}

describe('AppProviders', () => {
  beforeEach(() => {
    providerMocks.adapter = null
    providerMocks.roles = []
    providerMocks.accessToken = 'stored-token'
  })

  it('composes the application providers and exposes its children', () => {
    render(
      <AppProviders>
        <span>application-child</span>
      </AppProviders>,
    )

    expect(screen.getByText('application-child')).toBeInTheDocument()
    expect(screen.getByTestId('adapter-provider')).toContainElement(screen.getByTestId('toast-provider'))
    expect(screen.getByTestId('toast-provider')).toContainElement(screen.getByTestId('auth-provider'))
    expect(providerMocks.adapter).toEqual(expect.objectContaining({
      Sidebar: expect.any(Function),
      Header: expect.any(Function),
      AdminSidebar: expect.any(Function),
      AdminHeader: expect.any(Function),
      resolveRole: expect.any(Function),
    }))
  })

  it.each([
    [['ADMIN'], 'admin'],
    [['MANAGER'], 'manager'],
    [['USER'], 'staff'],
    [[], 'staff'],
  ])('resolves roles %j to the %s shell', (roles, expectedRole) => {
    providerMocks.roles = roles
    render(<AppProviders><span>child</span></AppProviders>)

    expect(providerMocks.adapter.resolveRole()).toBe(expectedRole)
  })
})

describe('PageMetadata', () => {
  it('sets and updates the document title from pathname and search', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <PageMetadata />
        <NavigationHarness />
      </MemoryRouter>,
    )

    expect(document.title).toBe('Đăng nhập | Quản lý điều dưỡng Việt Đức')

    await act(async () => {
      screen.getByRole('button', { name: 'move' }).click()
    })

    expect(document.title).toBe('Hồ sơ cá nhân | Quản lý điều dưỡng Việt Đức')
  })
})

describe('AppShellAdapterContext', () => {
  function Consumer() {
    const adapter = useAppShellAdapter()
    return <span>{adapter.resolveRole()}</span>
  }

  it('uses a supplied adapter', () => {
    render(
      <AppShellAdapterProvider adapter={{ resolveRole: () => 'manager' }}>
        <Consumer />
      </AppShellAdapterProvider>,
    )

    expect(screen.getByText('manager')).toBeInTheDocument()
  })

  it('falls back to the staff adapter when no adapter is supplied', () => {
    render(
      <AppShellAdapterProvider>
        <Consumer />
      </AppShellAdapterProvider>,
    )

    expect(screen.getByText('staff')).toBeInTheDocument()
  })
})
