import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DepartmentTrainingStaffTable from './DepartmentTrainingStaffTable.jsx'

const navigate = vi.fn()
const api = vi.hoisted(() => ({ getEmployeeTrainingStatuses: vi.fn() }))
const exportMock = vi.hoisted(() => ({ downloadCsv: vi.fn(), exportFileName: vi.fn(() => 'nhan-su.csv') }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/trainingApi', () => ({ trainingApi: api }))
vi.mock('../../../shared/utils/tableExport.js', () => exportMock)
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options }) => (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))
vi.mock('../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset }) => (
    <>
      <button onClick={onApply}>Áp dụng</button>
      <button onClick={onReset}>Xóa bộ lọc</button>
    </>
  ),
}))

const employee = (id, overrides = {}) => ({
  employeeId: id,
  employeeCode: `NV00${id}`,
  employeeName: `Nhân viên ${id}`,
  jobPositionName: 'Điều dưỡng',
  departmentName: 'Khoa Nội',
  submittedHours: 18,
  requiredHours: 24,
  complianceStatus: 'COMPLIANT',
  ...overrides,
})

const listResponse = (content) => ({ data: { data: { content } } })

beforeEach(() => {
  vi.clearAllMocks()
  exportMock.exportFileName.mockReturnValue('nhan-su.csv')
  api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([employee(1), employee(2, { complianceStatus: 'AT_RISK' })]))
})

afterEach(() => vi.useRealTimers())

const renderTable = async (props) => {
  render(<DepartmentTrainingStaffTable {...props} />)
  await screen.findByText('Nhân viên 1')
}
const searchInput = () => screen.getByLabelText('Tìm nhân sự trong khoa')

describe('DepartmentTrainingStaffTable - tải danh sách', () => {
  it('tải và hiển thị nhân sự trong khoa', async () => {
    render(<DepartmentTrainingStaffTable />)
    expect(screen.getByText(/Đang tải danh sách nhân sự/)).toBeInTheDocument()

    await screen.findByText('Nhân viên 1')
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith({
      size: 100, keyword: undefined, complianceStatus: undefined,
    })
    expect(screen.getByText('NV001')).toBeInTheDocument()
    expect(screen.getAllByText('Điều dưỡng')).toHaveLength(2)
    expect(screen.getAllByText('18h / 24h')).toHaveLength(2)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Đạt')).toBeInTheDocument()
    expect(within(table).getByText('Đang theo dõi')).toBeInTheDocument()
  })

  it('dùng kích thước trang tuỳ chọn', async () => {
    await renderTable({ pageSize: 20 })
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith(expect.objectContaining({ size: 20 }))
  })

  it('điền gạch ngang và số 0 cho dữ liệu còn trống', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([employee(1, {
      jobPositionName: null, departmentName: null, submittedHours: null, requiredHours: null,
    })]))
    await renderTable()

    const row = screen.getByText('Nhân viên 1').closest('tr')
    expect(within(row).getAllByText('---')).toHaveLength(2)
    expect(within(row).getByText('0h / 0h')).toBeInTheDocument()
  })

  it.each([
    ['NON_COMPLIANT', 'Chưa đạt'],
    ['NOT_CONFIGURED', 'Chưa thiết lập'],
    ['UNKNOWN_STATUS', 'Chưa rõ'],
    [null, 'Chưa rõ'],
  ])('hiển thị trạng thái %s', async (complianceStatus, label) => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([employee(1, { complianceStatus })]))
    await renderTable()
    expect(within(screen.getByRole('table')).getByText(label)).toBeInTheDocument()
  })

  it('hiện thông báo khi không có nhân sự nào', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([]))
    render(<DepartmentTrainingStaffTable />)
    expect(await screen.findByText('Không tìm thấy nhân sự nào.')).toBeInTheDocument()
  })

  it('chịu được phản hồi rỗng', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue({ data: {} })
    render(<DepartmentTrainingStaffTable />)
    expect(await screen.findByText('Không tìm thấy nhân sự nào.')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải danh sách thất bại', async () => {
    api.getEmployeeTrainingStatuses.mockRejectedValue(new Error('down'))
    render(<DepartmentTrainingStaffTable />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách nhân sự trong khoa.')
  })
})

