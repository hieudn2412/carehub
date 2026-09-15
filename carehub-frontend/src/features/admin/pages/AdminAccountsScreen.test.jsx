import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  getRoles: vi.fn(),
  getPositions: vi.fn(),
  getEducationLevels: vi.fn(),
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
  lockUser: vi.fn(),
  unlockUser: vi.fn(),
  deleteUser: vi.fn(),
  resetUserPassword: vi.fn(),
  importUsers: vi.fn(),
  exportUsers: vi.fn(),
}))
const showToast = vi.hoisted(() => vi.fn())

vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, title }) => <main data-testid="shell" data-title={title}>{children}</main>,
}))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({
  default: ({ label }) => <div role="status">{label}</div>,
}))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange, className }) => <input aria-label="Ngày sinh" className={className} value={value} onChange={(event) => onChange(event.target.value)} />,
}))
vi.mock('../../../shared/components/DepartmentCombobox.jsx', () => ({
  default: ({ id, departments = [], value, onChange, disabled }) => (
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn phòng ban</option>
      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
    </select>
  ),
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options = [], disabled }) => (
    <label>{label}
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ label, value, onChange, options = [], required }) => (
    <label>{label}
      <select aria-label={label} value={value} required={required} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chưa chọn</option>
        {options.filter((option) => option.value !== '').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ children, actions, activeCount, onApply, onReset, onSearchChange, onToggle, searchValue, searchPlaceholder, isOpen }) => (
    <section aria-label="Bộ lọc tài khoản">
      <input aria-label="Tìm tài khoản" placeholder={searchPlaceholder} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button type="button" onClick={onToggle}>Bộ lọc {activeCount}</button>
      {isOpen && <div>{children}<button type="button" onClick={onApply}>Áp dụng</button><button type="button" onClick={onReset}>Xóa bộ lọc</button></div>}
      {actions}
    </section>
  ),
}))

import AdminAccountsScreen from './AdminAccountsScreen.jsx'

const departments = [{ id: 1, name: 'Khoa Điều dưỡng' }, { id: 2, name: 'Khoa Cấp cứu' }]
const roles = [
  { id: 10, code: 'USER', name: 'User' },
  { id: 20, code: 'MANAGER', name: 'Manager' },
  { id: 30, code: 'ADMIN', name: 'Administrator' },
  { id: 99, code: 'SYSTEM_JOB', name: 'System job' },
]
const users = [
  { id: 1, employeeCode: 'NV001', fullName: 'Nguyễn Văn An', departmentId: 1, roles: [roles[0], roles[3]], status: 'ACTIVE' },
  { id: 2, username: 'locked', fullName: '', departmentId: 99, roles: [roles[1]], status: 'LOCKED' },
  { id: 3, employeeCode: null, fullName: null, departmentId: null, roles: [], status: 'INACTIVE' },
]
const detail = {
  id: 1,
  employeeCode: 'NV001',
  fullName: 'Nguyễn Văn An',
  email: 'an@example.com',
  phone: '0912345678',
  departmentId: 1,
  departmentName: 'Khoa Điều dưỡng',
  positionId: 7,
  positionName: 'Điều dưỡng viên',
  educationLevelId: 8,
  educationLevelName: 'Đại học',
  birthday: '2000-02-03',
  gender: true,
  status: 'ACTIVE',
  roles: [roles[0], roles[3]],
  lastLogin: '2026-08-01T09:00:00Z',
  createdAt: '2025-01-02T10:00:00Z',
}

