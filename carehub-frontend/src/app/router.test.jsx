import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  isChecking: false,
  isAuthenticated: false,
  accessToken: null,
}))

vi.mock('../features/auth/context/AuthContext.jsx', () => ({
  useAuth: () => authState,
}))

vi.mock('../features/auth/components/ProtectedRoute.jsx', () => ({
  default: ({ children }) => children,
}))

vi.mock('../features/auth/utils/authNavigation.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getPostLoginRoute: () => '/staff/dashboard',
  }
})

vi.mock('../features/auth/pages/LoginScreen.jsx', () => ({
  default: () => <div>login-screen</div>,
}))

vi.mock('../features/staff/pages/DashboardStaffScreen.jsx', () => ({
  default: () => <div>staff-dashboard</div>,
}))

vi.mock('../features/training/pages/TrainingRecordDetailPage.jsx', () => ({
  default: () => <div>training-record-detail</div>,
}))

vi.mock('../features/admin/pages/ChecklistAssignmentPage.jsx', () => ({
  default: () => <div>checklist-assignment</div>,
}))

import AppRouter from './router.jsx'

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location">
      {`${location.pathname}${location.search}${location.hash}`}
    </div>
  )
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppRouter />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('AppRouter', () => {
  beforeEach(() => {
    Object.assign(authState, {
      isChecking: false,
      isAuthenticated: false,
      accessToken: null,
    })
  })

  it('shows a checking status on the landing route', () => {
    authState.isChecking = true

    renderAt('/')

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra phiên đăng nhập...')
  })

  it('sends an unauthenticated landing visit to login', async () => {
    renderAt('/')

    expect(await screen.findByText('login-screen')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/login')
  })

  it('sends an authenticated landing visit to its post-login route', async () => {
    Object.assign(authState, {
      isAuthenticated: true,
      accessToken: 'access-token',
    })

    renderAt('/auth')

    expect(await screen.findByText('staff-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/staff/dashboard')
  })

  it('shows a checking status instead of the public login form', () => {
    authState.isChecking = true

    renderAt('/auth/login')

    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra phiên đăng nhập...')
    expect(screen.queryByText('login-screen')).not.toBeInTheDocument()
  })

  it('redirects an authenticated user away from the public login form', async () => {
    Object.assign(authState, {
      isAuthenticated: true,
      accessToken: 'access-token',
    })

    renderAt('/auth/login')

    expect(await screen.findByText('staff-dashboard')).toBeInTheDocument()
  })

  it('renders the public login form for an unauthenticated user', () => {
    renderAt('/auth/login')

    expect(screen.getByText('login-screen')).toBeInTheDocument()
  })

  it('redirects the legacy training evidence route and keeps the hash', async () => {
    renderAt('/training/records/42/evidence')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/training/records/42#evidence')
    })
    expect(screen.getByText('training-record-detail')).toBeInTheDocument()
  })

  it('redirects checklist assignments while preserving query parameters', async () => {
    renderAt('/admin/quality/checklists/17/assignments?tab=active&formId=old')

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/admin/quality/checklist-assignments?tab=active&formId=17',
      )
    })
    expect(screen.getByText('checklist-assignment')).toBeInTheDocument()
  })

  it('uses the wildcard route for an unknown URL', async () => {
    renderAt('/not-a-real-page')

    expect(await screen.findByText('login-screen')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/login')
  })
})
