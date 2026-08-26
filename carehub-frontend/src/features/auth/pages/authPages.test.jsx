import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailConfirmOtpScreen from './EmailConfirmOtpScreen.jsx'
import EmailConfirmResetScreen from './EmailConfirmResetScreen.jsx'
import EmailConfirmScreen from './EmailConfirmScreen.jsx'
import EmailConfirmSuccessScreen from './EmailConfirmSuccessScreen.jsx'
import ForgotAccountScreen from './ForgotAccountScreen.jsx'
import LoginScreen from './LoginScreen.jsx'
import OtpScreen from './OtpScreen.jsx'
import ResetPasswordScreen from './ResetPasswordScreen.jsx'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  sendFirstLoginOtp: vi.fn(),
  completeFirstLoginSetup: vi.fn(),
  acceptAuthResponse: vi.fn(),
  clearAuthState: vi.fn(),
  expiry: {
    expiresAt: 2_000_000_000_000,
    formattedRemaining: '04:59',
    isExpired: false,
    resetExpiry: vi.fn(),
  },
}))

vi.mock('../api/authApi.js', () => ({
  authApi: {
    login: mocks.login,
    forgotPassword: mocks.forgotPassword,
    resetPassword: mocks.resetPassword,
    sendFirstLoginOtp: mocks.sendFirstLoginOtp,
    completeFirstLoginSetup: mocks.completeFirstLoginSetup,
  },
}))

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    acceptAuthResponse: mocks.acceptAuthResponse,
    clearAuthState: mocks.clearAuthState,
  }),
}))

vi.mock('../hooks/useOtpExpiry.js', () => ({
  createOtpExpiresAt: () => 2_000_000_000_000,
  useOtpExpiry: () => mocks.expiry,
}))

function Destination() {
  const location = useLocation()
  return (
    <div>
      <output data-testid="destination">{location.pathname}</output>
      <output data-testid="destination-state">{JSON.stringify(location.state)}</output>
    </div>
  )
}

function renderScreen(Component, { state, path = '/start' } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path={path} element={<Component />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  )
}

function userToken() {
  return `header.${window.btoa(JSON.stringify({ roles: ['ROLE_USER'] }))}.signature`
}

function fillOtp(value = '123456') {
  fireEvent.paste(screen.getByLabelText('Mã OTP số 1'), {
    clipboardData: { getData: () => value },
  })
}

