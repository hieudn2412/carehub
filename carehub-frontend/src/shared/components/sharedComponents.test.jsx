import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountDropdown from './AccountDropdown.jsx'
import AdminFilterDisclosure from './AdminFilterDisclosure.jsx'
import BrandLogo from './BrandLogo.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import DepartmentCombobox from './DepartmentCombobox.jsx'
import FormField from './FormField.jsx'
import PassFailBadge from './PassFailBadge.jsx'
import ProfileDetails from './ProfileDetails.jsx'
import ProgressRing from './ProgressRing.jsx'
import SecurityBadge from './SecurityBadge.jsx'

function RouteProbe() {
  const location = useLocation()
  return <output data-testid="route">{location.pathname}</output>
}

function renderWithRouter(node) {
  return render(
    <MemoryRouter initialEntries={['/current']}>
      <Routes>
        <Route path="/current" element={node} />
        <Route path="*" element={<RouteProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => vi.useRealTimers())

describe('AccountDropdown', () => {
  const props = {
    avatarLetter: 'N',
    displayName: 'Nguyễn Nam',
    displayRole: 'Nhân viên',
    profilePath: '/staff/profile',
    loginPath: '/auth/login',
  }

  it('opens, closes with Escape/outside click and navigates to profile', () => {
    const { unmount } = renderWithRouter(<AccountDropdown {...props} />)
    const trigger = screen.getByRole('button', { name: /Nguyễn Nam/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /Thông tin tài khoản/i }))
    expect(screen.getByTestId('route')).toHaveTextContent('/staff/profile')
    unmount()
  })

  it('logs out and redirects, while preserving an actionable failure', async () => {
    const onLogout = vi.fn().mockRejectedValueOnce(new Error('Máy chủ bận')).mockResolvedValueOnce()
    renderWithRouter(<AccountDropdown {...props} onLogout={onLogout} />)
    fireEvent.click(screen.getByRole('button', { name: /Nguyễn Nam/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Đăng xuất/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ bận')

    fireEvent.click(screen.getByRole('menuitem', { name: /Đăng xuất/i }))
    expect(await screen.findByTestId('route')).toHaveTextContent('/auth/login')
    expect(onLogout).toHaveBeenCalledTimes(2)
  })
})

describe('ChangePasswordModal', () => {
  function fill(oldPassword, newPassword, confirmPassword) {
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: oldPassword } })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: newPassword } })
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: confirmPassword } })
  }

  it('does not render while closed and validates all password rules', () => {
    const { rerender } = render(<ChangePasswordModal isOpen={false} />)
    expect(screen.queryByText('Đổi mật khẩu')).not.toBeInTheDocument()
    rerender(<ChangePasswordModal isOpen onClose={vi.fn()} onSubmitPassword={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(screen.getByText('Vui lòng nhập mật khẩu hiện tại')).toBeInTheDocument()
    fill('old', '   ', '   ')
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(screen.getByText(/ít nhất 4 ký tự/)).toBeInTheDocument()
    fill('old', 'newpass', 'different')
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(screen.getByText('Mật khẩu xác nhận không trùng khớp')).toBeInTheDocument()
  })

  it('toggles visibility, submits successfully and closes after the success delay', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    const onSubmitPassword = vi.fn().mockResolvedValue({})
    render(<ChangePasswordModal isOpen onClose={onClose} onSubmitPassword={onSubmitPassword} />)
    fill('oldpass', 'newpass', 'newpass')

    const oldInput = screen.getByLabelText('Mật khẩu hiện tại')
    const toggleButtons = document.querySelectorAll('.form-field__toggle-visibility')
    fireEvent.click(toggleButtons[0])
    expect(oldInput).toHaveAttribute('type', 'text')
    fireEvent.click(toggleButtons[0])
    expect(oldInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    await act(async () => Promise.resolve())
    expect(onSubmitPassword).toHaveBeenCalledWith({
      oldPassword: 'oldpass',
      newPassword: 'newpass',
      confirmNewPassword: 'newpass',
    })
    expect(screen.getByText('Đổi mật khẩu thành công!')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows submit errors and rejects a missing handler', async () => {
    const onSubmitPassword = vi.fn().mockRejectedValue({ response: { data: { message: 'Mật khẩu cũ sai' } } })
    const { unmount } = render(
      <ChangePasswordModal isOpen onClose={vi.fn()} onSubmitPassword={onSubmitPassword} />,
    )
    fill('oldpass', 'newpass', 'newpass')
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(await screen.findByText('Mật khẩu cũ sai')).toBeInTheDocument()
    unmount()

    render(<ChangePasswordModal isOpen onClose={vi.fn()} />)
    fill('oldpass', 'newpass', 'newpass')
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })
})

describe('DepartmentCombobox', () => {
  const departments = [
    { id: 1, name: 'Phòng Điều dưỡng', departmentCode: 'DD' },
    { id: 2, name: 'Khoa Giải phẫu bệnh', departmentCode: 'GPB' },
  ]

  it('searches without Vietnamese accents and selects a result', () => {
    const onChange = vi.fn()
    render(
      <DepartmentCombobox
        departments={departments}
        value=""
        onChange={onChange}
        allLabel="Toàn viện"
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByRole('option', { name: /Toàn viện/i })).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'giai phau' } })
    expect(screen.queryByText('Phòng Điều dưỡng')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /Khoa Giải phẫu bệnh/i }))
    expect(onChange).toHaveBeenLastCalledWith('2')
  })

  it('supports keyboard selection, escape and empty results', () => {
    const onChange = vi.fn()
    render(<DepartmentCombobox departments={departments} value="1" onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalled()

    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'không tồn tại' } })
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy phòng ban phù hợp')
  })

  it('does not open while disabled', () => {
    render(<DepartmentCombobox departments={departments} value="" onChange={vi.fn()} disabled />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('ProfileDetails', () => {
  it('renders loading and error states', () => {
    const { rerender } = render(<ProfileDetails loading onChangePassword={vi.fn()} />)
    expect(screen.getByText('Đang tải thông tin cá nhân...')).toBeInTheDocument()
    rerender(<ProfileDetails loading={false} errorMessage="Không tải được hồ sơ" onChangePassword={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được hồ sơ')
  })

  it('formats profile values and exposes profile actions', () => {
    const onChangePassword = vi.fn()
    const onEditProfile = vi.fn()
    render(
      <ProfileDetails
        loading={false}
        onChangePassword={onChangePassword}
        onEditProfile={onEditProfile}
        profile={{
          employeeCode: 'NV001',
          fullName: 'Nguyễn Văn Nam',
          email: 'nam@carehub.vn',
          phone: '0900000000',
          departmentName: 'Khoa Nội',
          birthday: '2000-01-02',
          gender: true,
          lastLogin: '2026-08-25T08:30:00',
          roles: ['ROLE_USER'],
          status: 'ACTIVE',
        }}
      />,
    )
    expect(screen.getByText('VN')).toBeInTheDocument()
    expect(screen.getByText('Nhân viên')).toBeInTheDocument()
    expect(screen.getByText('Nam')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('2000'))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Chỉnh sửa hồ sơ/i }))
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu/i }))
    expect(onEditProfile).toHaveBeenCalledTimes(1)
    expect(onChangePassword).toHaveBeenCalledTimes(1)
  })

  it('uses fallback values for incomplete inactive profiles', () => {
    render(
      <ProfileDetails
        loading={false}
        profile={{ status: 'LOCKED', gender: false, lastLogin: 'invalid' }}
        fallbackInitials="KT"
        fallbackRole="Quản lý cấp Khoa"
        onChangePassword={vi.fn()}
      />,
    )
    expect(screen.getByText('KT')).toBeInTheDocument()
    expect(screen.getByText('Bị khóa')).toBeInTheDocument()
    expect(screen.getByText('Nữ')).toBeInTheDocument()
    expect(screen.getByText('invalid')).toBeInTheDocument()
  })
})

