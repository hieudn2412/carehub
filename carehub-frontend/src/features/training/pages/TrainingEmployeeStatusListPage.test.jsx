import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingEmployeeStatusListPage from './TrainingEmployeeStatusListPage.jsx'

const search = { current: new URLSearchParams() }
const api = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  getRecordOptions: vi.fn(),
  getEmployeeTrainingStatuses: vi.fn(),
}))
const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(), getRolesFromAccessToken: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [search.current],
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/auth/tokenStorage.js', () => ({ tokenStorage: { getAccessToken: auth.getAccessToken } }))
vi.mock('../../../shared/auth/jwt.js', () => ({ getRolesFromAccessToken: auth.getRolesFromAccessToken }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
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
  default: ({ activeCount, actions, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
      <div>{actions}</div>
    </section>
  ),
}))

const employee = (index, overrides = {}) => ({
  employeeId: index, employeeCode: `NV00${index}`, employeeName: `Nhân viên ${index}`,
  departmentName: 'Khoa Ngoại', jobPositionName: 'Điều dưỡng',
  submittedHours: 12, requiredHours: 24, progressPercentage: 50,
  complianceStatus: 'NON_COMPLIANT', ...overrides,
})

const pageResponse = (content, overrides = {}) => ({
  data: { success: true, data: { content, totalElements: content.length, totalPages: 1, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  search.current = new URLSearchParams()
  auth.getAccessToken.mockReturnValue('token')
  auth.getRolesFromAccessToken.mockReturnValue(['ADMIN'])
  api.getDepartments.mockResolvedValue({ data: { success: true, data: [{ id: 3, name: 'Khoa Ngoại', code: 'NGO' }] } })
  api.getRecordOptions.mockResolvedValue({ data: { data: { professionalFields: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn', code: 'KSNK' }] } } })
  api.getEmployeeTrainingStatuses.mockResolvedValue(pageResponse([
    employee(1),
    employee(2, { complianceStatus: 'COMPLIANT', submittedHours: 30, progressPercentage: 125 }),
    employee(3, { departmentName: null, jobPositionName: null, submittedHours: 0, requiredHours: 0, progressPercentage: null }),
  ]))
})

const renderPage = async (query = '') => {
  search.current = new URLSearchParams(query)
  render(<TrainingEmployeeStatusListPage />)
  await screen.findByText('Nhân viên 1')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const searchBox = () => screen.getByLabelText('Tìm nhân viên theo tên hoặc mã')

describe('TrainingEmployeeStatusListPage - danh sách', () => {
  it('tải danh sách và hiển thị tiến độ, trạng thái từng nhân viên', async () => {
    render(<TrainingEmployeeStatusListPage />)
    await screen.findByText('Nhân viên 1')
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith({
      page: 0, size: 10, keyword: undefined, departmentId: undefined, professionalFieldId: undefined,
    })
    expect(screen.getByText('12/24h')).toBeInTheDocument()
    expect(screen.getByText('30/24h')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa đạt')).toHaveLength(2)
    expect(screen.getByText('3 nhân viên')).toBeInTheDocument()
  })

  it('hiện trạng thái đang tải trong lúc chờ máy chủ', async () => {
    let resolveList
    api.getEmployeeTrainingStatuses.mockReturnValue(new Promise((resolve) => { resolveList = resolve }))
    render(<TrainingEmployeeStatusListPage />)

    expect(await screen.findByText('Đang tải dữ liệu...')).toBeInTheDocument()
    await act(async () => { resolveList(pageResponse([employee(1)])) })
    expect(screen.getByText('Nhân viên 1')).toBeInTheDocument()
  })

  it('điền giá trị mặc định cho khoa/phòng và chức danh còn trống', async () => {
    await renderPage()
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument()
    expect(screen.getByText('0/0h')).toBeInTheDocument()
  })

  it('coi là đạt khi giờ đã nộp vượt giờ yêu cầu dù backend chưa đánh dấu', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(pageResponse([
      employee(4, { complianceStatus: 'NON_COMPLIANT', submittedHours: 30, requiredHours: 24 }),
    ]))
    render(<TrainingEmployeeStatusListPage />)
    await screen.findByText('Nhân viên 4')
    expect(screen.getByText('Đạt')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có kết quả', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(pageResponse([]))
    render(<TrainingEmployeeStatusListPage />)
    expect(await screen.findByText('Không tìm thấy kết quả')).toBeInTheDocument()
    expect(screen.getByText('Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm.')).toBeInTheDocument()
  })

  it('bỏ qua phản hồi không thành công', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue({ data: { success: false } })
    render(<TrainingEmployeeStatusListPage />)
    expect(await screen.findByText('Không tìm thấy kết quả')).toBeInTheDocument()
  })

  it('nuốt lỗi mạng và thoát khỏi trạng thái tải', async () => {
    api.getEmployeeTrainingStatuses.mockRejectedValue(new Error('down'))
    render(<TrainingEmployeeStatusListPage />)
    expect(await screen.findByText('Không tìm thấy kết quả')).toBeInTheDocument()
  })

  it('tạo liên kết chi tiết cho từng nhân viên', async () => {
    await renderPage()
    expect(screen.getByLabelText('Xem chi tiết giờ đào tạo của Nhân viên 1'))
      .toHaveAttribute('href', '/training/employees/1')
  })
})

describe('TrainingEmployeeStatusListPage - bộ lọc từ URL', () => {
  it('nạp sẵn từ khoá, khoa và lĩnh vực từ query string', async () => {
    await renderPage('keyword=NV001&departmentId=3&professionalFieldId=9')
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith(expect.objectContaining({
      keyword: 'NV001', departmentId: '3', professionalFieldId: '9',
    }))
    expect(searchBox()).toHaveValue('NV001')
  })

  it.each([
    ['compliant=true', true],
    ['compliant=false', false],
  ])('chuyển %s thành tham số compliant', async (query, expected) => {
    await renderPage(query)
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith(expect.objectContaining({ compliant: expected }))
  })

  it('nhận complianceStatus hợp lệ từ query string', async () => {
    await renderPage('complianceStatus=COMPLIANT')
    openFilters()
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('COMPLIANT')
  })

  it('quy giá trị complianceStatus lạ về Chưa đạt', async () => {
    await renderPage('complianceStatus=AT_RISK')
    openFilters()
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('NON_COMPLIANT')
  })
})

describe('TrainingEmployeeStatusListPage - tìm kiếm và lọc', () => {
  it('tìm theo từ khoá sau debounce 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<TrainingEmployeeStatusListPage />)
      await screen.findByText('Nhân viên 1')
      fireEvent.change(searchBox(), { target: { value: '  Nam  ' } })

      act(() => void vi.advanceTimersByTime(300))
      await waitFor(() => expect(api.getEmployeeTrainingStatuses)
        .toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'Nam' })))
    } finally {
      vi.useRealTimers()
    }
  })

  it('áp dụng bộ lọc khoa, lĩnh vực và trạng thái', async () => {
    await renderPage()
    openFilters()
    fireEvent.change(screen.getByLabelText('Khoa/phòng'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'COMPLIANT' } })
    expect(screen.getByTestId('active-count')).toHaveTextContent('3')

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith({
      page: 0, size: 10, keyword: undefined, departmentId: '3', professionalFieldId: '9', compliant: true,
    }))
  })

  it('xoá bộ lọc trả mọi tham số về mặc định', async () => {
    await renderPage('departmentId=3&compliant=false')
    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith({
      page: 0, size: 10, keyword: undefined, departmentId: undefined, professionalFieldId: undefined,
    }))
    expect(screen.getByTestId('active-count')).toHaveTextContent('0')
  })

  it('ẩn bộ lọc lĩnh vực khi hệ thống chưa có lĩnh vực nào', async () => {
    api.getRecordOptions.mockResolvedValue({ data: { data: { professionalFields: [] } } })
    await renderPage()
    openFilters()
    expect(screen.queryByLabelText('Lĩnh vực chuyên môn')).not.toBeInTheDocument()
  })

  it('bỏ qua danh sách khoa khi phản hồi không thành công', async () => {
    api.getDepartments.mockResolvedValue({ data: { success: false } })
    await renderPage()
    openFilters()
    expect(within(screen.getByLabelText('Khoa/phòng')).getAllByRole('option')).toHaveLength(1)
  })

  it('vẫn chạy khi nạp dữ liệu tham chiếu thất bại', async () => {
    api.getDepartments.mockRejectedValue(new Error('down'))
    api.getRecordOptions.mockRejectedValue(new Error('down'))
    await renderPage()
    openFilters()
    expect(screen.getByLabelText('Khoa/phòng')).toBeInTheDocument()
  })

  it('chịu được phản hồi khoa thiếu mảng dữ liệu', async () => {
    api.getDepartments.mockResolvedValue({ data: { success: true, data: null } })
    await renderPage()
    openFilters()
    expect(within(screen.getByLabelText('Khoa/phòng')).getAllByRole('option')).toHaveLength(1)
  })
})

