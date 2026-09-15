import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sidebarMocks = vi.hoisted(() => ({
  roles: ['USER'],
  permissionAllowed: true,
  assignedResponse: { data: { data: { totalElements: 4 } } },
  assignedError: null,
  logoutError: null,
}))

vi.mock('./staff/api/staffApi.js', () => ({
  staffApi: {
    getAssignedForms: vi.fn(async () => {
      if (sidebarMocks.assignedError) throw sidebarMocks.assignedError
      return sidebarMocks.assignedResponse
    }),
  },
}))

vi.mock('./auth/services/logoutUser.js', () => ({
  logoutUser: vi.fn(async () => {
    if (sidebarMocks.logoutError) throw sidebarMocks.logoutError
  }),
}))

vi.mock('../shared/auth/tokenStorage.js', () => ({
  tokenStorage: { getAccessToken: () => 'access-token' },
}))

vi.mock('../shared/auth/jwt.js', () => ({
  getRolesFromAccessToken: () => sidebarMocks.roles,
}))

vi.mock('./auth/utils/authNavigation.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    hasAnyRole: (roles, allowedRoles) => roles.some((role) => allowedRoles.includes(role)),
  }
})

vi.mock('./evaluation/utils/evaluationPermissions.js', () => ({
  EVALUATION_PERMISSION: {
    questionAuthor: 'question-author',
    questionReviewer: 'question-reviewer',
    examConfigManager: 'exam-config-manager',
    examPublisher: 'exam-publisher',
    assignmentManager: 'assignment-manager',
    resultViewer: 'result-viewer',
    auditViewer: 'audit-viewer',
  },
  getCurrentEvaluationAccess: () => ({
    hasAny: () => sidebarMocks.permissionAllowed,
  }),
}))

import Sidebar from './staff/components/sidebar.jsx'
import AdminSidebar from './admin/components/AdminSidebar.jsx'
import { logoutUser } from './auth/services/logoutUser.js'
import { staffApi } from './staff/api/staffApi.js'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="sidebar-location">{`${location.pathname}${location.search}`}</div>
}