describe('small shared presentation components', () => {
  it('renders filter disclosure count and custom class', () => {
    render(<AdminFilterDisclosure activeCount={2} className="extra"><p>Nội dung lọc</p></AdminFilterDisclosure>)
    expect(screen.getByLabelText('2 bộ lọc đang áp dụng')).toBeInTheDocument()
    expect(screen.getByText('Nội dung lọc').closest('details')).toHaveClass('extra')
  })

  it('wires confirm and cancel actions with danger/loading state', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        message="Xóa dữ liệu?"
        danger
        confirming
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText('Xóa dữ liệu?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('toggles FormField passwords and reports errors accessibly', () => {
    const onChange = vi.fn()
    render(
      <FormField
        label="Mật khẩu"
        type="password"
        value="secret"
        error="Sai mật khẩu"
        icon={<span>icon</span>}
        onChange={onChange}
      />,
    )
    const input = screen.getByLabelText('Mật khẩu')
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(input, { target: { value: 'next' } })
    expect(onChange).toHaveBeenCalledWith('next')
  })

  it.each([
    [true, 'Đạt'],
    [false, 'Chưa đạt'],
    [null, 'Chưa có dữ liệu'],
  ])('renders pass/fail tone %s as %s', (passed, label) => {
    render(<PassFailBadge passed={passed} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('clamps and rounds progress values', () => {
    const { rerender } = render(<ProgressRing progress={145.4} size={64} className="custom" />)
    expect(screen.getByLabelText('Tiến độ 100%')).toHaveTextContent('100%')
    expect(screen.getByLabelText('Tiến độ 100%')).toHaveClass('custom')
    rerender(<ProgressRing progress={-3} />)
    expect(screen.getByLabelText('Tiến độ 0%')).toHaveTextContent('0%')
  })

  it('renders brand and decorative security images', () => {
    const { container } = render(<><BrandLogo /><SecurityBadge /></>)
    expect(screen.getByRole('img', { name: 'CareHub' })).toBeInTheDocument()
    expect(container.querySelector('.security-badge img')).toHaveAttribute('alt', '')
  })
})
