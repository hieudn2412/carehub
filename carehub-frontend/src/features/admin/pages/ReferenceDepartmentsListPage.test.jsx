import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReferenceDepartmentsListPage from './ReferenceDepartmentsListPage.jsx'

const showToast = vi.fn()
const api = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
}))

vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Không xóa</button>
      <button onClick={onConfirm}>Xác nhận xóa</button>
    </div>
  ) : null,
}))

const department = (index, overrides = {}) => ({
  id: index,
  departmentCode: `K-${index}`,
  name: `Khoa số ${index}`,
  employeeCount: index * 2,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getDepartments.mockResolvedValue({
    data: { data: [department(1), department(2, { name: 'Khoa Tim mạch', departmentCode: null, employeeCount: null })] },
  })
  api.createDepartment.mockResolvedValue({ data: { success: true } })
  api.updateDepartment.mockResolvedValue({ data: { success: true } })
  api.deleteDepartment.mockResolvedValue({ data: { success: true } })
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async () => {
  render(<ReferenceDepartmentsListPage />)
  await screen.findByText('Khoa số 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm theo tên phòng ban/khoa...')
const codeInput = () => screen.getByPlaceholderText('VD: K-TIMMACH')
const nameInput = () => screen.getByPlaceholderText('VD: Khoa Tim mạch')
const submitForm = () => fireEvent.submit(codeInput().closest('form'))
const rowOf = (name) => screen.getByText(name).closest('tr')

describe('ReferenceDepartmentsListPage - danh sách', () => {
  it('tải và hiển thị danh mục phòng ban', async () => {
    render(<ReferenceDepartmentsListPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh mục phòng ban...')

    await screen.findByText('Khoa số 1')
    expect(api.getDepartments).toHaveBeenCalled()
    expect(screen.getByText('K-1')).toBeInTheDocument()
    expect(within(rowOf('Khoa số 1')).getByText('2')).toBeInTheDocument()
    expect(screen.getByText('2 kết quả')).toBeInTheDocument()
  })

  it('điền gạch ngang cho mã trống và 0 cho số nhân viên thiếu', async () => {
    await renderPage()
    const row = rowOf('Khoa Tim mạch')
    expect(within(row).getByText('-')).toBeInTheDocument()
    expect(within(row).getByText('0')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có phòng ban', async () => {
    api.getDepartments.mockResolvedValue({ data: { data: [] } })
    render(<ReferenceDepartmentsListPage />)
    expect(await screen.findByText('Không tìm thấy phòng ban phù hợp.')).toBeInTheDocument()
    expect(screen.queryByText(/Hiển thị/)).not.toBeInTheDocument()
  })

  it('chịu được phản hồi không phải mảng', async () => {
    api.getDepartments.mockResolvedValue({ data: { data: { content: [] } } })
    render(<ReferenceDepartmentsListPage />)
    expect(await screen.findByText('Không tìm thấy phòng ban phù hợp.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải danh sách thất bại', async () => {
    api.getDepartments.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<ReferenceDepartmentsListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('dùng thông báo mặc định khi lỗi không có nội dung', async () => {
    api.getDepartments.mockRejectedValue(new Error('down'))
    render(<ReferenceDepartmentsListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể tải danh sách phòng ban.', 'error'))
  })

  it('tìm theo tên phòng ban', async () => {
    await renderPage()
    fireEvent.change(searchBox(), { target: { value: 'tim mạch' } })

    await waitFor(() => expect(screen.queryByText('Khoa số 1')).not.toBeInTheDocument())
    expect(screen.getByText('Khoa Tim mạch')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    expect(await screen.findByText('Không tìm thấy phòng ban phù hợp.')).toBeInTheDocument()
  })
})

describe('ReferenceDepartmentsListPage - tạo phòng ban', () => {
  const openCreate = () => fireEvent.click(screen.getByRole('button', { name: /Thêm phòng ban/ }))

  it('mở biểu mẫu trống', async () => {
    await renderPage()
    openCreate()

    expect(screen.getByText('Thêm phòng ban mới')).toBeInTheDocument()
    expect(codeInput()).toHaveValue('')
    expect(nameInput()).toHaveValue('')
  })

  it('cảnh báo khi bỏ trống mã hoặc tên', async () => {
    await renderPage()
    openCreate()
    fireEvent.change(codeInput(), { target: { value: '   ' } })
    fireEvent.change(nameInput(), { target: { value: 'Khoa mới' } })
    submitForm()

    expect(showToast).toHaveBeenCalledWith('Vui lòng nhập đầy đủ Mã và Tên phòng ban.', 'warning')
    expect(api.createDepartment).not.toHaveBeenCalled()
  })

  it('tạo phòng ban với mã viết hoa và tải lại danh sách', async () => {
    await renderPage()
    openCreate()
    fireEvent.change(codeInput(), { target: { value: '  k-timmach  ' } })
    fireEvent.change(nameInput(), { target: { value: '  Khoa Tim mạch  ' } })
    submitForm()

    await waitFor(() => expect(api.createDepartment).toHaveBeenCalledWith({
      departmentCode: 'K-TIMMACH', name: 'Khoa Tim mạch',
    }))
    expect(showToast).toHaveBeenCalledWith('Tạo phòng ban thành công!', 'success')
    await waitFor(() => expect(screen.queryByText('Thêm phòng ban mới')).not.toBeInTheDocument())
    expect(api.getDepartments).toHaveBeenCalledTimes(2)
  })

  it('giữ biểu mẫu mở và báo lỗi khi tạo thất bại', async () => {
    api.createDepartment.mockRejectedValue({ response: { data: { message: 'Mã đã tồn tại' } } })
    await renderPage()
    openCreate()
    fireEvent.change(codeInput(), { target: { value: 'K-1' } })
    fireEvent.change(nameInput(), { target: { value: 'Trùng mã' } })
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mã đã tồn tại', 'error'))
    expect(screen.getByText('Thêm phòng ban mới')).toBeInTheDocument()
  })

  it('dùng thông báo mặc định khi tạo lỗi không có nội dung', async () => {
    api.createDepartment.mockRejectedValue(new Error('down'))
    await renderPage()
    openCreate()
    fireEvent.change(codeInput(), { target: { value: 'K-9' } })
    fireEvent.change(nameInput(), { target: { value: 'Khoa mới' } })
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra khi tạo phòng ban.', 'error'))
  })

  it('đóng biểu mẫu bằng nút X, nút Huỷ và click ra nền', async () => {
    await renderPage()

    openCreate()
    fireEvent.click(codeInput().closest('.rdl-modal').querySelector('.rdl-modal-close'))
    expect(screen.queryByText('Thêm phòng ban mới')).not.toBeInTheDocument()

    openCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByText('Thêm phòng ban mới')).not.toBeInTheDocument()

    openCreate()
    fireEvent.click(document.querySelector('.rdl-modal-overlay'))
    expect(screen.queryByText('Thêm phòng ban mới')).not.toBeInTheDocument()
  })

  it('không đóng khi bấm vào bên trong biểu mẫu', async () => {
    await renderPage()
    openCreate()
    fireEvent.click(document.querySelector('.rdl-modal'))
    expect(screen.getByText('Thêm phòng ban mới')).toBeInTheDocument()
  })
})

describe('ReferenceDepartmentsListPage - sửa phòng ban', () => {
  it('nạp sẵn dữ liệu dòng vào biểu mẫu', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Chỉnh sửa phòng ban Khoa số 1'))

    expect(screen.getByText('Chỉnh sửa phòng ban')).toBeInTheDocument()
    expect(codeInput()).toHaveValue('K-1')
    expect(nameInput()).toHaveValue('Khoa số 1')
  })

  it('để trống mã khi phòng ban chưa có mã', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Chỉnh sửa phòng ban Khoa Tim mạch'))
    expect(codeInput()).toHaveValue('')
  })

  it('cập nhật phòng ban rồi tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Chỉnh sửa phòng ban Khoa số 1'))
    fireEvent.change(nameInput(), { target: { value: 'Khoa đã đổi tên' } })
    submitForm()

    await waitFor(() => expect(api.updateDepartment).toHaveBeenCalledWith(1, {
      departmentCode: 'K-1', name: 'Khoa đã đổi tên',
    }))
    expect(showToast).toHaveBeenCalledWith('Cập nhật phòng ban thành công!', 'success')
    expect(api.getDepartments).toHaveBeenCalledTimes(2)
  })

  it('báo lỗi khi cập nhật thất bại', async () => {
    api.updateDepartment.mockRejectedValue({ response: { data: { message: 'Phòng ban đang được dùng' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Chỉnh sửa phòng ban Khoa số 1'))
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Phòng ban đang được dùng', 'error'))
  })

  it('dùng thông báo mặc định khi cập nhật lỗi không có nội dung', async () => {
    api.updateDepartment.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(screen.getByLabelText('Chỉnh sửa phòng ban Khoa số 1'))
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra khi cập nhật phòng ban.', 'error'))
  })
})

describe('ReferenceDepartmentsListPage - xoá phòng ban', () => {
  it('hỏi xác nhận rồi xoá và tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa phòng ban Khoa số 1'))

    const dialog = screen.getByRole('dialog', { name: 'Xóa phòng ban' })
    expect(within(dialog).getByText(/không thể hoàn tác/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(api.deleteDepartment).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Xóa phòng ban thành công!', 'success')
    expect(api.getDepartments).toHaveBeenCalledTimes(2)
  })

  it('không xoá khi người dùng huỷ', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa phòng ban Khoa số 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Không xóa' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.deleteDepartment).not.toHaveBeenCalled()
  })

  it('báo lỗi khi xoá thất bại', async () => {
    api.deleteDepartment.mockRejectedValue({ response: { data: { message: 'Còn nhân viên trong phòng ban' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa phòng ban Khoa số 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Còn nhân viên trong phòng ban', 'error'))
  })

  it('dùng thông báo mặc định khi xoá lỗi không có nội dung', async () => {
    api.deleteDepartment.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa phòng ban Khoa số 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể xóa phòng ban này.', 'error'))
  })
})

describe('ReferenceDepartmentsListPage - phân trang', () => {
  const many = (count) => Array.from({ length: count }, (_, index) => department(index + 1))

  it('hiển thị 10 dòng mỗi trang và chuyển trang', async () => {
    api.getDepartments.mockResolvedValue({ data: { data: many(35) } })
    render(<ReferenceDepartmentsListPage />)
    await screen.findByText('Khoa số 1')

    expect(screen.getByText('Hiển thị 10 trong tổng số 35 kết quả')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(await screen.findByText('Khoa số 11')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(await screen.findByText('Khoa số 31')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 5 trong tổng số 35 kết quả')).toBeInTheDocument()
  })

  it('rút gọn dải trang bằng dấu ba chấm ở hai đầu', async () => {
    api.getDepartments.mockResolvedValue({ data: { data: many(120) } })
    render(<ReferenceDepartmentsListPage />)
    await screen.findByText('Khoa số 1')

    expect(screen.getAllByText('...')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '12' }))
    expect(await screen.findByText('Khoa số 111')).toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '11' }))
    expect(await screen.findByText('Khoa số 101')).toBeInTheDocument()
  })

  it('quay về trang đầu khi đổi từ khoá tìm kiếm', async () => {
    api.getDepartments.mockResolvedValue({ data: { data: many(35) } })
    render(<ReferenceDepartmentsListPage />)
    await screen.findByText('Khoa số 1')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(await screen.findByText('Khoa số 11')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'Khoa số 3' } })
    expect(await screen.findByText('Khoa số 3')).toBeInTheDocument()
  })
})