function renderSidebar(Component, { path, props = {} }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Component {...props} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function dispatchToggle(eventName) {
  act(() => {
    window.dispatchEvent(new Event(eventName))
  })
}

function dispatchTransition(node, eventName = 'transitionend', propertyName = 'transform') {
  const event = new Event(eventName, { bubbles: true })
  Object.defineProperty(event, 'propertyName', { value: propertyName })
  fireEvent(node, event)
}

describe('staff Sidebar', () => {
  beforeEach(() => {
    sidebarMocks.roles = ['USER']
    sidebarMocks.assignedResponse = { data: { data: {} } }
    sidebarMocks.assignedError = null
    sidebarMocks.logoutError = null
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('renders staff navigation, restores assigned count and tracks scroll', async () => {
    sidebarMocks.assignedResponse = { data: { data: { totalElements: 4 } } }
    sessionStorage.setItem('staff-sidebar-scroll', '31')
    renderSidebar(Sidebar, { path: '/staff/training' })

    expect(screen.getByText('Nhân viên y tế')).toBeInTheDocument()
    expect(screen.getAllByText('Theo dõi cá nhân').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Đào tạo liên tục').some((node) => (
      node.closest('a')?.className.includes('sidebar__item--active')
    ))).toBe(true)

    await waitFor(() => expect(staffApi.getAssignedForms).toHaveBeenCalledWith({ page: 0, size: 1 }))
    await waitFor(() => expect(screen.getAllByText('4').length).toBeGreaterThan(0))

    const nav = screen.getByLabelText('Điều hướng chính').querySelector('.sidebar__nav')
    Object.defineProperty(nav, 'scrollTop', { configurable: true, value: 52, writable: true })
    fireEvent.scroll(nav)
    expect(sessionStorage.getItem('staff-sidebar-scroll')).toBe('52')
  })

  it('opens mobile navigation, searches without accents and navigates after transform', async () => {
    renderSidebar(Sidebar, {
      path: '/staff/dashboard',
      props: { alertSummary: { unreadCount: 2, pendingExamCount: 1 } },
    })

    dispatchToggle('staff-sidebar-toggle')

    const aside = screen.getByLabelText('Điều hướng chính')
    expect(aside).toHaveClass('sidebar--mobile-open')
    expect(document.body).toHaveClass('staff-sidebar-open')
    expect(screen.getByRole('button', { name: 'Đóng menu điều hướng' })).toBeInTheDocument()
    expect(screen.getAllByText('Cần xử lý').length).toBeGreaterThan(0)

    const search = screen.getByRole('searchbox', { name: 'Tìm chức năng' })
    fireEvent.change(search, { target: { value: 'dao tao' } })

    const mobileNav = screen.getByRole('navigation', { name: 'Chức năng của nhân viên' })
    expect(within(mobileNav).getByText('Đào tạo liên tục')).toBeInTheDocument()
    expect(within(mobileNav).queryByText('Dashboard')).not.toBeInTheDocument()

    fireEvent.click(within(mobileNav).getByText('Đào tạo liên tục').closest('a'))
    expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/staff/dashboard')

    dispatchTransition(aside, 'transitionend', 'opacity')
    expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/staff/dashboard')
    dispatchTransition(aside)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/staff/training')
    })
    expect(search).toHaveValue('')
    expect(document.body).not.toHaveClass('staff-sidebar-open')
  })

  it('shows empty search and closes with Escape after the transform finishes', async () => {
    renderSidebar(Sidebar, { path: '/staff/dashboard' })
    dispatchToggle('staff-sidebar-toggle')

    const aside = screen.getByLabelText('Điều hướng chính')
    const search = screen.getByRole('searchbox', { name: 'Tìm chức năng' })
    fireEvent.change(search, {
      target: { value: 'khong ton tai' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy chức năng phù hợp')

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(aside).toHaveClass('sidebar--mobile-open')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(aside).not.toHaveClass('sidebar--mobile-open')

    dispatchTransition(aside, 'transitionend', 'opacity')
    expect(search).toHaveValue('khong ton tai')
    dispatchTransition(aside)
    await waitFor(() => expect(search).toHaveValue(''))
  })

  it('closes from the backdrop and toggles desktop sections', async () => {
    renderSidebar(Sidebar, { path: '/staff/dashboard' })

    const sectionButton = screen.getAllByRole('button', { name: /Theo dõi cá nhân/i })[0]
    expect(sectionButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(sectionButton)
    expect(sectionButton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(sectionButton)
    expect(sectionButton).toHaveAttribute('aria-expanded', 'false')

    dispatchToggle('staff-sidebar-toggle')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng menu điều hướng' }))
    dispatchTransition(screen.getByLabelText('Điều hướng chính'))
    await waitFor(() => expect(document.body).not.toHaveClass('staff-sidebar-open'))
  })

  it('renders manager-only groups and excludes staff-only desktop items', () => {
    sidebarMocks.roles = ['MANAGER']
    renderSidebar(Sidebar, { path: '/manager/quality/history' })

    expect(screen.getByText('Trưởng khoa / Phòng')).toBeInTheDocument()
    expect(screen.getAllByText('Tuân thủ theo kỹ thuật').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kết quả năng lực chuyên môn').length).toBeGreaterThan(0)
  })

  it('logs out successfully and reports logout failures', async () => {
    const first = renderSidebar(Sidebar, { path: '/staff/dashboard' })
    fireEvent.click(screen.getAllByRole('button', { name: /Đăng xuất/i })[0])
    await waitFor(() => expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/auth/login'))
    expect(logoutUser).toHaveBeenCalled()
    first.unmount()

    sidebarMocks.logoutError = new Error('Phiên đăng xuất lỗi')
    renderSidebar(Sidebar, { path: '/staff/dashboard' })
    fireEvent.click(screen.getAllByRole('button', { name: /Đăng xuất/i })[0])
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Phiên đăng xuất lỗi'))
  })

  it('ignores failures while loading the assigned-form badge', async () => {
    sidebarMocks.assignedError = new Error('network')
    renderSidebar(Sidebar, { path: '/staff/dashboard' })

    await waitFor(() => expect(staffApi.getAssignedForms).toHaveBeenCalled())
    expect(screen.getByLabelText('Điều hướng chính')).toBeInTheDocument()
  })
})

describe('AdminSidebar', () => {
  beforeEach(() => {
    sidebarMocks.permissionAllowed = true
    sidebarMocks.logoutError = null
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('renders active admin navigation, switches groups and persists scroll', () => {
    sessionStorage.setItem('admin-sidebar-scroll', '28')
    renderSidebar(AdminSidebar, { path: '/admin/dashboard' })

    expect(screen.getByText('Quản trị hệ thống')).toBeInTheDocument()
    expect(screen.getAllByRole('tab', { name: /Quản lý/i })[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Dashboard').some((node) => (
      node.closest('a')?.className.includes('admin-sidebar__item--active')
    ))).toBe(true)

    fireEvent.click(screen.getAllByRole('tab', { name: /Hệ thống/i })[0])
    expect(screen.getAllByRole('tab', { name: /Hệ thống/i })[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Danh sách tài khoản').length).toBeGreaterThan(0)

    const nav = screen.getByLabelText('Điều hướng quản trị').querySelector('.admin-sidebar__nav')
    Object.defineProperty(nav, 'scrollTop', { configurable: true, value: 63, writable: true })
    fireEvent.scroll(nav)
    expect(sessionStorage.getItem('admin-sidebar-scroll')).toBe('63')
  })

  it('filters permission-protected entries', () => {
    sidebarMocks.permissionAllowed = false
    renderSidebar(AdminSidebar, { path: '/admin/dashboard' })

    expect(screen.queryByText('Tạo câu hỏi từ tài liệu')).not.toBeInTheDocument()
    expect(screen.queryByText('Audit đánh giá')).not.toBeInTheDocument()
    expect(screen.getAllByText('Bảng kiểm giám sát').length).toBeGreaterThan(0)
  })

  it('searches mobile entries without accents and navigates only after closing', async () => {
    renderSidebar(AdminSidebar, { path: '/admin/dashboard' })
    dispatchToggle('admin-sidebar-toggle')

    const aside = screen.getByLabelText('Điều hướng quản trị')
    expect(aside).toHaveClass('admin-sidebar--mobile-open')
    expect(document.body).toHaveClass('admin-sidebar-open')

    const search = screen.getByRole('searchbox', { name: 'Tìm chức năng quản trị' })
    fireEvent.change(search, { target: { value: 'gio dao tao' } })
    const mobileNav = screen.getByRole('navigation', { name: 'Chức năng quản trị' })
    fireEvent.click(within(mobileNav).getByText('Dashboard giờ đào tạo').closest('a'))

    expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/admin/dashboard')
    dispatchTransition(aside, 'transitionend', 'opacity')
    expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/admin/dashboard')
    dispatchTransition(aside)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/admin/reports/training-dashboard')
    })
    expect(search).toHaveValue('')
  })

  it('resets search when switching the mobile category and shows empty results', () => {
    renderSidebar(AdminSidebar, { path: '/admin/dashboard' })
    dispatchToggle('admin-sidebar-toggle')

    const search = screen.getByRole('searchbox', { name: 'Tìm chức năng quản trị' })
    fireEvent.change(search, { target: { value: 'khong co muc nay' } })
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy chức năng phù hợp')

    fireEvent.click(screen.getAllByRole('tab', { name: /Hệ thống/i })[0])
    expect(search).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('closes with Escape and toggles a desktop section', async () => {
    renderSidebar(AdminSidebar, { path: '/admin/dashboard' })

    const trigger = screen.getAllByRole('button', { name: /TỔNG QUAN/i })[0]
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    dispatchToggle('admin-sidebar-toggle')
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByLabelText('Điều hướng quản trị')).toHaveClass('admin-sidebar--mobile-open')
    fireEvent.keyDown(document, { key: 'Escape' })
    dispatchTransition(screen.getByLabelText('Điều hướng quản trị'))
    await waitFor(() => expect(document.body).not.toHaveClass('admin-sidebar-open'))
  })

  it('logs out and shows a fallback message when logout fails', async () => {
    const first = renderSidebar(AdminSidebar, { path: '/admin/dashboard' })
    fireEvent.click(screen.getAllByRole('button', { name: /Đăng xuất/i })[0])
    await waitFor(() => expect(screen.getByTestId('sidebar-location')).toHaveTextContent('/auth/login'))
    first.unmount()

    sidebarMocks.logoutError = {}
    renderSidebar(AdminSidebar, { path: '/admin/dashboard' })
    fireEvent.click(screen.getAllByRole('button', { name: /Đăng xuất/i })[0])
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Không thể đăng xuất. Vui lòng thử lại.')
    })
  })
})
