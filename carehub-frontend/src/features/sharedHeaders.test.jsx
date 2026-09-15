import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const headerMocks = vi.hoisted(() => ({
  roles: ['USER'],
  profileData: { fullName: 'Nguyễn Văn Nam', roles: ['USER'] },
  profileError: null,
  notifications: [],
  unreadCount: 0,
  pendingExamCount: 0,
  hasChecklistAssignment: false,
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
}))

vi.mock('./staff/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: headerMocks.notifications,
    unreadCount: headerMocks.unreadCount,
    pendingExamCount: headerMocks.pendingExamCount,
    hasChecklistAssignment: headerMocks.hasChecklistAssignment,
    markAllAsRead: headerMocks.markAllAsRead,
    markAsRead: headerMocks.markAsRead,
  }),
}))

vi.mock('./staff/api/staffApi', () => ({
  staffApi: {
    getProfile: vi.fn(async () => {
      if (headerMocks.profileError) throw headerMocks.profileError
      return { data: { data: headerMocks.profileData } }
    }),
  },
}))

vi.mock('../shared/auth/tokenStorage.js', () => ({
  tokenStorage: { getAccessToken: () => 'access-token' },
}))

vi.mock('../shared/auth/jwt.js', () => ({
  getRolesFromAccessToken: () => headerMocks.roles,
}))

vi.mock('../shared/components/AccountDropdown.jsx', () => ({
  default: (props) => (
    <div data-testid="account-dropdown">
      {`${props.avatarLetter}|${props.displayName}|${props.displayRole}|${props.profilePath}`}
    </div>
  ),
}))

vi.mock('../shared/components/HeaderBackNavigation.jsx', () => ({
  default: ({ label = 'Quay lại' }) => <button type="button">{label}</button>,
}))

vi.mock('../shared/components/MobileSearchSheet.jsx', () => ({
  default: ({ title, onClose, children }) => (
    <div role="dialog" aria-label={title || 'Bộ lọc'}>
      {children}
      <button type="button" onClick={onClose}>close-sheet</button>
    </div>
  ),
}))

import Header from './staff/components/Header.jsx'
import AdminHeader from './admin/components/AdminHeader.jsx'
import { staffApi } from './staff/api/staffApi'

function renderHeader(Component, props = {}) {
  return render(
    <MemoryRouter>
      <Component {...props} />
    </MemoryRouter>,
  )
}

const notificationSamples = [
  { id: 1, type: 'DANGER', message: 'Nguy hiểm', sender: 'Hệ thống', createdAt: '08:00', read: false },
  { id: 2, type: 'WARNING', message: 'Cảnh báo', sender: 'Hệ thống', createdAt: '08:01', read: false },
  { id: 3, type: 'SUCCESS', message: 'Thành công', sender: 'Hệ thống', createdAt: '08:02', read: true },
  { id: 4, type: 'UNKNOWN', message: 'Thông tin', sender: 'Hệ thống', createdAt: '08:03', read: false },
]