describe('TrainingEmployeeStatusListPage - phân trang', () => {
  const manyPages = (totalPages) => pageResponse([employee(1)], { totalElements: totalPages * 10, totalPages })

  it('chuyển trang bằng nút tiến/lùi và số trang', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(manyPages(5))
    render(<TrainingEmployeeStatusListPage />)
    await screen.findByText('Nhân viên 1')

    expect(screen.getByRole('button', { name: '<' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '>' }))
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))

    fireEvent.click(screen.getByRole('button', { name: '<' }))
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 })))

    fireEvent.click(screen.getByRole('button', { name: '5' }))
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(expect.objectContaining({ page: 4 })))
    expect(screen.getByRole('button', { name: '>' })).toBeDisabled()
  })

  it('rút gọn dải trang bằng dấu ba chấm ở hai đầu', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(manyPages(12))
    render(<TrainingEmployeeStatusListPage />)
    await screen.findByText('Nhân viên 1')

    // trang 1: chỉ có ba chấm ở cuối
    expect(screen.getAllByText('...')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '12' }))
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(expect.objectContaining({ page: 11 })))
    expect(screen.getAllByText('...')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: '11' }))
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(expect.objectContaining({ page: 10 })))
  })

  it('ẩn dải trang khi chỉ có một trang', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument()
    expect(screen.getByText('Hiển thị 3 / 3 kết quả')).toBeInTheDocument()
  })

  it('vô hiệu nút tiến khi backend trả về 0 trang', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(pageResponse([employee(1)], { totalPages: 0 }))
    render(<TrainingEmployeeStatusListPage />)
    await screen.findByText('Nhân viên 1')
    expect(screen.getByRole('button', { name: '>' })).toBeDisabled()
  })
})

