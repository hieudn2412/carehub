import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerChecklistListPage from './ManagerChecklistListPage.jsx'

const navigate = vi.fn()
const route = { pathname: '/manager/quality/checklists' }
const api = vi.hoisted(() => ({ getAssignedForms: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: route.pathname }),
}))
vi.mock('../../api/staffApi.js', () => ({ staffApi: api }))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../../shared/components/Modal.jsx', () => ({
  default: ({ title, children, footer, onClose }) => (
    <div role="dialog" aria-label={title}>
      {children}
      {footer}
      <button onClick={onClose}>Đóng hộp thoại</button>
    </div>
  ),
}))

const checklist = (id, overrides = {}) => ({
  assignmentItemId: id,
  formCode: `QT-${id}`,
  title: `Quy trình ${id}`,
  version: { versionNumber: 2 },
  validFrom: '2026-08-01T03:00:00Z',
  validUntil: '2026-12-31T03:00:00Z',
  allDepartments: false,
  allowedDepartments: [{ departmentId: 3, departmentName: 'Khoa Ngoại' }, { departmentId: 4, departmentName: null }],
  ...overrides,
})

const listResponse = (content) => ({ data: { data: { content } } })

beforeEach(() => {
  vi.clearAllMocks()
  route.pathname = '/manager/quality/checklists'
  api.getAssignedForms.mockResolvedValue(listResponse([
    checklist(1),
    checklist(2, { title: 'Quy trình toàn viện', allDepartments: true, version: null, versionNumber: 5, validFrom: null, validUntil: null }),
  ]))
})

const renderPage = async () => {
  render(<ManagerChecklistListPage />)
  await screen.findByText('Quy trình 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm quy trình...')
const cardOf = (title) => screen.getByText(title).closest('.mgr-checklist-card')

describe('ManagerChecklistListPage - danh sách', () => {
  it('tải và hiển thị thẻ quy trình được giao', async () => {
    render(<ManagerChecklistListPage />)
    expect(screen.getByText(/Đang tải quy trình được giao/)).toBeInTheDocument()

    await screen.findByText('Quy trình 1')
    expect(api.getAssignedForms).toHaveBeenCalledWith({ page: 0, size: 100, sort: 'id,desc' })
    expect(screen.getByText('QT-1')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getAllByText('Đang hiệu lực')).toHaveLength(2)
    expect(screen.getByText('2 khoa/phòng')).toBeInTheDocument()
    expect(screen.getByText('Tất cả khoa/phòng')).toBeInTheDocument()
  })

  it('lấy số phiên bản từ trường thay thế', async () => {
    await renderPage()
    expect(screen.getByText('v5')).toBeInTheDocument()
  })

  it('ẩn huy hiệu phiên bản khi không có thông tin', async () => {
    api.getAssignedForms.mockResolvedValue(listResponse([
      checklist(1, { version: null, versionNumber: null, formVersionNumber: null }),
    ]))
    await renderPage()
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument()
  })

  it('lấy số phiên bản từ formVersionNumber', async () => {
    api.getAssignedForms.mockResolvedValue(listResponse([
      checklist(1, { version: null, versionNumber: null, formVersionNumber: 9 }),
    ]))
    await renderPage()
    expect(screen.getByText('v9')).toBeInTheDocument()
  })

  it('hiện Không giới hạn khi thiếu mốc hiệu lực', async () => {
    await renderPage()
    const card = cardOf('Quy trình toàn viện')
    expect(within(card).getAllByText(/Không giới hạn/)).toHaveLength(2)
  })

  it('giữ nguyên chuỗi thời gian không đọc được', async () => {
    api.getAssignedForms.mockResolvedValue(listResponse([checklist(1, { validFrom: 'không phải ngày' })]))
    await renderPage()
    expect(screen.getByText(/không phải ngày|Invalid Date/)).toBeInTheDocument()
  })

  it('hiện thông báo khi chưa được giao quy trình nào', async () => {
    api.getAssignedForms.mockResolvedValue(listResponse([]))
    render(<ManagerChecklistListPage />)

    expect(await screen.findByText('Chưa có quy trình được giao')).toBeInTheDocument()
    expect(screen.getByText(/sau khi Admin giao đánh giá/)).toBeInTheDocument()
  })

  it('chịu được phản hồi thiếu mảng content', async () => {
    api.getAssignedForms.mockResolvedValue({ data: { data: {} } })
    render(<ManagerChecklistListPage />)
    expect(await screen.findByText('Chưa có quy trình được giao')).toBeInTheDocument()
  })

  it('điều hướng sang trang thực hiện đánh giá của quản lý', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Quy trình 1')).getByRole('button', { name: /Thực hiện đánh giá/ }))
    expect(navigate).toHaveBeenCalledWith('/manager/quality/checklists/1/evaluate')
  })

  it('điều hướng sang đường dẫn nhân viên khi ở luồng staff', async () => {
    route.pathname = '/staff/checklists'
    await renderPage()
    fireEvent.click(within(cardOf('Quy trình 1')).getByRole('button', { name: /Thực hiện đánh giá/ }))
    expect(navigate).toHaveBeenCalledWith('/staff/checklists/1/evaluate')
  })
})