beforeEach(() => {
  Object.values(mocks).forEach((value) => {
    if (typeof value?.mockReset === 'function') value.mockReset()
  })
  mocks.expiry.expiresAt = 2_000_000_000_000
  mocks.expiry.formattedRemaining = '04:59'
  mocks.expiry.isExpired = false
  mocks.expiry.resetExpiry.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LoginScreen', () => {
  it('validates required credentials before calling the API', () => {
    renderScreen(LoginScreen)
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(screen.getByText('Vui lòng nhập mã nhân viên và mật khẩu')).toBeInTheDocument()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('logs in, remembers the employee code and follows the requested staff route', async () => {
    mocks.login.mockResolvedValue({
      data: { data: { accessToken: userToken(), requiresFirstLoginSetup: false } },
    })
    renderScreen(LoginScreen, { state: { from: '/staff/profile' } })

    fireEvent.change(screen.getByLabelText('Mã nhân viên'), { target: { value: ' NV001 ' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith({ employeeCode: 'NV001', password: 'secret' }))
    expect(mocks.acceptAuthResponse).toHaveBeenCalled()
    expect(window.localStorage.getItem('carehub.rememberedEmployeeCode')).toBe('NV001')
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/staff/profile'))
  })

  it('routes first-login accounts to email confirmation', async () => {
    mocks.login.mockResolvedValue({
      data: { data: { accessToken: userToken(), requiresFirstLoginSetup: true } },
    })
    renderScreen(LoginScreen)
    fireEvent.change(screen.getByLabelText('Mã nhân viên'), { target: { value: 'NV002' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/auth/email-confirm'))
  })

  it('shows a safe message when login fails', async () => {
    mocks.login.mockRejectedValue({ response: { data: { message: 'Đăng nhập không thành công' } } })
    renderScreen(LoginScreen)
    fireEvent.change(screen.getByLabelText('Mã nhân viên'), { target: { value: 'NV003' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'bad' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText('Đăng nhập không thành công')).toBeInTheDocument()
  })
})

describe('ForgotAccountScreen', () => {
  it('validates email and sends a normalized address with OTP expiry state', async () => {
    mocks.forgotPassword.mockResolvedValue({})
    renderScreen(ForgotAccountScreen)

    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }))
    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' user@carehub.vn ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }))

    await waitFor(() => expect(mocks.forgotPassword).toHaveBeenCalledWith({ email: 'user@carehub.vn' }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/auth/otp'))
    expect(screen.getByTestId('destination-state')).toHaveTextContent('user@carehub.vn')
  })

  it('shows an API fallback error', async () => {
    mocks.forgotPassword.mockRejectedValue({ response: { data: { message: 'Không thể gửi mã OTP' } } })
    renderScreen(ForgotAccountScreen)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@carehub.vn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }))
    expect(await screen.findByText('Không thể gửi mã OTP')).toBeInTheDocument()
  })
})

describe('OtpScreen', () => {
  it('redirects to forgot-password when email state is missing', () => {
    renderScreen(OtpScreen)
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/forgot-password')
  })

  it('requires six digits and forwards pasted OTP to reset-password', () => {
    renderScreen(OtpScreen, { state: { email: 'user@carehub.vn', otpExpiresAt: 123 } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByText('Vui lòng nhập đủ 6 số OTP')).toBeInTheDocument()

    fillOtp('12x3456')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/reset-password')
    expect(screen.getByTestId('destination-state')).toHaveTextContent('123456')
  })

  it('disables confirmation and reports an expired OTP', () => {
    mocks.expiry.isExpired = true
    renderScreen(OtpScreen, { state: { email: 'user@carehub.vn' } })
    expect(screen.getByText(/Mã OTP đã hết hạn/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  })
})

describe('ResetPasswordScreen', () => {
  const state = { email: 'user@carehub.vn', otp: '123456', otpExpiresAt: 123 }

  it('redirects when required OTP state is absent', () => {
    renderScreen(ResetPasswordScreen)
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/forgot-password')
  })

  it('validates password rules and matching confirmation', async () => {
    renderScreen(ResetPasswordScreen, { state })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByText(/ít nhất 4 ký tự/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.change(screen.getByLabelText('Xác thực mật khẩu mới'), { target: { value: 'abce' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByText('Mật khẩu xác nhận chưa khớp')).toBeInTheDocument()
  })

  it('submits a valid password and returns to login', async () => {
    mocks.resetPassword.mockResolvedValue({})
    renderScreen(ResetPasswordScreen, { state })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.change(screen.getByLabelText('Xác thực mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(mocks.resetPassword).toHaveBeenCalledWith({
      email: state.email,
      otp: state.otp,
      newPassword: 'abcd',
    }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/auth/login'))
  })

  it('renders API and expiry errors', async () => {
    mocks.resetPassword.mockRejectedValue({ response: { data: { message: 'Không thể đặt lại mật khẩu' } } })
    const { unmount } = renderScreen(ResetPasswordScreen, { state })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.change(screen.getByLabelText('Xác thực mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(await screen.findByText('Không thể đặt lại mật khẩu')).toBeInTheDocument()
    unmount()

    mocks.expiry.isExpired = true
    renderScreen(ResetPasswordScreen, { state })
    expect(screen.getByRole('alert')).toHaveTextContent('Mã OTP đã hết hạn')
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  })
})

describe('first-login email confirmation flow', () => {
  it('validates and sends the confirmation email', async () => {
    mocks.sendFirstLoginOtp.mockResolvedValue({})
    renderScreen(EmailConfirmScreen)
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }))
    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' first@carehub.vn ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }))
    await waitFor(() => expect(mocks.sendFirstLoginOtp).toHaveBeenCalledWith({ email: 'first@carehub.vn' }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/auth/email-confirm-otp'))
  })

  it('shows a send-email failure', async () => {
    mocks.sendFirstLoginOtp.mockRejectedValue({ response: { data: { message: 'Không thể gửi mã OTP' } } })
    renderScreen(EmailConfirmScreen)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'first@carehub.vn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã OTP' }))
    expect(await screen.findByText('Không thể gửi mã OTP')).toBeInTheDocument()
  })

  it('redirects missing OTP state and forwards a complete OTP', () => {
    const { unmount } = renderScreen(EmailConfirmOtpScreen)
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/email-confirm')
    unmount()

    renderScreen(EmailConfirmOtpScreen, { state: { email: 'first@carehub.vn' } })
    fillOtp()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/email-confirm-reset')
  })

  it('validates and completes first-login password setup', async () => {
    mocks.completeFirstLoginSetup.mockResolvedValue({})
    const state = { email: 'first@carehub.vn', otp: '123456', otpExpiresAt: 123 }
    renderScreen(EmailConfirmResetScreen, { state })

    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.change(screen.getByLabelText('Xác thực mật khẩu mới'), { target: { value: 'abce' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByText('Mật khẩu xác nhận chưa khớp')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Xác thực mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(mocks.completeFirstLoginSetup).toHaveBeenCalledWith({
      email: state.email,
      otp: state.otp,
      newPassword: 'abcd',
    }))
    await waitFor(() => expect(screen.getByTestId('destination')).toHaveTextContent('/auth/email-confirm-success'))
  })

  it('redirects reset without state and reports completion failure/expiry', async () => {
    const { unmount } = renderScreen(EmailConfirmResetScreen)
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/email-confirm')
    unmount()

    mocks.completeFirstLoginSetup.mockRejectedValue({ response: { data: { message: 'Không thể hoàn tất thiết lập' } } })
    const state = { email: 'first@carehub.vn', otp: '123456' }
    const view = renderScreen(EmailConfirmResetScreen, { state })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.change(screen.getByLabelText('Xác thực mật khẩu mới'), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(await screen.findByText('Không thể hoàn tất thiết lập')).toBeInTheDocument()
    view.unmount()

    mocks.expiry.isExpired = true
    renderScreen(EmailConfirmResetScreen, { state })
    expect(screen.getByRole('alert')).toHaveTextContent('Mã OTP đã hết hạn')
  })

  it('clears auth and redirects the success screen after three seconds', () => {
    vi.useFakeTimers()
    renderScreen(EmailConfirmSuccessScreen, { state: { completed: true } })
    expect(mocks.clearAuthState).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/login')
  })

  it('immediately redirects a success screen opened without completion state', () => {
    renderScreen(EmailConfirmSuccessScreen)
    expect(screen.getByTestId('destination')).toHaveTextContent('/auth/login')
    expect(mocks.clearAuthState).not.toHaveBeenCalled()
  })
})