describe('staff Header', () => {
  beforeEach(() => {
    headerMocks.roles = ['USER']
    headerMocks.profileData = { fullName: 'Nguyễn Văn Nam', roles: ['USER'] }
    headerMocks.profileError = null
    headerMocks.notifications = []
    headerMocks.unreadCount = 0
    headerMocks.pendingExamCount = 0
    headerMocks.hasChecklistAssignment = false
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads profile, reports alert summary and renders account identity', async () => {
    headerMocks.unreadCount = 2
    headerMocks.pendingExamCount = 3
    headerMocks.hasChecklistAssignment = true
    const onAlertSummaryChange = vi.fn()

    renderHeader(Header, { title: 'Trang nhân viên', onAlertSummaryChange })

    expect(screen.getByRole('heading', { name: 'Trang nhân viên' })).toBeInTheDocument()
    await waitFor(() => expect(staffApi.getProfile).toHaveBeenCalled())
    await waitFor(() => {
      expect(screen.getByTestId('account-dropdown')).toHaveTextContent('N|Nguyễn Văn Nam|Nhân viên|/staff/profile')
    })
    expect(onAlertSummaryChange).toHaveBeenCalledWith({
      unreadCount: 2,
      pendingExamCount: 3,
      hasChecklistAssignment: true,
    })
    expect(screen.getByRole('link', { name: '3 bài kiểm tra chưa làm' })).toBeInTheDocument()
  })

  it('dispatches the correct sidebar event for staff and admin tokens', () => {
    const staffListener = vi.fn()
    const adminListener = vi.fn()
    window.addEventListener('staff-sidebar-toggle', staffListener)
    window.addEventListener('admin-sidebar-toggle', adminListener)

    const first = renderHeader(Header)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu điều hướng' }))
    expect(staffListener).toHaveBeenCalledTimes(1)
    first.unmount()

    headerMocks.roles = ['ADMIN']
    renderHeader(Header)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu điều hướng' }))
    expect(adminListener).toHaveBeenCalledTimes(1)

    window.removeEventListener('staff-sidebar-toggle', staffListener)
    window.removeEventListener('admin-sidebar-toggle', adminListener)
  })

  it('resolves all supported breadcrumb fallbacks and keeps the current item plain', () => {
    headerMocks.roles = ['ADMIN']
    const labels = [
      'Chất lượng', 'Đào tạo', 'Đánh giá', 'Nhân viên', 'Phòng ban',
      'Hệ thống', 'Thông báo', 'Mẫu email', 'Quy tắc phân loại',
      'Bộ câu hỏi', 'Danh mục câu hỏi', 'Ngân hàng câu hỏi',
      'Quản lý bài kiểm tra', 'Tạo câu hỏi từ tài liệu', 'Trang chủ',
      'Không có liên kết', 'Hiện tại',
    ]

    renderHeader(Header, {
      back: { label: 'Trở về' },
      breadcrumbs: labels.map((label) => ({ label })),
    })

    expect(screen.getByRole('button', { name: 'Trở về' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chất lượng' })).toHaveAttribute('href', '/admin/quality/checklists')
    expect(screen.getByRole('link', { name: 'Đào tạo' })).toHaveAttribute('href', '/training/employees')
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/admin/dashboard')
    expect(screen.queryByRole('link', { name: 'Không có liên kết' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Hiện tại' })).not.toBeInTheDocument()
  })

  it('renders notification tones, marks items and closes on outside click', () => {
    headerMocks.notifications = notificationSamples
    headerMocks.unreadCount = 4
    renderHeader(Header)

    const toggle = screen.getByRole('button', { name: 'Mở thông báo' })
    fireEvent.click(toggle)

    const popover = screen.getByText('Thông báo').closest('.notify-popover')
    expect(popover).toBeInTheDocument()
    expect(popover.querySelectorAll('.notify-item__icon-wrapper--danger')).toHaveLength(1)
    expect(popover.querySelectorAll('.notify-item__icon-wrapper--warning')).toHaveLength(1)
    expect(popover.querySelectorAll('.notify-item__icon-wrapper--success')).toHaveLength(1)
    expect(popover.querySelectorAll('.notify-item__icon-wrapper--info')).toHaveLength(1)

    fireEvent.click(within(popover).getByText('Nguy hiểm').closest('button'))
    expect(headerMocks.markAsRead).toHaveBeenCalledWith(1)
    fireEvent.click(within(popover).getByRole('button', { name: 'Đọc tất cả' }))
    expect(headerMocks.markAllAsRead).toHaveBeenCalled()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Nguy hiểm')).not.toBeInTheDocument()
  })

  it('shows an empty notification state and disables mark-all', () => {
    renderHeader(Header)
    fireEvent.click(screen.getByRole('button', { name: 'Mở thông báo' }))

    expect(screen.getByText('Không có thông báo mới nào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
  })

  it('opens mobile search, caps its badge and invokes sheet callbacks', () => {
    const onToggle = vi.fn()
    const onClose = vi.fn()
    renderHeader(Header, {
      mobileSearch: {
        ariaLabel: 'Tìm hồ sơ',
        activeCount: 120,
        isOpen: true,
        title: 'Lọc hồ sơ',
        onToggle,
        onClose,
        renderContent: ({ close }) => <button type="button" onClick={close}>filter-content</button>,
      },
    })

    const searchButton = screen.getByRole('button', { name: 'Tìm hồ sơ, 120 điều kiện đang chọn' })
    expect(searchButton).toHaveAttribute('aria-expanded', 'true')
    expect(searchButton).toHaveTextContent('99+')
    fireEvent.click(searchButton)
    expect(onToggle).toHaveBeenCalled()

    expect(screen.getByRole('dialog', { name: 'Lọc hồ sơ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'filter-content' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-sheet' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('uses fallback identity and handles profile loading errors', async () => {
    headerMocks.profileError = new Error('profile unavailable')
    headerMocks.roles = []
    renderHeader(Header, { userName: '', roleName: '' })

    expect(screen.getByTestId('account-dropdown')).toHaveTextContent('U||Nhân viên|/staff/profile')
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(
      'Error loading header profile',
      headerMocks.profileError,
    ))
  })
})

describe('AdminHeader', () => {
  beforeEach(() => {
    headerMocks.roles = ['ADMIN']
    headerMocks.profileData = { fullName: 'System Administrator', roles: ['ADMIN'] }
    headerMocks.profileError = null
    headerMocks.notifications = []
    headerMocks.unreadCount = 0
    headerMocks.pendingExamCount = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads the administrator profile and dispatches its sidebar event', async () => {
    const listener = vi.fn()
    window.addEventListener('admin-sidebar-toggle', listener)
    renderHeader(AdminHeader, { title: 'Quản trị' })

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu điều hướng' }))
    expect(listener).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByTestId('account-dropdown')).toHaveTextContent(
        'A|System Administrator|Quản lý cấp Bệnh Viện|/admin/profile',
      )
    })
    window.removeEventListener('admin-sidebar-toggle', listener)
  })

  it('resolves admin and manager breadcrumb fallback branches', () => {
    const labels = [
      'Đánh giá', 'Quy tắc phân loại', 'Bộ câu hỏi', 'Danh mục câu hỏi',
      'Ngân hàng câu hỏi', 'Cấu hình đề', 'Tạo câu hỏi từ tài liệu',
      'Quy trình', 'Đào tạo', 'Lịch sử', 'Nhân sự', 'Phòng ban',
      'Cấu hình hệ thống', 'Thông báo', 'Mẫu email', 'Trang chủ',
      'Không khớp', 'Hiện tại',
    ]
    renderHeader(AdminHeader, { breadcrumbs: labels.map((label) => ({ label })) })

    expect(screen.getByRole('link', { name: 'Đánh giá' })).toHaveAttribute('href', '/admin/evaluation/question-documents')
    expect(screen.getByRole('link', { name: 'Quy trình' })).toHaveAttribute('href', '/admin/quality/checklists')
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/admin/dashboard')
    expect(screen.queryByRole('link', { name: 'Không khớp' })).not.toBeInTheDocument()
  })

  it('supports explicit breadcrumb links and a back control', () => {
    renderHeader(AdminHeader, {
      back: { label: 'Quay lại danh sách' },
      breadcrumbs: [
        { label: 'Liên kết', link: '/explicit-link' },
        { label: 'Đường dẫn', path: '/explicit-path' },
        { label: 'Route', route: '/explicit-route' },
        { label: 'Hiện tại' },
      ],
    })

    expect(screen.getByRole('button', { name: 'Quay lại danh sách' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Liên kết' })).toHaveAttribute('href', '/explicit-link')
    expect(screen.getByRole('link', { name: 'Đường dẫn' })).toHaveAttribute('href', '/explicit-path')
    expect(screen.getByRole('link', { name: 'Route' })).toHaveAttribute('href', '/explicit-route')
  })

  it('renders all notification types and supports mark actions', () => {
    headerMocks.notifications = notificationSamples
    headerMocks.unreadCount = 4
    headerMocks.pendingExamCount = 105
    renderHeader(AdminHeader)

    expect(screen.getByRole('link', { name: '105 bài kiểm tra chưa làm' })).toHaveTextContent('99+')
    const toggle = screen.getByRole('button', { name: 'Thông báo, 4 chưa đọc' })
    fireEvent.click(toggle)

    const popover = screen.getByText('Thông báo').closest('.notify-popover')
    expect(popover.querySelectorAll('[class*="notify-item__icon-wrapper--"]')).toHaveLength(4)
    fireEvent.click(within(popover).getByText('Thông tin').closest('button'))
    expect(headerMocks.markAsRead).toHaveBeenCalledWith(4)
    fireEvent.click(within(popover).getByRole('button', { name: 'Đọc tất cả' }))
    expect(headerMocks.markAllAsRead).toHaveBeenCalled()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Thông tin')).not.toBeInTheDocument()
  })

  it('renders empty notifications, mobile filters and default administrator identity', () => {
    headerMocks.profileData = null
    headerMocks.roles = []
    const onToggle = vi.fn()
    const onClose = vi.fn()
    renderHeader(AdminHeader, {
      mobileSearch: {
        activeCount: 1,
        isOpen: true,
        title: 'Bộ lọc quản trị',
        onToggle,
        onClose,
        renderContent: () => <span>admin-filter-content</span>,
      },
    })

    expect(screen.getByTestId('account-dropdown')).toHaveTextContent('A||Quản lý cấp Bệnh Viện|/admin/profile')
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
    expect(screen.getByText('Không có thông báo mới nào')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mở tìm kiếm và bộ lọc, 1 điều kiện đang chọn' }))
    expect(onToggle).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Bộ lọc quản trị' })).toHaveTextContent('admin-filter-content')
  })

  it('logs profile errors without breaking the title', async () => {
    headerMocks.profileError = new Error('admin profile unavailable')
    renderHeader(AdminHeader, { title: 'Tiêu đề an toàn' })

    expect(screen.getByRole('heading', { name: 'Tiêu đề an toàn' })).toBeInTheDocument()
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(
      'Error loading admin header profile',
      headerMocks.profileError,
    ))
  })
})