describe('ManagerChecklistListPage - lỗi và tải lại', () => {
  it.each([
    [401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'],
    [403, 'Tài khoản hiện tại không có quyền xem quy trình được giao.'],
    [500, 'Không thể tải danh sách checklist được phân quyền. Vui lòng thử lại.'],
  ])('hiện thông báo riêng cho lỗi %i', async (status, message) => {
    api.getAssignedForms.mockRejectedValue({ response: { status } })
    render(<ManagerChecklistListPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('hiện lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.getAssignedForms.mockRejectedValue(new Error('down'))
    render(<ManagerChecklistListPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối đến máy chủ')
  })

  it('tải lại danh sách từ nút trong thông báo lỗi', async () => {
    api.getAssignedForms.mockRejectedValueOnce(new Error('down'))
    render(<ManagerChecklistListPage />)
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
    await screen.findByText('Quy trình 1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('tải lại danh sách bằng nút trên thanh công cụ', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Tải lại danh sách'))
    await waitFor(() => expect(api.getAssignedForms).toHaveBeenCalledTimes(2))
  })
})

describe('ManagerChecklistListPage - tìm kiếm', () => {
  it('tìm theo tên và mã quy trình', async () => {
    await renderPage()

    fireEvent.change(searchBox(), { target: { value: 'toàn viện' } })
    await waitFor(() => expect(screen.queryByText('Quy trình 1')).not.toBeInTheDocument())

    fireEvent.change(searchBox(), { target: { value: 'qt-1' } })
    expect(await screen.findByText('Quy trình 1')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: '   ' } })
    expect(await screen.findByText('Quy trình toàn viện')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    expect(await screen.findByText('Chưa có quy trình được giao')).toBeInTheDocument()
  })
})

describe('ManagerChecklistListPage - phạm vi khoa/phòng', () => {
  it('mở hộp thoại liệt kê khoa được phân quyền', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Quy trình 1')).getByRole('button', { name: '2 khoa/phòng' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/2 khoa/)).toBeInTheDocument()
    expect(within(dialog).getByText('Khoa Ngoại')).toBeInTheDocument()
    // thiếu tên thì rơi về mã khoa
    expect(within(dialog).getByText('Khoa #4')).toBeInTheDocument()
  })

  it('hiện thông báo áp dụng toàn viện', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Quy trình toàn viện')).getByRole('button', { name: 'Tất cả khoa/phòng' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Áp dụng cho tất cả khoa/phòng')).toBeInTheDocument()
  })

  it('coi danh sách khoa rỗng là toàn viện', async () => {
    api.getAssignedForms.mockResolvedValue(listResponse([
      checklist(1, { allDepartments: false, allowedDepartments: [] }),
    ]))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả khoa/phòng' }))

    expect(within(screen.getByRole('dialog')).getByText('Áp dụng cho tất cả khoa/phòng')).toBeInTheDocument()
  })

  it('đóng hộp thoại bằng nút Đóng', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Quy trình 1')).getByRole('button', { name: '2 khoa/phòng' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đóng' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('đổi màu nút phạm vi khi rê chuột', async () => {
    await renderPage()
    const button = within(cardOf('Quy trình 1')).getByRole('button', { name: '2 khoa/phòng' })

    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe('rgb(204, 251, 241)')
    fireEvent.mouseLeave(button)
    expect(button.style.background).toBe('rgb(240, 253, 249)')
  })
})