const response = (data) => ({ data: { data } })

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/accounts']}>
      <Routes>
        <Route path="*" element={<><AdminAccountsScreen /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function waitForTable() {
  expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument()
  expect(api.getUsers).toHaveBeenCalled()
}

function formModal() {
  return screen.getByRole('heading', { name: /tài khoản nhân viên|Sửa thông tin tài khoản/ }).closest('.am-modal')
}

function submitAccountForm() {
  fireEvent.submit(within(formModal()).getByRole('button', { name: 'Lưu thay đổi' }).closest('form'))
}

function fillRequiredCreateFields({ code = 'NV004', name = 'Trần Thị Bình', email = 'binh@example.com', phone = '0987654321', departmentId = '1', roleId = '10' } = {}) {
  const modal = formModal()
  fireEvent.change(within(modal).getByPlaceholderText('VD: NV-00042'), { target: { value: code } })
  fireEvent.change(within(modal).getByPlaceholderText('VD: Nguyễn Văn A'), { target: { value: name } })
  fireEvent.change(within(modal).getByPlaceholderText('VD: email@example.com'), { target: { value: email } })
  fireEvent.change(within(modal).getByPlaceholderText('Nhập số điện thoại...'), { target: { value: phone } })
  fireEvent.change(within(modal).getByLabelText('Phòng ban *'), { target: { value: departmentId } })
  fireEvent.change(within(modal).getByLabelText('Vai trò hệ thống'), { target: { value: roleId } })
}

async function openDetail(code = 'NV001') {
  fireEvent.click(screen.getByLabelText(`Xem chi tiết tài khoản ${code}`))
  return screen.findByRole('heading', { name: 'Thông tin tài khoản' })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getDepartments.mockResolvedValue(response(departments))
  api.getRoles.mockResolvedValue(response({ content: roles }))
  api.getPositions.mockResolvedValue(response({ data: [{ id: 7, name: 'Điều dưỡng viên' }] }))
  api.getEducationLevels.mockResolvedValue(response([{ id: 8, name: 'Đại học' }]))
  api.getUsers.mockResolvedValue(response({ content: users, totalElements: 43, totalPages: 5 }))
  api.getUserById.mockResolvedValue(response(detail))
  api.createUser.mockResolvedValue(response({ id: 4 }))
  api.updateUser.mockResolvedValue(response({}))
  api.assignRole.mockResolvedValue(response({}))
  api.removeRole.mockResolvedValue(response({}))
  api.lockUser.mockResolvedValue(response({}))
  api.unlockUser.mockResolvedValue(response({}))
  api.deleteUser.mockResolvedValue(response({}))
  api.resetUserPassword.mockResolvedValue(response('NewPass123'))
  api.importUsers.mockResolvedValue(response({ createdCount: 2, updatedCount: 1, failedCount: 1 }))
  api.exportUsers.mockResolvedValue(response(users))
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:accounts') })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

describe('AdminAccountsScreen', () => {
  it('loads references and users, formats roles/status/departments, filters and paginates', async () => {
    renderPage()
    await waitForTable()
    expect(screen.getByTestId('shell')).toHaveAttribute('data-title', 'Quản lý tài khoản')
    expect(screen.getByText('Nhân viên')).toBeInTheDocument()
    expect(screen.queryByText('System job')).not.toBeInTheDocument()
    expect(screen.getByText('Mã phòng 99')).toBeInTheDocument()
    expect(screen.getByText('Chưa phân phòng')).toBeInTheDocument()
    expect(screen.getByText('Đã khoá')).toBeInTheDocument()
    expect(screen.getByText('Ngưng hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 3 trong tổng số 43 kết quả')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc 0' }))
    fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'LOCKED' } })
    fireEvent.change(screen.getByLabelText('Tìm tài khoản'), { target: { value: '  Nam  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'Nam', departmentId: '2', roleId: '20', status: 'LOCKED', page: 0,
    })), { timeout: 1200 })

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: undefined, departmentId: undefined, roleId: undefined, status: undefined,
    })))

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    fireEvent.click(screen.getAllByRole('button').find((button) => button.querySelector('.anticon-right')))
    await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    fireEvent.click(screen.getAllByRole('button').find((button) => button.querySelector('.anticon-left')))
  })

  it('validates every create field and creates a trimmed account', async () => {
    renderPage()
    await waitForTable()
    fireEvent.click(screen.getByRole('button', { name: /Thêm tài khoản/ }))

    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith(expect.stringContaining('Vui lòng nhập đầy đủ'), 'warning')

    fillRequiredCreateFields({ code: 'NV 004' })
    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith(expect.stringContaining('Mã nhân viên chỉ được chứa'), 'warning')

    fireEvent.change(within(formModal()).getByPlaceholderText('VD: NV-00042'), { target: { value: 'NV004' } })
    fireEvent.change(within(formModal()).getByPlaceholderText('VD: Nguyễn Văn A'), { target: { value: 'A' } })
    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith('Họ và tên phải có ít nhất 2 ký tự.', 'warning')

    fireEvent.change(within(formModal()).getByPlaceholderText('VD: Nguyễn Văn A'), { target: { value: 'Trần Bình' } })
    fireEvent.change(within(formModal()).getByPlaceholderText('VD: email@example.com'), { target: { value: 'bad-email' } })
    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith(expect.stringContaining('Email không hợp lệ'), 'warning')

    fireEvent.change(within(formModal()).getByPlaceholderText('VD: email@example.com'), { target: { value: 'binh@example.com' } })
    fireEvent.change(within(formModal()).getByPlaceholderText('Nhập số điện thoại...'), { target: { value: '123' } })
    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith(expect.stringContaining('Số điện thoại không hợp lệ'), 'warning')

    fireEvent.change(within(formModal()).getByPlaceholderText('Nhập số điện thoại...'), { target: { value: '' } })
    fireEvent.change(within(formModal()).getByLabelText('Vai trò hệ thống'), { target: { value: '' } })
    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith('Vui lòng chọn một vai trò cho tài khoản.', 'warning')

    fireEvent.change(within(formModal()).getByLabelText('Vai trò hệ thống'), { target: { value: '10' } })
    fireEvent.change(within(formModal()).getByPlaceholderText('VD: NV-00042'), { target: { value: '  NV004  ' } })
    fireEvent.change(within(formModal()).getByPlaceholderText('VD: Nguyễn Văn A'), { target: { value: '  Trần Bình  ' } })
    fireEvent.change(within(formModal()).getByPlaceholderText('VD: email@example.com'), { target: { value: '  binh@example.com  ' } })
    submitAccountForm()
    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({
      employeeCode: 'NV004', fullName: 'Trần Bình', email: 'binh@example.com', phone: undefined, departmentId: 1, roleIds: [10],
    }))
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Tạo tài khoản thành công'), 'success')
  })

  it('reports create failures and supports closing the create modal by its controls and overlay', async () => {
    api.createUser.mockRejectedValueOnce({ response: { data: { message: 'Mã nhân viên đã tồn tại' } } })
    renderPage()
    await waitForTable()
    fireEvent.click(screen.getByRole('button', { name: /Thêm tài khoản/ }))
    fillRequiredCreateFields()
    submitAccountForm()
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mã nhân viên đã tồn tại', 'error'))

    fireEvent.click(within(formModal()).getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByRole('heading', { name: 'Thêm tài khoản nhân viên' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Thêm tài khoản/ }))
    fireEvent.click(formModal().parentElement)
    expect(screen.queryByRole('heading', { name: 'Thêm tài khoản nhân viên' })).not.toBeInTheDocument()
  })

  it('opens details, edits every profile field and synchronizes the single selected role', async () => {
    renderPage()
    await waitForTable()
    await openDetail()
    expect(screen.getByText('Điều dưỡng viên')).toBeInTheDocument()
    expect(screen.getByText('Đại học')).toBeInTheDocument()
    expect(screen.getByText('Nam')).toBeInTheDocument()
    expect(screen.getByText('an@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sửa thông tin/ }))
    const modal = await screen.findByRole('heading', { name: 'Sửa thông tin tài khoản' })
    expect(modal).toBeInTheDocument()
    fireEvent.change(within(formModal()).getByLabelText('Chức danh'), { target: { value: '7' } })
    fireEvent.change(within(formModal()).getByLabelText('Trình độ học vấn'), { target: { value: '8' } })
    fireEvent.change(within(formModal()).getByLabelText('Ngày sinh'), { target: { value: '2001-04-05' } })
    fireEvent.click(within(formModal()).getByLabelText('Nữ'))
    fireEvent.change(formModal().querySelector('select.am-form-select'), { target: { value: 'INACTIVE' } })
    fireEvent.change(within(formModal()).getByLabelText('Vai trò hệ thống'), { target: { value: '20' } })
    submitAccountForm()

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({
      employeeCode: 'NV001', departmentId: 1, positionId: 7, educationLevelId: 8,
      birthday: '2001-04-05', gender: false, status: 'INACTIVE',
    })))
    expect(api.assignRole).toHaveBeenCalledWith(1, 20)
    expect(api.removeRole).toHaveBeenCalledWith(1, 10)
    expect(api.removeRole).toHaveBeenCalledWith(1, 99)
    expect(showToast).toHaveBeenCalledWith('Cập nhật tài khoản thành công!', 'success')
  })

  it('validates a future birthday and reports edit loading/save failures', async () => {
    renderPage()
    await waitForTable()
    await openDetail()
    fireEvent.click(screen.getByRole('button', { name: /Sửa thông tin/ }))
    await screen.findByRole('heading', { name: 'Sửa thông tin tài khoản' })
    fireEvent.change(within(formModal()).getByLabelText('Ngày sinh'), { target: { value: '2999-01-01' } })
    submitAccountForm()
    expect(showToast).toHaveBeenLastCalledWith('Ngày sinh không thể lớn hơn ngày hiện tại.', 'warning')

    api.updateUser.mockRejectedValueOnce(new Error('network'))
    fireEvent.change(within(formModal()).getByLabelText('Ngày sinh'), { target: { value: '2000-01-01' } })
    submitAccountForm()
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra khi lưu thông tin.', 'error'))

    fireEvent.click(within(formModal()).getByRole('button', { name: 'Huỷ' }))
    api.getUserById.mockRejectedValueOnce(new Error('detail failed'))
    await openDetail()
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể tải thông tin chi tiết nhân viên.', 'error'))
  })

  it('locks, unlocks, resets password and deletes accounts through confirmations', async () => {
    renderPage()
    await waitForTable()
    await openDetail()

    fireEvent.click(screen.getByRole('button', { name: /Khoá tài khoản/ }))
    expect(screen.getByText(/Bạn có chắc chắn muốn khoá/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(api.lockUser).toHaveBeenCalledWith(1))

    api.getUserById.mockResolvedValue(response({ ...detail, status: 'LOCKED' }))
    await openDetail()
    fireEvent.click(screen.getByRole('button', { name: /Mở khoá/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(api.unlockUser).toHaveBeenCalledWith(1))

    api.getUserById.mockResolvedValue(response(detail))
    await openDetail()
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu tự động/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(await screen.findByText('NewPass123')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Xoá tài khoản/ }))
    expect(screen.getByText(/CẢNH BÁO/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith(1))
  })

  it('reports action failures and allows cancelling confirmation dialogs', async () => {
    api.lockUser.mockRejectedValueOnce({ response: { data: { message: 'Không được khóa' } } })
    renderPage()
    await waitForTable()
    await openDetail()
    fireEvent.click(screen.getByRole('button', { name: /Khoá tài khoản/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(api.lockUser).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Khoá tài khoản/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không được khóa', 'error'))

    api.resetUserPassword.mockRejectedValueOnce(new Error('reset failed'))
    fireEvent.click(screen.getByRole('button', { name: /Đổi mật khẩu tự động/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể thay đổi mật khẩu.', 'error'))

    api.deleteUser.mockRejectedValueOnce(new Error('delete failed'))
    fireEvent.click(screen.getByRole('button', { name: /Xoá tài khoản/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể xóa tài khoản.', 'error'))
  })

  it('imports Excel with result details and handles import failures', async () => {
    renderPage()
    await waitForTable()
    fireEvent.click(screen.getByLabelText('Import Excel'))
    const importHeading = await screen.findByRole('heading', { name: 'Import danh sách tài khoản' })
    const modal = importHeading.closest('.am-modal')
    const file = new File(['employees'], 'employees.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    fireEvent.change(within(modal).getByDisplayValue('', { selector: 'input[type="file"]' }), { target: { files: [file] } })
    fireEvent.submit(within(modal).getByRole('button', { name: 'Bắt đầu Import' }).closest('form'))
    await waitFor(() => expect(api.importUsers).toHaveBeenCalledWith(file))
    expect(await screen.findByText('Thêm mới thành công:')).toBeInTheDocument()
    expect(screen.getByText('Lỗi hàng:')).toBeInTheDocument()

    fireEvent.click(within(modal).getByRole('button', { name: 'Đóng' }))
    api.importUsers.mockRejectedValueOnce({ response: { data: { message: 'File sai định dạng' } } })
    fireEvent.click(screen.getByLabelText('Import Excel'))
    const errorModal = screen.getByRole('heading', { name: 'Import danh sách tài khoản' }).closest('.am-modal')
    fireEvent.change(errorModal.querySelector('input[type="file"]'), { target: { files: [file] } })
    fireEvent.submit(within(errorModal).getByRole('button', { name: 'Bắt đầu Import' }).closest('form'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('File sai định dạng', 'error'))
  })

  it('exports CSV and reports empty or failed exports', async () => {
    renderPage()
    await waitForTable()
    fireEvent.click(screen.getByLabelText('Xuất CSV'))
    await waitFor(() => expect(api.exportUsers).toHaveBeenCalledWith({ keyword: undefined, departmentId: undefined, roleId: undefined, status: undefined }))
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()

    api.exportUsers.mockResolvedValueOnce(response([]))
    fireEvent.click(screen.getByLabelText('Xuất CSV'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có dữ liệu phù hợp để xuất.', 'info'))

    api.exportUsers.mockRejectedValueOnce(new Error('export failed'))
    fireEvent.click(screen.getByLabelText('Xuất CSV'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra khi xuất tệp dữ liệu.', 'error'))
  })

  it('handles reference/list failures and routes to department setup when no departments exist', async () => {
    api.getDepartments.mockRejectedValueOnce(new Error('departments failed'))
    api.getRoles.mockRejectedValueOnce(new Error('roles failed'))
    api.getPositions.mockRejectedValueOnce(new Error('positions failed'))
    api.getEducationLevels.mockRejectedValueOnce(new Error('education failed'))
    api.getUsers.mockRejectedValueOnce(new Error('users failed'))
    renderPage()
    expect(await screen.findByText('Không tìm thấy tài khoản người dùng phù hợp.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Thêm tài khoản/ }))
    expect(await screen.findByText('Không thể tải danh sách phòng ban.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tới danh mục phòng ban' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/reference/departments')
  })
})
