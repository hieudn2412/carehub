import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReferenceEmployeesListPage from './ReferenceEmployeesListPage.jsx'

const navigate = vi.fn()
const api = vi.hoisted(() => ({ getUsers: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/adminApi.js', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))
vi.mock('../../../shared/components/AdminFilterDisclosure.jsx', () => ({
  default: ({ activeCount, children }) => <div data-testid="filters" data-active={activeCount}>{children}</div>,
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
  default: ({ label, value, onChange, options, disabled }) => (
    <label>{label}
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))

const user = (index, overrides = {}) => ({
  id: index,
  employeeCode: `NV00${index}`,
  fullName: `Nhân viên ${index}`,
  departmentName: 'Khoa Ngoại',
  roles: [{ name: 'USER' }],
  gender: true,
  educationLevelName: 'Đại học',
  positionName: 'Điều dưỡng',
  birthday: '1990-05-20',
  ...overrides,
})

const usersResponse = (content) => ({ data: { success: true, data: { content } } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getUsers.mockResolvedValue(usersResponse([
    user(1),
    user(2, { fullName: 'Trần Thị B', gender: false, departmentName: null, educationLevelName: null, positionName: null, birthday: null }),
    user(3, { fullName: 'Lê Văn C', departmentName: 'Khoa Nội', educationLevelName: 'Cao đẳng', positionName: 'Kỹ thuật viên' }),
  ]))
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async () => {
  render(<ReferenceEmployeesListPage />)
  await screen.findByText('Nhân viên 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm theo tên/ID')
const rowOf = (text) => screen.getByText(text).closest('tr')

describe('ReferenceEmployeesListPage - danh sách', () => {
  it('tải và ánh xạ dữ liệu nhân viên', async () => {
    render(<ReferenceEmployeesListPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách nhân viên từ backend...')

    await screen.findByText('Nhân viên 1')
    expect(api.getUsers).toHaveBeenCalledWith({ size: 10000 })
    expect(screen.getByText('NV001')).toBeInTheDocument()
    expect(screen.getAllByText('Khoa Nội').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('table')).getAllByText('Nam')).toHaveLength(2)
    expect(within(screen.getByRole('table')).getByText('Nữ')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Cao đẳng')).toBeInTheDocument()
    expect(screen.getByText('3 kết quả')).toBeInTheDocument()
  })

  it('điền gạch ngang cho các trường còn thiếu', async () => {
    await renderPage()
    const row = rowOf('Trần Thị B')
    expect(within(row).getAllByText('–').length).toBeGreaterThanOrEqual(3)
  })

  it('hiện lỗi khi tải danh sách thất bại', async () => {
    api.getUsers.mockRejectedValue(new Error('down'))
    render(<ReferenceEmployeesListPage />)
    expect(await screen.findByText('Không thể tải danh sách nhân viên từ backend.')).toBeInTheDocument()
  })

  it('bỏ qua phản hồi không thành công', async () => {
    api.getUsers.mockResolvedValue({ data: { success: false } })
    render(<ReferenceEmployeesListPage />)
    expect(await screen.findByText('Không tìm thấy nhân viên gốc phù hợp.')).toBeInTheDocument()
  })

  it('chịu được phản hồi thiếu mảng content', async () => {
    api.getUsers.mockResolvedValue({ data: { success: true, data: {} } })
    render(<ReferenceEmployeesListPage />)
    expect(await screen.findByText('Không tìm thấy nhân viên gốc phù hợp.')).toBeInTheDocument()
    expect(screen.queryByText(/Hiển thị/)).not.toBeInTheDocument()
  })

  it('mở trang chi tiết nhân viên', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Nhân viên 1')).getByRole('button', { name: /Chi tiết/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/reference/employees/1')
  })
})

describe('ReferenceEmployeesListPage - tìm kiếm và lọc', () => {
  it('tìm theo tên và mã nhân viên', async () => {
    await renderPage()

    fireEvent.change(searchBox(), { target: { value: 'trần' } })
    await waitFor(() => expect(screen.queryByText('Nhân viên 1')).not.toBeInTheDocument())
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'nv003' } })
    expect(await screen.findByText('Lê Văn C')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    expect(await screen.findByText('Không tìm thấy nhân viên gốc phù hợp.')).toBeInTheDocument()
  })

  it('dựng danh sách lựa chọn bộ lọc từ dữ liệu thật', async () => {
    await renderPage()
    expect(within(screen.getByLabelText('Vị trí')).getByRole('option', { name: 'Kỹ thuật viên' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Trình độ')).getByRole('option', { name: 'Cao đẳng' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Khoa/phòng')).getByRole('option', { name: 'Khoa Nội' })).toBeInTheDocument()
    // giá trị '–' không được đưa vào danh sách lựa chọn
    expect(within(screen.getByLabelText('Vị trí')).queryByRole('option', { name: '–' })).not.toBeInTheDocument()
  })

  it.each([
    ['Vị trí', 'Kỹ thuật viên', 'Lê Văn C'],
    ['Trình độ', 'Cao đẳng', 'Lê Văn C'],
    ['Khoa/phòng', 'Khoa Nội', 'Lê Văn C'],
    ['Giới tính', 'Nữ', 'Trần Thị B'],
  ])('lọc theo %s', async (label, value, expected) => {
    await renderPage()
    fireEvent.change(screen.getByLabelText(label), { target: { value } })

    expect(await screen.findByText(expected)).toBeInTheDocument()
    expect(screen.getByText('1 kết quả')).toBeInTheDocument()
  })

  it('lọc theo chức danh và loại cán bộ', async () => {
    api.getUsers.mockResolvedValue(usersResponse([
      user(1),
      user(2, { fullName: 'Quản lý A', roles: [{ name: 'MANAGER' }] }),
    ]))
    await renderPage()

    const cbLabel = screen.getByLabelText('Loại CB')
    const managerOption = within(cbLabel).getAllByRole('option').find((option) => option.value !== 'all' && option.textContent !== 'Nhân viên')
    fireEvent.change(cbLabel, { target: { value: managerOption.value } })

    expect(await screen.findByText('1 kết quả')).toBeInTheDocument()
    expect(screen.getByText('Quản lý A')).toBeInTheDocument()
  })

  it('đếm số bộ lọc đang bật và xoá sạch được', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Vị trí'), { target: { value: 'Kỹ thuật viên' } })
    fireEvent.change(screen.getByLabelText('Giới tính'), { target: { value: 'Nam' } })
    fireEvent.change(searchBox(), { target: { value: 'Lê' } })

    await waitFor(() => expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '2'))

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '0'))
    expect(searchBox()).toHaveValue('')
    expect(screen.getByText('3 kết quả')).toBeInTheDocument()
  })

  it('nút Áp dụng không làm thay đổi kết quả', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByText('3 kết quả')).toBeInTheDocument()
  })

  it('khoá bộ lọc trong lúc đang tải', () => {
    api.getUsers.mockReturnValue(new Promise(() => {}))
    render(<ReferenceEmployeesListPage />)
    expect(searchBox()).toBeDisabled()
    expect(screen.getByLabelText('Vị trí')).toBeDisabled()
  })
})

