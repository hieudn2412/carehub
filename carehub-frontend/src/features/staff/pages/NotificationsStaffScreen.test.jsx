import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationsStaffScreen from './NotificationsStaffScreen.jsx'

const showToast = vi.fn()
const publishNotificationStateChange = vi.fn()
const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, onClick, ...rest }) => <a href={to} onClick={onClick} {...rest}>{children}</a>,
}))
vi.mock('../api/notificationsApi.js', () => ({ notificationsApi: api }))
vi.mock('../hooks/useNotifications.js', () => ({
  publishNotificationStateChange: (...args) => publishNotificationStateChange(...args),
}))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))
vi.mock('../../../shared/components/EmptyState.jsx', () => ({ default: ({ children }) => <p>{children}</p> }))

const notification = (index, overrides = {}) => ({
  id: index,
  title: `Thông báo ${index}`,
  content: `Nội dung thông báo ${index}`,
  type: 'INFO',
  read: false,
  createdAt: '2026-08-25T09:30:00Z',
  deepLink: null,
  ...overrides,
})

const listResponse = (content, overrides = {}) => ({
  data: { data: { content, totalPages: 1, totalElements: content.length, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.list.mockResolvedValue(listResponse([
    notification(1),
    notification(2, { read: true, type: 'SUCCESS' }),
  ]))
  api.get.mockResolvedValue({ data: { data: notification(1, { content: 'Nội dung đầy đủ' }) } })
  api.markAsRead.mockResolvedValue({ data: { success: true } })
  api.markAllAsRead.mockResolvedValue({ data: { success: true } })
  api.delete.mockResolvedValue({ data: { success: true } })
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async () => {
  render(<NotificationsStaffScreen />)
  await screen.findByText('Thông báo 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm kiếm thông báo...')
const cardOf = (title) => screen.getByText(title).closest('.notify-item-card')

describe('NotificationsStaffScreen - danh sách', () => {
  it('tải và hiển thị thông báo với thời gian đã định dạng', async () => {
    render(<NotificationsStaffScreen />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách thông báo...')

    await screen.findByText('Thông báo 1')
    expect(api.list).toHaveBeenCalledWith({ page: 0, size: 10, sort: 'createdAt,desc', q: undefined })
    expect(screen.getByText('Nội dung thông báo 1')).toBeInTheDocument()
    expect(screen.getAllByText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toHaveLength(2)
    expect(cardOf('Thông báo 1').className).toContain('notify-item-card--unread')
    expect(cardOf('Thông báo 2').className).not.toContain('notify-item-card--unread')
  })

  it('hiện thông báo rỗng khi không có dữ liệu', async () => {
    api.list.mockResolvedValue(listResponse([]))
    render(<NotificationsStaffScreen />)
    expect(await screen.findByText('Không có thông báo nào được tìm thấy.')).toBeInTheDocument()
  })

  it('chịu được phản hồi thiếu trường', async () => {
    api.list.mockResolvedValue({ data: { data: null } })
    render(<NotificationsStaffScreen />)
    expect(await screen.findByText('Không có thông báo nào được tìm thấy.')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải danh sách thất bại', async () => {
    api.list.mockRejectedValue(new Error('down'))
    render(<NotificationsStaffScreen />)
    expect(await screen.findByText('Không thể tải danh sách thông báo. Vui lòng thử lại sau.')).toBeInTheDocument()
  })

  it.each([
    ['DANGER', 'notify-icon-box--danger'],
    ['WARNING', 'notify-icon-box--warning'],
    ['SUCCESS', 'notify-icon-box--success'],
    ['INFO', 'notify-icon-box--info'],
    [null, 'notify-icon-box--info'],
  ])('gắn đúng biểu tượng cho loại %s', async (type, expectedClass) => {
    api.list.mockResolvedValue(listResponse([notification(1, { type })]))
    render(<NotificationsStaffScreen />)
    await screen.findByText('Thông báo 1')

    expect(cardOf('Thông báo 1').querySelector('.notify-icon-box').className).toContain(expectedClass)
  })

  it('giữ nguyên chuỗi thời gian không hợp lệ và bỏ trống khi thiếu', async () => {
    api.list.mockResolvedValue(listResponse([
      notification(1, { createdAt: 'không phải ngày' }),
      notification(2, { createdAt: null }),
    ]))
    render(<NotificationsStaffScreen />)
    await screen.findByText('Thông báo 1')

    expect(screen.getByText('không phải ngày')).toBeInTheDocument()
  })
})

describe('NotificationsStaffScreen - tab và tìm kiếm', () => {
  it('lọc theo tab chưa đọc và đã đọc', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Chưa đọc' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ read: false })))

    fireEvent.click(screen.getByRole('button', { name: 'Đã đọc' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ read: true })))

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }))
    await waitFor(() => expect(api.list.mock.calls.at(-1)[0].read).toBeUndefined())
  })

  it('tìm kiếm sau debounce 500ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<NotificationsStaffScreen />)
      await screen.findByText('Thông báo 1')

      fireEvent.change(searchBox(), { target: { value: '  đào tạo  ' } })
      act(() => void vi.advanceTimersByTime(500))
      await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'đào tạo' })))

      fireEvent.change(searchBox(), { target: { value: '   ' } })
      act(() => void vi.advanceTimersByTime(500))
      await waitFor(() => expect(api.list.mock.calls.at(-1)[0].q).toBeUndefined())
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('NotificationsStaffScreen - đánh dấu đã đọc', () => {
  it('đánh dấu một thông báo là đã đọc', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Thông báo 1')).getByTitle('Đánh dấu đã đọc'))

    await waitFor(() => expect(api.markAsRead).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã đánh dấu là đã đọc.', 'success')
    expect(publishNotificationStateChange).toHaveBeenCalledWith({ readId: 1, decrementUnreadBy: 1 })
    expect(cardOf('Thông báo 1').className).not.toContain('notify-item-card--unread')
  })

  it('tải lại danh sách khi đánh dấu đã đọc thất bại', async () => {
    api.markAsRead.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(within(cardOf('Thông báo 1')).getByTitle('Đánh dấu đã đọc'))

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    expect(publishNotificationStateChange).toHaveBeenCalledWith({ refresh: true })
  })

  it('ẩn nút đánh dấu với thông báo đã đọc', async () => {
    await renderPage()
    expect(within(cardOf('Thông báo 2')).queryByTitle('Đánh dấu đã đọc')).not.toBeInTheDocument()
  })

  it('đánh dấu tất cả là đã đọc', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Đánh dấu đã đọc tất cả/ }))

    await waitFor(() => expect(api.markAllAsRead).toHaveBeenCalled())
    expect(showToast).toHaveBeenCalledWith('Đã đánh dấu đọc tất cả thông báo.', 'success')
    expect(publishNotificationStateChange).toHaveBeenCalledWith({ markAllRead: true, unreadCount: 0 })
    expect(screen.queryByRole('button', { name: /Đánh dấu đã đọc tất cả/ })).not.toBeInTheDocument()
  })

  it('tải lại danh sách khi đánh dấu tất cả thất bại', async () => {
    api.markAllAsRead.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Đánh dấu đã đọc tất cả/ }))

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    expect(publishNotificationStateChange).toHaveBeenCalledWith({ refresh: true })
  })

  it('ẩn nút đánh dấu tất cả khi không còn thông báo chưa đọc', async () => {
    api.list.mockResolvedValue(listResponse([notification(1, { read: true })]))
    render(<NotificationsStaffScreen />)
    await screen.findByText('Thông báo 1')

    expect(screen.queryByRole('button', { name: /Đánh dấu đã đọc tất cả/ })).not.toBeInTheDocument()
  })
})