describe('DepartmentTrainingStaffTable - thanh công cụ', () => {
  it('tìm kiếm với độ trễ 400ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<DepartmentTrainingStaffTable />)
    await screen.findByText('Nhân viên 1')

    fireEvent.change(searchInput(), { target: { value: '  An  ' } })
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'An' }),
    ))
  })

  it('bỏ qua từ khoá chỉ có khoảng trắng', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<DepartmentTrainingStaffTable />)
    await screen.findByText('Nhân viên 1')

    fireEvent.change(searchInput(), { target: { value: '   ' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: undefined }),
    ))
  })

  it('lọc theo trạng thái đào tạo', async () => {
    await renderTable()
    fireEvent.change(screen.getByLabelText('Trạng thái đào tạo'), { target: { value: 'NON_COMPLIANT' } })

    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(
      expect.objectContaining({ complianceStatus: 'NON_COMPLIANT' }),
    ))
  })

  it('xoá bộ lọc đưa về trạng thái ban đầu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<DepartmentTrainingStaffTable />)
    await screen.findByText('Nhân viên 1')

    fireEvent.change(searchInput(), { target: { value: 'An' } })
    fireEvent.change(screen.getByLabelText('Trạng thái đào tạo'), { target: { value: 'AT_RISK' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(searchInput()).toHaveValue('')
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(api.getEmployeeTrainingStatuses).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: undefined, complianceStatus: undefined }),
    ))
  })

  it('nút Áp dụng không gây thêm yêu cầu nào', async () => {
    await renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledTimes(1)
  })

  it('xuất danh sách ra file CSV', async () => {
    await renderTable()
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }))

    expect(exportMock.exportFileName).toHaveBeenCalledWith('nhan-su-dao-tao-lien-tuc')
    expect(exportMock.downloadCsv).toHaveBeenCalledWith(
      'nhan-su.csv',
      ['Mã NV', 'Họ và tên', 'Chức danh', 'Khoa / Phòng', 'Giờ đã nộp', 'Giờ yêu cầu', 'Còn thiếu', 'Trạng thái'],
      [
        ['NV001', 'Nhân viên 1', 'Điều dưỡng', 'Khoa Nội', 18, 24, 6, 'Đạt'],
        ['NV002', 'Nhân viên 2', 'Điều dưỡng', 'Khoa Nội', 18, 24, 6, 'Đang theo dõi'],
      ],
    )
  })

  it('xuất số 0 và chuỗi rỗng cho dữ liệu thiếu', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([employee(1, {
      jobPositionName: null, departmentName: null, submittedHours: null, requiredHours: 12,
    })]))
    await renderTable()
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }))

    expect(exportMock.downloadCsv).toHaveBeenCalledWith(
      'nhan-su.csv', expect.any(Array),
      [['NV001', 'Nhân viên 1', '', '', 0, 12, 12, 'Đạt']],
    )
  })

  it('khoá nút xuất khi danh sách rỗng', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([]))
    render(<DepartmentTrainingStaffTable />)
    await screen.findByText('Không tìm thấy nhân sự nào.')

    expect(screen.getByRole('button', { name: /Xuất Excel/ })).toBeDisabled()
  })
})

describe('DepartmentTrainingStaffTable - chế độ nhúng', () => {
  it('ẩn thanh công cụ và dùng bộ lọc bên ngoài', async () => {
    await renderTable({
      hideToolbar: true,
      externalFilters: { keyword: 'An', complianceStatus: 'AT_RISK', asOf: '2026-06-30', professionalFieldId: 9 },
    })

    expect(screen.queryByLabelText('Tìm nhân sự trong khoa')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xuất Excel/ })).not.toBeInTheDocument()
    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith({
      size: 100, keyword: 'An', complianceStatus: 'AT_RISK', asOf: '2026-06-30', professionalFieldId: 9,
    })
  })

  it('bỏ qua các bộ lọc ngoài còn trống', async () => {
    await renderTable({ hideToolbar: true, externalFilters: { keyword: '', complianceStatus: '' } })

    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith({
      size: 100, keyword: '', complianceStatus: undefined,
    })
  })

  it('chịu được chế độ nhúng không có bộ lọc ngoài', async () => {
    await renderTable({ hideToolbar: true })

    expect(api.getEmployeeTrainingStatuses).toHaveBeenCalledWith({
      size: 100, keyword: undefined, complianceStatus: undefined,
    })
  })
})

describe('DepartmentTrainingStaffTable - điều hướng', () => {
  it('mở trang chi tiết đào tạo của nhân viên', async () => {
    await renderTable()
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết đào tạo của Nhân viên 1' }))

    expect(navigate).toHaveBeenCalledWith('/training/employees/1')
  })

  it('dùng mã nhân viên làm nhãn khi thiếu tên', async () => {
    api.getEmployeeTrainingStatuses.mockResolvedValue(listResponse([employee(1, { employeeName: null })]))
    render(<DepartmentTrainingStaffTable />)
    await screen.findByText('NV001')

    expect(screen.getByRole('button', { name: 'Xem chi tiết đào tạo của NV001' })).toBeInTheDocument()
  })
})