describe('ReferenceEmployeesListPage - phân trang', () => {
  const many = (count) => Array.from({ length: count }, (_, index) => user(index + 1, { fullName: `Nhân viên ${index + 1}` }))

  it('hiển thị 10 nhân viên mỗi trang và chuyển trang', async () => {
    api.getUsers.mockResolvedValue(usersResponse(many(35)))
    render(<ReferenceEmployeesListPage />)
    await screen.findByText('Nhân viên 1')

    expect(screen.getByText('Hiển thị 10 trong tổng số 35 kết quả')).toBeInTheDocument()
    expect(screen.queryByText('Nhân viên 11')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(await screen.findByText('Nhân viên 11')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(await screen.findByText('Nhân viên 31')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 5 trong tổng số 35 kết quả')).toBeInTheDocument()
  })

  it('rút gọn dải trang bằng dấu ba chấm', async () => {
    api.getUsers.mockResolvedValue(usersResponse(many(120)))
    render(<ReferenceEmployeesListPage />)
    await screen.findByText('Nhân viên 1')

    expect(screen.getAllByText('...')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '12' }))
    expect(await screen.findByText('Nhân viên 111')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '11' }))
    expect(await screen.findByText('Nhân viên 101')).toBeInTheDocument()
    expect(screen.getAllByText('...')).toHaveLength(1)
  })

  it('quay về trang đầu khi đổi bộ lọc', async () => {
    api.getUsers.mockResolvedValue(usersResponse(many(35)))
    render(<ReferenceEmployeesListPage />)
    await screen.findByText('Nhân viên 1')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(await screen.findByText('Nhân viên 11')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(await screen.findByText('Nhân viên 21')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'Nhân viên 1' } })
    expect(await screen.findByText('Nhân viên 1')).toBeInTheDocument()
  })

  it('ẩn dải trang khi chỉ có một trang', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument()
  })
})
