import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComplianceByTechniquePage from './ComplianceByTechniquePage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const downloadCsv = vi.fn()
const competency = vi.hoisted(() => ({ getByTechnique: vi.fn() }))
const admin = vi.hoisted(() => ({ getDepartments: vi.fn() }))
const staff = vi.hoisted(() => ({ getProfile: vi.fn() }))
const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(), getRolesFromAccessToken: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/examAssignmentApi.js', () => ({ competencyApi: competency }))
vi.mock('../../admin/api/adminApi.js', () => ({ adminApi: admin }))
vi.mock('../../staff/api/staffApi.js', () => ({ staffApi: staff }))
vi.mock('../../../shared/auth/tokenStorage.js', () => ({ tokenStorage: { getAccessToken: auth.getAccessToken } }))
vi.mock('../../../shared/auth/jwt.js', () => ({ getRolesFromAccessToken: auth.getRolesFromAccessToken }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/utils/tableExport.js', () => ({
  downloadCsv: (...args) => downloadCsv(...args),
  exportFileName: (prefix) => `${prefix}.csv`,
}))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
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
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ actions, activeCount, children, errorMessage, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
      <div>{actions}</div>
    </section>
  ),
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`

const item = (index, overrides = {}) => ({
  employeeId: index, employeeCode: `NV00${index}`, employeeName: `Nhân viên ${index}`,
  departmentName: 'Khoa Ngoại', evaluationCount: 10, passCount: 8, passRate: 80, ...overrides,
})

const techniqueResponse = (items, overrides = {}) => ({
  data: { data: { items, totalElements: items.length, totalPages: 1, departmentName: 'Khoa mặc định', ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  auth.getAccessToken.mockReturnValue('token')
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_ADMIN'])
  admin.getDepartments.mockResolvedValue({ data: { data: [{ id: 3, name: 'Khoa Ngoại' }] } })
  staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 3, departmentName: 'Khoa Hồi sức' } } })
  competency.getByTechnique.mockResolvedValue(techniqueResponse([
    item(1),
    item(2, { departmentName: null, passCount: null, passRate: null, evaluationCount: null }),
  ]))
})

const renderAdmin = async () => {
  render(<ComplianceByTechniquePage />)
  await screen.findByText('Nhân viên 1')
}
const renderManager = async () => {
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
  render(<ComplianceByTechniquePage />)
  await screen.findByText('Nhân viên 1')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const dateInputs = () => screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)

describe('ComplianceByTechniquePage - chế độ quản trị', () => {
  it('tải dữ liệu toàn viện với khoảng ngày mặc định', async () => {
    await renderAdmin()

    expect(competency.getByTechnique).toHaveBeenCalledWith(expect.objectContaining({
      departmentId: undefined, keyword: undefined, fromDate: FROM, page: 0, size: 100,
    }))
    expect(screen.getByText('8/10 – 80%')).toBeInTheDocument()
    expect(screen.getByText('2 nhân viên')).toBeInTheDocument()
  })

  it('điền 0 và tên khoa mặc định cho dòng thiếu dữ liệu', async () => {
    await renderAdmin()
    const row = screen.getByText('Nhân viên 2').closest('tr')

    expect(within(row).getByText('0/0 – 0%')).toBeInTheDocument()
    expect(within(row).getByText(/Khoa mặc định/)).toBeInTheDocument()
  })

  it('gộp mọi trang khi backend trả về nhiều trang', async () => {
    competency.getByTechnique.mockImplementation(({ page }) => Promise.resolve(
      techniqueResponse([item(page + 1)], { totalPages: 3 }),
    ))
    render(<ComplianceByTechniquePage />)
    await screen.findByText('Nhân viên 1')

    await waitFor(() => expect(competency.getByTechnique).toHaveBeenCalledTimes(3))
    expect(screen.getByText('Nhân viên 3')).toBeInTheDocument()
  })

  it('chịu được trang sau thiếu mảng items', async () => {
    competency.getByTechnique.mockImplementation(({ page }) => Promise.resolve(
      page === 0 ? techniqueResponse([item(1)], { totalPages: 2 }) : { data: { data: {} } },
    ))
    render(<ComplianceByTechniquePage />)
    await screen.findByText('Nhân viên 1')
    await waitFor(() => expect(competency.getByTechnique).toHaveBeenCalledTimes(2))
  })

  it('hiện thông báo rỗng khi phản hồi trống', async () => {
    competency.getByTechnique.mockResolvedValue({ data: { data: null } })
    render(<ComplianceByTechniquePage />)
    expect(await screen.findByText('Vui lòng chọn khoa/phòng.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải dữ liệu thất bại', async () => {
    competency.getByTechnique.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<ComplianceByTechniquePage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('chỉ nạp danh sách khoa khi mở bảng lọc', async () => {
    await renderAdmin()
    expect(admin.getDepartments).not.toHaveBeenCalled()

    openFilters()
    await waitFor(() => expect(admin.getDepartments).toHaveBeenCalled())
    expect(await screen.findByRole('option', { name: 'Khoa Ngoại' })).toBeInTheDocument()
  })

  it('báo lỗi khi nạp danh sách khoa thất bại', async () => {
    admin.getDepartments.mockRejectedValue({ response: { data: { message: 'Lỗi tải khoa' } } })
    await renderAdmin()
    openFilters()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Lỗi tải khoa', 'error'))
  })

  it('điều hướng sang trang chi tiết của quản trị viên', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByLabelText('Xem chi tiết tuân thủ của Nhân viên 1'))

    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/admin/evaluation/compliance-by-technique/1?from='))
  })
})

describe('ComplianceByTechniquePage - chế độ quản lý khoa', () => {
  it('khoá khoa theo hồ sơ người dùng', async () => {
    await renderManager()

    expect(staff.getProfile).toHaveBeenCalled()
    expect(admin.getDepartments).not.toHaveBeenCalled()
    await waitFor(() => expect(competency.getByTechnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: '3' }),
    ))
    openFilters()
    expect(screen.getByText('Khoa Hồi sức')).toBeInTheDocument()
  })

  it('dùng nhãn mặc định khi hồ sơ thiếu tên khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 3 } } })
    await renderManager()
    openFilters()
    expect(screen.getByText('Khoa của tôi')).toBeInTheDocument()
  })

  it('báo lỗi khi tài khoản quản lý chưa được gán khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: {} } })
    auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
    render(<ComplianceByTechniquePage />)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
    expect(competency.getByTechnique).not.toHaveBeenCalled()
  })

  it('điều hướng sang trang chi tiết của quản lý khoa', async () => {
    await renderManager()
    fireEvent.click(screen.getByLabelText('Xem chi tiết tuân thủ của Nhân viên 1'))

    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/manager/compliance-by-technique/1?from='))
  })
})

describe('ComplianceByTechniquePage - bộ lọc', () => {
  it('áp dụng từ khoá, khoa và khoảng ngày', async () => {
    await renderAdmin()
    fireEvent.change(screen.getByLabelText('Tìm theo tên nhân viên'), { target: { value: '  Nam  ' } })
    openFilters()
    // danh sách khoa tải bất đồng bộ; phải đợi option xuất hiện, nếu không select giữ giá trị rỗng
    const departmentSelect = await screen.findByLabelText('Khoa/phòng')
    await waitFor(() => expect(within(departmentSelect).getByRole('option', { name: 'Khoa Ngoại' })).toBeInTheDocument())
    fireEvent.change(departmentSelect, { target: { value: '3' } })
    expect(departmentSelect).toHaveValue('3')
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR}-03-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    // departmentId và appliedFilters đổi trong cùng một nhịp nên effect chạy hai lần;
    // lời gọi cuối không chắc là lời gọi mang đủ bộ lọc.
    await waitFor(() => expect(competency.getByTechnique).toHaveBeenCalledWith(expect.objectContaining({
      departmentId: '3', keyword: 'Nam', fromDate: `${THIS_YEAR}-03-01`,
    })), { timeout: 5000 })
    expect(screen.getByTestId('active-count')).toHaveTextContent('3')
    expect(screen.queryByLabelText('Khoa/phòng')).not.toBeInTheDocument()
  })

  it('chặn áp dụng khi khoảng ngày không hợp lệ', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
  })

  it('xoá lỗi ngày khi sửa lại hoặc đóng bảng lọc', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(dateInputs()[1], { target: { value: `${THIS_YEAR}-12-31` } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc trả mọi tham số về mặc định', async () => {
    await renderAdmin()
    fireEvent.change(screen.getByLabelText('Tìm theo tên nhân viên'), { target: { value: 'abc' } })
    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('1'))

    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('0'))
  })

  it('tải lại dữ liệu bằng nút refresh', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByLabelText('Tải lại dữ liệu'))
    await waitFor(() => expect(competency.getByTechnique).toHaveBeenCalledTimes(2))
  })
})

describe('ComplianceByTechniquePage - xuất Excel', () => {
  it('xuất đúng dữ liệu đang hiển thị', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }))

    expect(downloadCsv).toHaveBeenCalledWith(
      'tuan-thu-chung.csv',
      expect.arrayContaining(['Mã NV', 'Tỷ lệ tuân thủ (%)']),
      [
        ['NV001', 'Nhân viên 1', 'Khoa Ngoại', 10, 8, 80, FROM, expect.any(String)],
        ['NV002', 'Nhân viên 2', 'Khoa mặc định', 0, 0, 0, FROM, expect.any(String)],
      ],
    )
  })

  it('khoá nút xuất khi không có dữ liệu', async () => {
    competency.getByTechnique.mockResolvedValue(techniqueResponse([], { totalElements: 0 }))
    render(<ComplianceByTechniquePage />)
    await screen.findByText('Vui lòng chọn khoa/phòng.')

    expect(screen.getByRole('button', { name: /Xuất Excel/ })).toBeDisabled()
  })
})
