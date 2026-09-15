import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailTemplatesListPage from './EmailTemplatesListPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({ getEmailTemplates: vi.fn(), deleteEmailTemplate: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Không xóa</button>
      <button onClick={onConfirm}>Xác nhận xóa</button>
    </div>
  ) : null,
}))
vi.mock('../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset }) => (
    <>
      <button onClick={onApply}>Áp dụng</button>
      <button onClick={onReset}>Xóa bộ lọc</button>
    </>
  ),
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options }) => (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))

const template = (id, overrides = {}) => ({
  id, name: `Mẫu ${id}`, code: `TPL_${id}`, category: 'TRAINING',
  triggerLabel: 'Trước hạn 7 ngày', active: true, deletable: true, ...overrides,
})

const listResponse = (content, overrides = {}) => ({
  data: { data: { content, totalElements: content.length, totalPages: 1, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getEmailTemplates.mockResolvedValue(listResponse([
    template(1),
    template(2, { name: 'Mẫu hệ thống', category: 'EVALUATION', active: false, deletable: false }),
    template(3, { name: 'Mẫu lạ', category: 'UNKNOWN_CATEGORY' }),
  ]))
  api.deleteEmailTemplate.mockResolvedValue({ data: { success: true } })
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async () => {
  render(<EmailTemplatesListPage />)
  await screen.findByText('Mẫu 1')
}
const searchBox = () => screen.getByLabelText('Tìm mẫu email')
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))

describe('EmailTemplatesListPage - danh sách', () => {
  it('tải và hiển thị mẫu email kèm nhãn danh mục tiếng Việt', async () => {
    render(<EmailTemplatesListPage />)
    expect(screen.getByText(/Đang tải danh sách biểu mẫu/)).toBeInTheDocument()

    await screen.findByText('Mẫu 1')
    expect(api.getEmailTemplates).toHaveBeenCalledWith({
      page: 0, size: 10, sort: 'updatedAt,desc', q: undefined, category: undefined, active: undefined,
    })
    expect(screen.getByText('TPL_1')).toBeInTheDocument()
    expect(screen.getByText('Đào tạo')).toBeInTheDocument()
    expect(screen.getByText('Đánh giá')).toBeInTheDocument()
    // danh mục lạ giữ nguyên mã
    expect(screen.getByText('UNKNOWN_CATEGORY')).toBeInTheDocument()
    expect(screen.getByText('3 kết quả')).toBeInTheDocument()
  })

  it('hiển thị đúng huy hiệu trạng thái', async () => {
    await renderPage()
    expect(within(screen.getByRole('table')).getAllByText('Hoạt động')).toHaveLength(2)
    expect(within(screen.getByRole('table')).getByText('Ngừng')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có mẫu nào', async () => {
    api.getEmailTemplates.mockResolvedValue(listResponse([]))
    render(<EmailTemplatesListPage />)
    expect(await screen.findByText('Không tìm thấy biểu mẫu email phù hợp.')).toBeInTheDocument()
    expect(screen.queryByText(/Hiển thị/)).not.toBeInTheDocument()
  })

  it('chịu được phản hồi thiếu trường', async () => {
    api.getEmailTemplates.mockResolvedValue({ data: { data: null } })
    render(<EmailTemplatesListPage />)
    expect(await screen.findByText('Không tìm thấy biểu mẫu email phù hợp.')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải danh sách thất bại', async () => {
    api.getEmailTemplates.mockRejectedValue(new Error('down'))
    render(<EmailTemplatesListPage />)
    expect(await screen.findByText('Không thể tải danh sách biểu mẫu email.')).toBeInTheDocument()
  })

  it('điều hướng sang trang tạo mới và trang chỉnh sửa', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tạo mới biểu mẫu/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/notifications/email-templates/new')

    fireEvent.click(screen.getByLabelText('Chỉnh sửa mẫu email Mẫu 1'))
    expect(navigate).toHaveBeenCalledWith('/admin/notifications/email-templates/1')
  })
})

describe('EmailTemplatesListPage - tìm kiếm và lọc', () => {
  it('tìm theo từ khoá sau debounce 350ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<EmailTemplatesListPage />)
      await screen.findByText('Mẫu 1')

      fireEvent.change(searchBox(), { target: { value: '  nhắc hạn  ' } })
      act(() => void vi.advanceTimersByTime(350))
      await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'nhắc hạn' })))

      fireEvent.change(searchBox(), { target: { value: '   ' } })
      act(() => void vi.advanceTimersByTime(350))
      await waitFor(() => expect(api.getEmailTemplates.mock.calls.at(-1)[0].q).toBeUndefined())
    } finally {
      vi.useRealTimers()
    }
  })

  it('lọc theo danh mục và trạng thái', async () => {
    await renderPage()
    openFilters()

    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'QUALITY' } })
    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'QUALITY' })))

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } })
    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ active: true })))

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'INACTIVE' } })
    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ active: false })))

    expect(within(screen.getByRole('button', { name: /Bộ lọc/ })).getByText('2')).toBeInTheDocument()
  })

  it('mở và đóng bảng lọc', async () => {
    await renderPage()
    openFilters()
    expect(screen.getByRole('button', { name: /Bộ lọc/ })).toHaveAttribute('aria-expanded', 'true')

    openFilters()
    expect(screen.queryByLabelText('Danh mục')).not.toBeInTheDocument()
  })

  it('nút Áp dụng tải lại danh sách', async () => {
    await renderPage()
    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenCalledTimes(2))
  })

  it('xoá bộ lọc trả mọi tham số về mặc định', async () => {
    await renderPage()
    openFilters()
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'QUALITY' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({
      category: undefined, active: undefined,
    })))
    expect(searchBox()).toHaveValue('')
  })
})

