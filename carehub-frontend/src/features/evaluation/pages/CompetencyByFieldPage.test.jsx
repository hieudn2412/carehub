import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompetencyByFieldPage from './CompetencyByFieldPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const competency = vi.hoisted(() => ({ getByField: vi.fn() }))
const categoryApi = vi.hoisted(() => ({ listCategories: vi.fn() }))
const admin = vi.hoisted(() => ({ getDepartments: vi.fn() }))
const staff = vi.hoisted(() => ({ getProfile: vi.fn() }))
const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(), getRolesFromAccessToken: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/examAssignmentApi.js', () => ({ competencyApi: competency }))
vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: categoryApi }))
vi.mock('../../admin/api/adminApi.js', () => ({ adminApi: admin }))
vi.mock('../../staff/api/staffApi.js', () => ({ staffApi: staff }))
vi.mock('../../../shared/auth/tokenStorage.js', () => ({ tokenStorage: { getAccessToken: auth.getAccessToken } }))
vi.mock('../../../shared/auth/jwt.js', () => ({ getRolesFromAccessToken: auth.getRolesFromAccessToken }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/PassFailBadge.jsx', () => ({
  default: ({ passed }) => <span>{passed ? 'Đạt' : 'Không đạt'}</span>,
}))
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
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
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

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`

const item = (index, overrides = {}) => ({
  employeeId: index, employeeCode: `NV00${index}`, employeeName: `Nhân viên ${index}`,
  attemptCount: 3, averageScore: 7.25, passRate: 75, isPassed: true, ...overrides,
})

const fieldResponse = (items) => ({ data: { data: { items } } })

beforeEach(() => {
  vi.clearAllMocks()
  auth.getAccessToken.mockReturnValue('token')
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_ADMIN'])
  admin.getDepartments.mockResolvedValue({ data: { data: [{ id: 3, name: 'Khoa Ngoại' }, { id: 4, name: 'Khoa Nội' }] } })
  staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 5, departmentName: 'Khoa Hồi sức' } } })
  categoryApi.listCategories.mockResolvedValue({ data: { data: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn' }] } })
  competency.getByField.mockResolvedValue(fieldResponse([
    item(1),
    item(2, { isPassed: false, passRate: 40, averageScore: null }),
    item(3, { passRate: null }),
  ]))
})

const renderAdmin = async () => {
  render(<CompetencyByFieldPage />)
  await screen.findByText('Nhân viên 1')
}
const renderManager = async () => {
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
  render(<CompetencyByFieldPage />)
  await screen.findByText('Nhân viên 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm theo tên hoặc mã nhân viên...')
const dateInputs = () => screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)

describe('CompetencyByFieldPage - chế độ quản trị', () => {
  it('chọn sẵn khoa đầu tiên rồi tải dữ liệu', async () => {
    render(<CompetencyByFieldPage />)
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()

    await screen.findByText('Nhân viên 1')
    expect(admin.getDepartments).toHaveBeenCalled()
    expect(competency.getByField).toHaveBeenCalledWith({
      departmentId: '3', fromDate: FROM, toDate: expect.any(String),
    })
    expect(screen.getByLabelText('Khoa/phòng')).toBeEnabled()
    expect(screen.getByText('3 nhân viên')).toBeInTheDocument()
  })

  it('hiển thị đầy đủ cột và tô đỏ dòng chưa đạt', async () => {
    await renderAdmin()

    expect(screen.getByText('NV001')).toBeInTheDocument()
    expect(screen.getAllByText('7,25')).toHaveLength(2)
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('Không đạt')).toBeInTheDocument()
    expect(screen.getByText('Nhân viên 2').closest('tr').className).toContain('evd-row--danger')
  })

  it('hiện gạch ngang khi thiếu tỷ lệ đạt', async () => {
    await renderAdmin()
    expect(within(screen.getByText('Nhân viên 3').closest('tr')).getByText('—')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có dữ liệu', async () => {
    competency.getByField.mockResolvedValue(fieldResponse([]))
    render(<CompetencyByFieldPage />)
    expect(await screen.findByText('Chưa có dữ liệu đánh giá cho lĩnh vực này.')).toBeInTheDocument()
  })

  it('chịu được phản hồi rỗng', async () => {
    competency.getByField.mockResolvedValue({ data: { data: null } })
    render(<CompetencyByFieldPage />)
    expect(await screen.findByText('Chưa có dữ liệu đánh giá cho lĩnh vực này.')).toBeInTheDocument()
  })

  it('không gọi API khi chưa có khoa nào', async () => {
    admin.getDepartments.mockResolvedValue({ data: { data: [] } })
    render(<CompetencyByFieldPage />)
    await waitFor(() => expect(admin.getDepartments).toHaveBeenCalled())
    expect(competency.getByField).not.toHaveBeenCalled()
  })

  it('báo lỗi khi tải dữ liệu thất bại', async () => {
    competency.getByField.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<CompetencyByFieldPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('báo lỗi khi nạp danh sách khoa thất bại', async () => {
    admin.getDepartments.mockRejectedValue({ response: { data: { message: 'Lỗi tải khoa' } } })
    render(<CompetencyByFieldPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Lỗi tải khoa', 'error'))
  })

  it('bỏ qua lỗi khi nạp danh mục lĩnh vực', async () => {
    categoryApi.listCategories.mockRejectedValue(new Error('down'))
    await renderAdmin()
    expect(within(screen.getByLabelText('Lĩnh vực chuyên môn')).getAllByRole('option')).toHaveLength(1)
  })

  it('mở trang chi tiết khi bấm dòng hoặc nút xem', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByText('Nhân viên 1').closest('tr'))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/competency-by-field/1')

    navigate.mockClear()
    fireEvent.click(within(screen.getByText('Nhân viên 2').closest('tr')).getByRole('button'))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/competency-by-field/2')
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('tải lại dữ liệu bằng nút refresh', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByLabelText('Tải lại'))
    await waitFor(() => expect(competency.getByField).toHaveBeenCalledTimes(2))
  })
})

describe('CompetencyByFieldPage - chế độ quản lý khoa', () => {
  it('khoá khoa theo hồ sơ người dùng', async () => {
    await renderManager()

    expect(staff.getProfile).toHaveBeenCalled()
    expect(admin.getDepartments).not.toHaveBeenCalled()
    expect(competency.getByField).toHaveBeenCalledWith(expect.objectContaining({ departmentId: '5' }))
    expect(screen.getByLabelText('Khoa/phòng')).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Khoa Hồi sức' })).toBeInTheDocument()
  })

  it('dùng nhãn mặc định khi hồ sơ thiếu tên khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 5 } } })
    await renderManager()
    expect(screen.getByRole('option', { name: 'Khoa của tôi' })).toBeInTheDocument()
  })

  it('báo lỗi khi tài khoản quản lý chưa được gán khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: {} } })
    auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
    render(<CompetencyByFieldPage />)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
    expect(competency.getByField).not.toHaveBeenCalled()
  })

  it('mở trang chi tiết của quản lý khoa', async () => {
    await renderManager()
    fireEvent.click(screen.getByText('Nhân viên 1').closest('tr'))
    expect(navigate).toHaveBeenCalledWith('/manager/competency-by-field/1')
  })
})

describe('CompetencyByFieldPage - tìm kiếm và lọc', () => {
  it('lọc tại chỗ theo tên và mã nhân viên', async () => {
    await renderAdmin()

    fireEvent.change(searchBox(), { target: { value: 'nhân viên 2' } })
    await waitFor(() => expect(screen.queryByText('Nhân viên 1')).not.toBeInTheDocument())
    expect(screen.getByText('1 nhân viên')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'nv003' } })
    expect(await screen.findByText('Nhân viên 3')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    expect(await screen.findByText('Chưa có dữ liệu đánh giá cho lĩnh vực này.')).toBeInTheDocument()
  })

  it('áp dụng bộ lọc khoa, lĩnh vực và khoảng ngày', async () => {
    await renderAdmin()
    await waitFor(() => expect(screen.getByLabelText('Khoa/phòng').querySelector('option[value="4"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Khoa/phòng'), { target: { value: '4' } })
    await waitFor(() => expect(screen.getByLabelText('Lĩnh vực chuyên môn').querySelector('option[value="9"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR}-03-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(competency.getByField).toHaveBeenLastCalledWith({
      departmentId: '4', categoryId: '9', fromDate: `${THIS_YEAR}-03-01`, toDate: expect.any(String),
    }))
    expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '2')
  })

  it('chặn áp dụng khi khoảng ngày không hợp lệ', async () => {
    await renderAdmin()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
  })

  it('chặn áp dụng khi chưa chọn khoa', async () => {
    await renderAdmin()
    fireEvent.change(screen.getByLabelText('Khoa/phòng'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng chọn khoa/phòng.')
  })

  it('xoá lỗi ngày khi người dùng sửa lại', async () => {
    await renderAdmin()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(dateInputs()[1], { target: { value: `${THIS_YEAR}-12-31` } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc trả lĩnh vực và khoảng ngày về mặc định', async () => {
    await renderAdmin()
    await waitFor(() => expect(screen.getByLabelText('Lĩnh vực chuyên môn').querySelector('option[value="9"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '1'))

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '0'))
    expect(screen.getByLabelText('Lĩnh vực chuyên môn')).toHaveValue('')
  })
})