describe('TrainingEmployeeStatusListPage - xuất kết quả', () => {
  let createObjectURL
  let revokeObjectURL
  let clickSpy
  let blobParts

  beforeEach(() => {
    blobParts = []
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL
    globalThis.Blob = class { constructor(parts) { blobParts.push(parts.join('')) } }
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('ẩn nút xuất với tài khoản không phải quản trị', async () => {
    auth.getRolesFromAccessToken.mockReturnValue(['MANAGER'])
    await renderPage()
    expect(screen.queryByRole('button', { name: /Xuất kết quả/ })).not.toBeInTheDocument()
  })

  it('coi là không có quyền khi chưa đăng nhập', async () => {
    auth.getAccessToken.mockReturnValue(null)
    await renderPage()
    expect(auth.getRolesFromAccessToken).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Xuất kết quả/ })).not.toBeInTheDocument()
  })

  it('xuất CSV kèm nhãn trạng thái tiếng Việt', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Xuất kết quả/ }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(blobParts[0]).toContain('"Mã NV"')
    expect(blobParts[0]).toContain('"Chưa đạt"')
    expect(blobParts[0]).toContain('"Đạt"')
    expect(blobParts[0]).toContain('"50%"')
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('gộp mọi trang khi dữ liệu vượt một trang', async () => {
    api.getEmployeeTrainingStatuses.mockImplementation(({ page, size }) => Promise.resolve(
      size === 100
        ? pageResponse([employee(page + 1)], { totalPages: 3 })
        : pageResponse([employee(1)]),
    ))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Xuất kết quả/ }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(blobParts[0]).toContain('NV001')
    expect(blobParts[0]).toContain('NV003')
  })

  it('chịu được trang sau thiếu mảng content', async () => {
    api.getEmployeeTrainingStatuses.mockImplementation(({ page, size }) => Promise.resolve(
      size !== 100
        ? pageResponse([employee(1)])
        : page === 0
          ? pageResponse([employee(1)], { totalPages: 2 })
          : { data: { success: true, data: {} } },
    ))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Xuất kết quả/ }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })

  it('chịu được trang đầu thiếu content khi xuất', async () => {
    api.getEmployeeTrainingStatuses.mockImplementation(({ size }) => Promise.resolve(
      size === 100 ? { data: { success: true, data: { totalPages: 1 } } } : pageResponse([employee(1)]),
    ))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Xuất kết quả/ }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })

  it('hiện lỗi khi xuất thất bại', async () => {
    api.getEmployeeTrainingStatuses.mockImplementation(({ size }) => (
      size === 100 ? Promise.reject(new Error('down')) : Promise.resolve(pageResponse([employee(1)]))
    ))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Xuất kết quả/ }))

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Không thể xuất dữ liệu theo bộ lọc hiện tại. Vui lòng thử lại.')
  })

  it('khoá nút xuất khi danh sách rỗng', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(pageResponse([]))
    render(<TrainingEmployeeStatusListPage />)
    await screen.findByText('Không tìm thấy kết quả')
    expect(screen.getByRole('button', { name: /Xuất kết quả/ })).toBeDisabled()
  })

  it('gửi kèm bộ lọc đang áp dụng khi xuất', async () => {
    await renderPage('departmentId=3&compliant=true')
    fireEvent.click(screen.getByRole('button', { name: /Xuất kết quả/ }))

    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith(expect.objectContaining({
      departmentId: '3', compliant: true, size: 100,
    })))
  })
})