describe('EmailTemplatesListPage - xoá mẫu email', () => {
  it('hỏi xác nhận rồi xoá và tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa mẫu email Mẫu 1'))

    const dialog = screen.getByRole('dialog', { name: 'Xóa biểu mẫu email' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(api.deleteEmailTemplate).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Xoá biểu mẫu email thành công!', 'success')
    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenCalledTimes(2))
  })

  it('không xoá khi người dùng huỷ', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa mẫu email Mẫu 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Không xóa' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.deleteEmailTemplate).not.toHaveBeenCalled()
  })

  it('khoá nút xoá với biểu mẫu hệ thống', async () => {
    await renderPage()
    const button = screen.getByLabelText('Xóa mẫu email Mẫu hệ thống')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Biểu mẫu hệ thống không thể xoá')
  })

  it('báo lỗi khi xoá thất bại', async () => {
    api.deleteEmailTemplate.mockRejectedValue({ response: { data: { message: 'Mẫu đang được dùng' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa mẫu email Mẫu 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mẫu đang được dùng', 'error'))
  })

  it('dùng thông báo mặc định khi lỗi xoá không có nội dung', async () => {
    api.deleteEmailTemplate.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa mẫu email Mẫu 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể xoá biểu mẫu email.', 'error'))
  })
})

describe('EmailTemplatesListPage - phân trang', () => {
  it('chuyển trang tiến và lùi', async () => {
    api.getEmailTemplates.mockResolvedValue(listResponse([template(1)], { totalElements: 25, totalPages: 3 }))
    await renderPage()

    expect(screen.getByText('1/3')).toBeInTheDocument()
    const [prev, , next] = document.querySelectorAll('.etl-pn')
    expect(prev).toBeDisabled()

    fireEvent.click(next)
    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))

    fireEvent.click(document.querySelectorAll('.etl-pn')[0])
    await waitFor(() => expect(api.getEmailTemplates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 })))
  })

  it('vô hiệu nút tiến ở trang cuối', async () => {
    api.getEmailTemplates.mockResolvedValue(listResponse([template(1)], { totalElements: 3, totalPages: 1 }))
    await renderPage()
    expect(document.querySelectorAll('.etl-pn')[2]).toBeDisabled()
  })

  it('hiện ít nhất một trang khi backend trả về 0 trang', async () => {
    api.getEmailTemplates.mockResolvedValue(listResponse([template(1)], { totalElements: 1, totalPages: 0 }))
    await renderPage()
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })
})
