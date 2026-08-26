import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthShell from './AuthShell.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import StepIndicator from './StepIndicator.jsx'

const authState = vi.hoisted(() => ({ current: null }))

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => authState.current,
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderProtected(auth, props = {}, initialEntry = '/private?tab=recent') {
  authState.current = auth
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/private"
          element={(
            <ProtectedRoute {...props}>
              <div>Nội dung bảo vệ</div>
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AuthShell and StepIndicator', () => {
  it('renders its content and only shows the support notice when requested', () => {
    const { rerender } = render(<AuthShell><div>Biểu mẫu</div></AuthShell>)

    expect(screen.getByText('Biểu mẫu')).toBeInTheDocument()
    expect(screen.queryByText('Không nhận được mã?')).not.toBeInTheDocument()

    rerender(<AuthShell showNotice><div>Biểu mẫu</div></AuthShell>)
    expect(screen.getByText('Không nhận được mã?')).toBeInTheDocument()
    expect(screen.getByText(/kiểm tra thư mục Spam/i)).toBeInTheDocument()
  })

  it('marks completed and active password-reset steps', () => {
    const { container } = render(
      <StepIndicator activeStep={2} steps={['Xác nhận', 'Mã OTP', 'Mật khẩu']} />,
    )

    const circles = container.querySelectorAll('.stepper__circle')
    expect(circles[0]).toHaveClass('is-done')
    expect(circles[0].querySelector('svg')).toBeInTheDocument()
    expect(circles[1]).toHaveClass('is-active')
    expect(circles[1]).toHaveTextContent('2')
    expect(circles[2]).not.toHaveClass('is-active', 'is-done')
  })
})

describe('ProtectedRoute', () => {
  const baseAuth = {
    accessToken: null,
    isChecking: false,
    isUnavailable: false,
    isAuthenticated: false,
    requiresFirstLoginSetup: false,
    refreshSession: vi.fn(),
  }

  beforeEach(() => {
    authState.current = { ...baseAuth, refreshSession: vi.fn() }
  })

  it('shows a checking status while the session is loading', () => {
    renderProtected({ ...baseAuth, isChecking: true })
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra phiên đăng nhập')
  })

  it('offers a retry action when session verification is unavailable', () => {
    const refreshSession = vi.fn()
    renderProtected({ ...baseAuth, isUnavailable: true, refreshSession })

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('redirects an unauthenticated user to login', () => {
    renderProtected(baseAuth)
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/login')
  })

  it('redirects first-login users unless setup is explicitly allowed', () => {
    const auth = {
      ...baseAuth,
      accessToken: tokenFor({ roles: ['ROLE_USER'] }),
      isAuthenticated: true,
      requiresFirstLoginSetup: true,
    }

    const { unmount } = renderProtected(auth, { allowedRoles: ['ROLE_USER'] })
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/email-confirm')
    unmount()

    renderProtected(auth, { allowFirstLoginSetup: true, allowedRoles: ['ROLE_USER'] })
    expect(screen.getByText('Nội dung bảo vệ')).toBeInTheDocument()
  })

  it('renders children for an allowed role and redirects a forbidden role to its default', () => {
    const userAuth = {
      ...baseAuth,
      accessToken: tokenFor({ roles: ['ROLE_USER'] }),
      isAuthenticated: true,
    }

    const { unmount } = renderProtected(userAuth, { allowedRoles: ['ROLE_USER'] })
    expect(screen.getByText('Nội dung bảo vệ')).toBeInTheDocument()
    unmount()

    renderProtected(userAuth, { allowedRoles: ['ROLE_ADMIN'] })
    expect(screen.getByTestId('location')).toHaveTextContent('/staff/dashboard')
  })

  it('allows a matching permission without an allowed role', () => {
    renderProtected({
      ...baseAuth,
      accessToken: tokenFor({ permissions: ['RESULT_VIEWER'] }),
      isAuthenticated: true,
    }, { allowedRoles: ['ROLE_ADMIN'], allowedPermissions: ['RESULT_VIEWER'] })

    expect(screen.getByText('Nội dung bảo vệ')).toBeInTheDocument()
  })
})

function tokenFor(payload) {
  return `header.${window.btoa(JSON.stringify(payload))}.signature`
}