describe('NotificationsStaffScreen - xoá thông báo', () => {
  it('xoá thông báo khỏi danh sách', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Thông báo 1')).getByTitle('Xóa thông báo'))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã xóa thông báo thành công.', 'success')
    expect(screen.queryByText('Thông báo 1')).not.toBeInTheDocument()
    expect(publishNotificationStateChange).toHaveBeenCalledWith({ readId: 1, decrementUnreadBy: 1 })
  })

  it('không giảm số chưa đọc khi xoá thông báo đã đọc', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Thông báo 2')).getByTitle('Xóa thông báo'))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(2))
    expect(publishNotificationStateChange).not.toHaveBeenCalledWith({ readId: 2, decrementUnreadBy: 1 })
  })

  it('khôi phục danh sách khi xoá thất bại', async () => {
    api.delete.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(within(cardOf('Thông báo 1')).getByTitle('Xóa thông báo'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể xóa thông báo.', 'error'))
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(publishNotificationStateChange).toHaveBeenCalledWith({ refresh: true })
  })
})

describe('NotificationsStaffScreen - chi tiết thông báo', () => {
  it('mở chi tiết, tải bản đầy đủ và tự đánh dấu đã đọc', async () => {
    await renderPage()
    fireEvent.click(cardOf('Thông báo 1'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Nội dung đầy đủ')).toBeInTheDocument()
    await waitFor(() => expect(api.markAsRead).toHaveBeenCalledWith(1))
    // đánh dấu ngầm nên không hiện toast
    expect(showToast).not.toHaveBeenCalledWith('Đã đánh dấu là đã đọc.', 'success')
  })

  it('không đánh dấu lại thông báo đã đọc', async () => {
    api.get.mockResolvedValue({ data: { data: notification(2, { read: true }) } })
    await renderPage()
    fireEvent.click(cardOf('Thông báo 2'))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(2))
    expect(api.markAsRead).not.toHaveBeenCalled()
  })

  it('vẫn hiển thị dữ liệu cũ khi máy chủ không trả về bản mới', async () => {
    api.get.mockResolvedValue({ data: { data: null } })
    await renderPage()
    fireEvent.click(cardOf('Thông báo 1'))

    expect(await screen.findByText('Nội dung thông báo 1', { selector: '.notify-modal-content' })).toBeInTheDocument()
  })

  it('báo lỗi khi tải chi tiết thất bại', async () => {
    api.get.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(cardOf('Thông báo 1'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể tải chi tiết thông báo.', 'error'))
  })

  it('hiện trạng thái đang tải chi tiết', async () => {
    let resolveDetail
    api.get.mockReturnValue(new Promise((resolve) => { resolveDetail = resolve }))
    await renderPage()
    fireEvent.click(cardOf('Thông báo 1'))

    expect(await screen.findByText('Đang tải chi tiết thông báo...')).toBeInTheDocument()
    await act(async () => { resolveDetail({ data: { data: notification(1) } }) })
  })

  it('hiện liên kết đi tới trang liên quan', async () => {
    api.get.mockResolvedValue({ data: { data: notification(1, { deepLink: '/staff/training/55', read: true }) } })
    await renderPage()
    fireEvent.click(cardOf('Thông báo 1'))

    const link = await screen.findByRole('link', { name: /Xem chi tiết/ })
    expect(link).toHaveAttribute('href', '/staff/training/55')
    fireEvent.click(link)
    await waitFor(() => expect(screen.queryByRole('link', { name: /Xem chi tiết/ })).not.toBeInTheDocument())
  })

  it('ẩn liên kết khi thông báo không có deepLink', async () => {
    await renderPage()
    fireEvent.click(cardOf('Thông báo 1'))
    await screen.findByText('Nội dung đầy đủ')

    expect(screen.queryByRole('link', { name: /Xem chi tiết/ })).not.toBeInTheDocument()
  })

  it('đóng chi tiết bằng nút Đóng, nút X và click ra nền', async () => {
    await renderPage()
    const open = async () => {
      fireEvent.click(cardOf('Thông báo 2'))
      return screen.findByText('Nội dung đầy đủ')
    }
    api.get.mockResolvedValue({ data: { data: notification(2, { content: 'Nội dung đầy đủ', read: true }) } })

    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    await waitFor(() => expect(screen.queryByText('Nội dung đầy đủ')).not.toBeInTheDocument())

    await open()
    fireEvent.click(document.querySelector('.notify-modal-close'))
    await waitFor(() => expect(screen.queryByText('Nội dung đầy đủ')).not.toBeInTheDocument())

    await open()
    fireEvent.click(document.querySelector('.notify-modal-overlay'))
    await waitFor(() => expect(screen.queryByText('Nội dung đầy đủ')).not.toBeInTheDocument())
  })

  it('không đóng khi bấm vào bên trong hộp thoại', async () => {
    api.get.mockResolvedValue({ data: { data: notification(2, { content: 'Nội dung đầy đủ', read: true }) } })
    await renderPage()
    fireEvent.click(cardOf('Thông báo 2'))
    await screen.findByText('Nội dung đầy đủ')

    fireEvent.click(document.querySelector('.notify-modal-container'))
    expect(screen.getByText('Nội dung đầy đủ')).toBeInTheDocument()
  })
})

describe('NotificationsStaffScreen - phân trang', () => {
  beforeEach(() => {
    api.list.mockResolvedValue(listResponse([notification(1)], { totalPages: 3, totalElements: 25 }))
  })

  it('chuyển trang bằng số trang và nút tiến/lùi', async () => {
    await renderPage()
    expect(screen.getByText('Hiển thị 1 trong số 25 thông báo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
  })

  it('vô hiệu nút lùi ở trang đầu và nút tiến ở trang cuối', async () => {
    await renderPage()
    const buttons = document.querySelectorAll('.training-page-btn')
    expect(buttons[0]).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    expect(document.querySelectorAll('.training-page-btn')[4]).toBeDisabled()
  })

  it('ẩn phân trang khi chỉ có một trang', async () => {
    api.list.mockResolvedValue(listResponse([notification(1)]))
    render(<NotificationsStaffScreen />)
    await screen.findByText('Thông báo 1')
    expect(screen.queryByText(/Hiển thị 1 trong số/)).not.toBeInTheDocument()
  })
})
