import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingStatusPage from './TrainingStatusPage.jsx'

const navigate = vi.fn()
const route = { params: {} }
const api = vi.hoisted(() => ({
  getEmployeeTrainingStatus: vi.fn(),
  getMyTrainingStatus: vi.fn(),
  getRecordOptions: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
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

const TODAY = new Date().toISOString().slice(0, 10)

const status = (overrides = {}) => ({
  employeeName: 'Nguyễn Văn A', employeeCode: 'NV001',
  status: 'COMPLIANT', warningMessage: 'Sắp đến hạn',
  requirementName: 'Chuẩn điều dưỡng', cycleYears: 5,
  windowStart: '2022-01-01', windowEnd: '2026-12-31',
  submittedHours: 18, requiredHours: 24, remainingHours: 6, progressPercentage: 75,
  yearlyHours: [{ year: 2026, submittedHours: 12 }, { year: 2025, submittedHours: null }],
  activityTypeHours: [{ activityTypeId: 1, activityTypeName: 'Hội thảo', submittedHours: 8 }],
  recentRecords: [
    { id: 1, title: 'Khoá cấp cứu', activityTypeName: 'Hội thảo', startDate: '2026-08-01', declaredHours: 8, workflowStatus: 'SUBMITTED' },
    { id: 2, title: 'Khoá nháp', activityTypeName: 'Tự học', startDate: '2026-08-05', declaredHours: null, workflowStatus: 'DRAFT' },
  ],
  attentionRecords: [
    { id: 3, title: 'Khoá bị từ chối', activityTypeName: 'Hội thảo', startDate: '2026-07-01', declaredHours: 4, workflowStatus: 'REJECTED' },
    { id: 4, title: 'Trạng thái lạ', activityTypeName: 'Khác', startDate: '2026-07-05', declaredHours: 2, workflowStatus: 'UNKNOWN' },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = {}
  api.getMyTrainingStatus.mockResolvedValue({ data: { data: status() } })
  api.getEmployeeTrainingStatus.mockResolvedValue({ data: { data: status({ employeeName: 'Trần Thị B', employeeCode: 'NV002' }) } })
  api.getRecordOptions.mockResolvedValue({ data: { data: { professionalFields: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn' }] } } })
})

const renderPage = async () => {
  render(<TrainingStatusPage />)
  await screen.findByText('Nguyễn Văn A')
}
const employeeInput = () => screen.getByPlaceholderText('Trống = tôi')

describe('TrainingStatusPage - trạng thái của tôi', () => {
  it('tải trạng thái cá nhân và hiển thị các thẻ tóm tắt', async () => {
    render(<TrainingStatusPage />)
    expect(screen.getByText('Loading training status...')).toBeInTheDocument()

    await screen.findByText('Nguyễn Văn A')
    expect(api.getMyTrainingStatus).toHaveBeenCalledWith({ professionalFieldId: undefined, asOf: TODAY })
    expect(api.getEmployeeTrainingStatus).not.toHaveBeenCalled()
    expect(screen.getByText('ĐẠT')).toBeInTheDocument()
    expect(screen.getByText('Sắp đến hạn')).toBeInTheDocument()
    expect(screen.getByText('Chuẩn điều dưỡng')).toBeInTheDocument()
    expect(screen.getByText('5 năm')).toBeInTheDocument()
    expect(screen.getByText('→ 2026-12-31')).toBeInTheDocument()
  })

  it('hiển thị tiến độ giờ đào tạo', async () => {
    await renderPage()
    expect(screen.getByText('18h')).toBeInTheDocument()
    expect(screen.getByText('đã nộp trên 24h yêu cầu')).toBeInTheDocument()
    expect(screen.getByText('6h')).toBeInTheDocument()
    expect(screen.getByText('còn thiếu (75%)')).toBeInTheDocument()
  })

  it('điền giá trị mặc định khi máy chủ thiếu dữ liệu', async () => {
    api.getMyTrainingStatus.mockResolvedValue({
      data: { data: { status: 'NON_COMPLIANT', employeeName: null, employeeCode: null, requirementName: null, cycleYears: null, windowStart: null, windowEnd: null } },
    })
    render(<TrainingStatusPage />)
    await screen.findByText('CHƯA ĐẠT')

    expect(screen.getByText('CHƯA CẤU HÌNH')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0h')).toHaveLength(2)
    expect(screen.getByText('đã nộp trên 0h yêu cầu')).toBeInTheDocument()
  })

  it('giới hạn thanh tiến độ ở 100%', async () => {
    api.getMyTrainingStatus.mockResolvedValue({ data: { data: status({ progressPercentage: 180 }) } })
    await renderPage()
    expect(document.querySelector('.training-progress span').style.width).toBe('100%')
  })

  it('hiện lỗi khi tải trạng thái thất bại', async () => {
    api.getMyTrainingStatus.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<TrainingStatusPage />)
    expect(await screen.findByText('Không có quyền')).toBeInTheDocument()
  })

  it('báo lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.getMyTrainingStatus.mockRejectedValue(new Error('down'))
    render(<TrainingStatusPage />)
    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })

  it('chịu được phản hồi tuỳ chọn thiếu lĩnh vực', async () => {
    api.getRecordOptions.mockResolvedValue({ data: { data: {} } })
    await renderPage()
    expect(within(screen.getByLabelText('Lĩnh vực chuyên môn')).getAllByRole('option')).toHaveLength(1)
  })
})

describe('TrainingStatusPage - trạng thái của nhân viên khác', () => {
  it('gọi API theo mã nhân viên trên URL', async () => {
    route.params = { employeeId: '55' }
    render(<TrainingStatusPage />)

    await screen.findByText('Trần Thị B')
    expect(api.getEmployeeTrainingStatus).toHaveBeenCalledWith('55', { professionalFieldId: undefined, asOf: TODAY })
    expect(api.getMyTrainingStatus).not.toHaveBeenCalled()
    expect(employeeInput()).toHaveValue('55')
  })

  it('mở trạng thái của nhân viên khác khi gửi biểu mẫu', async () => {
    await renderPage()
    fireEvent.change(employeeInput(), { target: { value: '  77  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))

    expect(navigate).toHaveBeenCalledWith('/training/status/77')
  })

  it('quay về trạng thái của tôi khi bỏ trống mã', async () => {
    route.params = { employeeId: '55' }
    render(<TrainingStatusPage />)
    await screen.findByText('Trần Thị B')

    fireEvent.change(employeeInput(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(navigate).toHaveBeenCalledWith('/training/status')
  })

  it('nút Mine xoá ô mã và quay về trạng thái cá nhân', async () => {
    route.params = { employeeId: '55' }
    render(<TrainingStatusPage />)
    await screen.findByText('Trần Thị B')

    fireEvent.click(screen.getByRole('button', { name: 'Mine' }))
    expect(employeeInput()).toHaveValue('')
    expect(navigate).toHaveBeenCalledWith('/training/status')
  })
})

describe('TrainingStatusPage - bộ lọc', () => {
  it('tải lại khi đổi lĩnh vực chuyên môn', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })

    await waitFor(() => expect(api.getMyTrainingStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ professionalFieldId: '9' }),
    ))
  })

  it('tải lại khi đổi mốc thời gian', async () => {
    await renderPage()
    fireEvent.change(screen.getByDisplayValue(TODAY), { target: { value: '2026-06-30' } })

    await waitFor(() => expect(api.getMyTrainingStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ asOf: '2026-06-30' }),
    ))
  })
})

describe('TrainingStatusPage - các bảng chi tiết', () => {
  it('hiển thị giờ theo năm và theo loại hoạt động', async () => {
    await renderPage()

    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getAllByText('Hội thảo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
  })

  it('điền gạch ngang cho ô thiếu dữ liệu trong bảng', async () => {
    await renderPage()
    const row = screen.getByText('2025').closest('tr')
    expect(within(row).getByText('-')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng cho bảng không có dữ liệu', async () => {
    api.getMyTrainingStatus.mockResolvedValue({
      data: { data: status({ yearlyHours: [], activityTypeHours: [], recentRecords: [], attentionRecords: [] }) },
    })
    await renderPage()

    expect(screen.getAllByText('Không có dữ liệu.')).toHaveLength(2)
    expect(screen.getAllByText('Không có record.')).toHaveLength(2)
  })

  it('chịu được phản hồi thiếu hẳn các mảng chi tiết', async () => {
    api.getMyTrainingStatus.mockResolvedValue({ data: { data: { employeeName: 'Nguyễn Văn A', status: 'COMPLIANT' } } })
    await renderPage()

    expect(screen.getAllByText('Không có dữ liệu.')).toHaveLength(2)
    expect(screen.getAllByText('Không có record.')).toHaveLength(2)
  })

  it('dịch trạng thái hồ sơ sang tiếng Việt', async () => {
    await renderPage()

    expect(screen.getByText('Đã nộp')).toBeInTheDocument()
    expect(screen.getByText('Bản nháp')).toBeInTheDocument()
    expect(screen.getByText('Từ chối')).toBeInTheDocument()
    // trạng thái lạ giữ nguyên mã
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })

  it('điền gạch ngang cho giờ khai báo còn trống', async () => {
    await renderPage()
    expect(within(screen.getByText('Khoá nháp').closest('tr')).getByText('-')).toBeInTheDocument()
  })

  it('hiện gạch ngang khi hồ sơ không có trạng thái', async () => {
    api.getMyTrainingStatus.mockResolvedValue({
      data: { data: status({ recentRecords: [{ id: 9, title: 'Không trạng thái', activityTypeName: 'X', startDate: '2026-01-01', declaredHours: 1, workflowStatus: null }] }) },
    })
    await renderPage()
    expect(within(screen.getByText('Không trạng thái').closest('tr')).getByText('-')).toBeInTheDocument()
  })
})
