import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvaluationDashboardPage from './EvaluationDashboardPage.jsx'

const showToast = vi.fn()
const dashboardApi = vi.hoisted(() => ({ getExamOverview: vi.fn() }))
const assignmentApi = vi.hoisted(() => ({ listManagerAssignments: vi.fn() }))
const paperApi = vi.hoisted(() => ({ listExamPapers: vi.fn() }))
const admin = vi.hoisted(() => ({ getDepartments: vi.fn() }))
const staff = vi.hoisted(() => ({ getProfile: vi.fn() }))
const training = vi.hoisted(() => ({ getRecordOptions: vi.fn() }))

vi.mock('../api/evaluationDashboardApi.js', () => ({ evaluationDashboardApi: dashboardApi }))
vi.mock('../api/examAssignmentApi.js', () => ({ examAssignmentApi: assignmentApi }))
vi.mock('../api/examPaperApi.js', () => ({ examPaperApi: paperApi }))
vi.mock('../../admin/api/adminApi.js', () => ({ adminApi: admin }))
vi.mock('../../staff/api/staffApi.js', () => ({ staffApi: staff }))
vi.mock('../../training/api/trainingApi.js', () => ({ trainingApi: training }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
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
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ activeCount, children, errorMessage, isOpen, onApply, onReset, onToggle }) => (
    <section>
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
    </section>
  ),
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive">{children}</div>,
  BarChart: ({ data = [] }) => <div data-testid="bar-chart">{data.map((row) => `${row.name}:${row.score}:${row.attempts}`).join('|')}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`

const overview = {
  assignmentCount: 12,
  targetCount: 240,
  notStartedCount: 30,
  attempts: { gradedAttempts: 180, passedAttempts: 140, failedAttempts: 40, passRate: 0.7778, averageScore: 7.256 },
  byProfessionalField: [
    { professionalFieldName: 'Kiểm soát nhiễm khuẩn', averageScore: 8.1, gradedAttempts: 60 },
    { professionalFieldName: null, averageScore: null, gradedAttempts: null },
  ],
  byPaper: [
    {
      paperId: 1, paperCode: 'DE-01', paperName: 'Đề kiểm soát nhiễm khuẩn', version: 2,
      professionalFieldNames: ['Kiểm soát nhiễm khuẩn', 'Vô khuẩn'],
      totalQuestions: 40, passingScore: 7, averageScore: 7.5, gradedAttempts: 100,
    },
    {
      paperId: 2, paperCode: null, paperName: null, version: null,
      professionalFieldNames: null, totalQuestions: null, passingScore: null, averageScore: null, gradedAttempts: 0,
    },
  ],
  employees: [{ id: 501, name: 'Nguyễn Văn A', employeeCode: 'NV001' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  dashboardApi.getExamOverview.mockResolvedValue({ data: { data: overview } })
  paperApi.listExamPapers.mockResolvedValue({ data: { data: [{ id: 1, code: 'DE-01', name: 'Đề kiểm soát nhiễm khuẩn' }] } })
  training.getRecordOptions.mockResolvedValue({ data: { data: { professionalFields: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn', code: 'KSNK' }] } } })
  admin.getDepartments.mockResolvedValue({ data: { data: { content: [{ id: 3, name: 'Khoa Ngoại', code: 'NGO' }] } } })
  assignmentApi.listManagerAssignments.mockResolvedValue({
    data: { data: [
      { examPaperId: 1, examPaperCode: 'DE-01', examPaperName: 'Đề A', professionalFieldId: 9, professionalFieldCode: 'KSNK', professionalFieldName: 'Kiểm soát nhiễm khuẩn' },
      { examPaperId: null, professionalFieldId: null, name: 'Đợt không đề' },
    ] },
  })
  staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 3, departmentName: 'Khoa Hồi sức' } } })
})

const renderAdmin = async () => {
  render(<EvaluationDashboardPage />)
  await screen.findByText('Đợt kiểm tra')
}
const renderManager = async () => {
  render(<EvaluationDashboardPage role="manager" />)
  await screen.findByText('Đợt kiểm tra')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const dateInputs = () => screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)

describe('EvaluationDashboardPage - chỉ số tổng hợp', () => {
  it('hiện trạng thái tải rồi đổ tám thẻ chỉ số', async () => {
    render(<EvaluationDashboardPage />)
    expect(screen.getByText('Đang tải kết quả bài kiểm tra...')).toBeInTheDocument()

    await screen.findByText('Đợt kiểm tra')
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('240')).toBeInTheDocument()
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getByText('140')).toBeInTheDocument()
    expect(screen.getAllByText('40').length).toBeGreaterThan(0)
    expect(screen.getByText('77,8%')).toBeInTheDocument()
    expect(screen.getByText('7,26/10')).toBeInTheDocument()
  })

  it('gọi API với khoảng ngày mặc định của năm hiện tại', async () => {
    await renderAdmin()
    expect(dashboardApi.getExamOverview).toHaveBeenCalledWith(expect.objectContaining({
      fromDate: `${FROM}T00:00:00`,
      departmentId: undefined,
      paperId: undefined,
      professionalFieldId: undefined,
      employeeId: undefined,
      resultStatus: undefined,
    }))
  })

  it('hiện gạch ngang cho mọi chỉ số còn thiếu', async () => {
    dashboardApi.getExamOverview.mockResolvedValue({ data: { data: {} } })
    await renderAdmin()
    expect(screen.getAllByText('—').length).toBeGreaterThan(4)
    expect(screen.getByText('—/10')).toBeInTheDocument()
  })

  it('coi giá trị không phải số là thiếu dữ liệu', async () => {
    dashboardApi.getExamOverview.mockResolvedValue({
      data: { data: { assignmentCount: 'abc', attempts: { passRate: '', averageScore: null } } },
    })
    await renderAdmin()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('báo lỗi qua toast và khối cảnh báo khi tải thất bại', async () => {
    dashboardApi.getExamOverview.mockRejectedValue({ response: { data: { message: 'Hết phiên đăng nhập' } } })
    render(<EvaluationDashboardPage />)

    expect(await screen.findByText('Hết phiên đăng nhập')).toBeInTheDocument()
    expect(showToast).toHaveBeenCalledWith('Hết phiên đăng nhập', 'error')
  })
})

describe('EvaluationDashboardPage - biểu đồ và bảng đề', () => {
  it('vẽ biểu đồ theo lĩnh vực và theo bài kiểm tra', async () => {
    await renderAdmin()
    const charts = screen.getAllByTestId('bar-chart')
    expect(charts[0]).toHaveTextContent('Kiểm soát nhiễm khuẩn:8.1:60')
    expect(charts[0]).toHaveTextContent('Chưa xác định:0:0')
    expect(charts[1]).toHaveTextContent('Đề kiểm soát nhiễm khuẩn:7.5:100')
  })

  it('hiện khối rỗng khi không có dữ liệu tổng hợp', async () => {
    dashboardApi.getExamOverview.mockResolvedValue({ data: { data: { attempts: {} } } })
    await renderAdmin()
    expect(screen.getAllByText('Chưa có dữ liệu tổng hợp')).toHaveLength(2)
    expect(screen.getByText('Chưa có bài kiểm tra phù hợp.')).toBeInTheDocument()
  })

  it('giới hạn biểu đồ ở 12 mục', async () => {
    dashboardApi.getExamOverview.mockResolvedValue({
      data: { data: { ...overview, byProfessionalField: Array.from({ length: 20 }, (_, index) => ({
        professionalFieldName: `LV${index}`, averageScore: index, gradedAttempts: index,
      })) } },
    })
    await renderAdmin()
    expect(screen.getAllByTestId('bar-chart')[0].textContent.split('|')).toHaveLength(12)
  })

  it('hiển thị đầy đủ các cột của bảng đề', async () => {
    await renderAdmin()
    expect(screen.getByText('DE-01')).toBeInTheDocument()
    expect(screen.getByText('Đề kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(screen.getByText('Kiểm soát nhiễm khuẩn, Vô khuẩn')).toBeInTheDocument()
    expect(screen.getByText('Phiên bản 2 · 100 lượt')).toBeInTheDocument()
    expect(screen.getByText('7/10')).toBeInTheDocument()
    expect(screen.getByText('7,50')).toBeInTheDocument()
    expect(screen.getByText('2 bài')).toBeInTheDocument()
  })

  it('điền gạch ngang cho dòng đề thiếu dữ liệu', async () => {
    await renderAdmin()
    const rows = screen.getAllByRole('row')
    const emptyRow = rows[rows.length - 1]
    expect(within(emptyRow).getAllByText('—').length).toBeGreaterThan(3)
  })
})

describe('EvaluationDashboardPage - bộ lọc', () => {
  it('nạp danh sách khoa, đề và lĩnh vực cho chế độ quản trị', async () => {
    await renderAdmin()
    openFilters()

    expect(screen.getByRole('option', { name: 'Khoa Ngoại' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Đề kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    expect(screen.getByLabelText('Khoa/phòng')).toBeEnabled()
  })

  it('áp dụng bộ lọc rồi gọi lại API và đếm số bộ lọc', async () => {
    await renderAdmin()
    openFilters()
    await waitFor(() => expect(screen.getByLabelText('Khoa/phòng').querySelector('option[value="3"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Khoa/phòng'), { target: { value: '3' } })
    await waitFor(() => expect(screen.getByLabelText('Bài kiểm tra').querySelector('option[value="1"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Bài kiểm tra'), { target: { value: '1' } })
    await waitFor(() => expect(screen.getByLabelText('Lĩnh vực chuyên môn').querySelector('option[value="9"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Nhân viên'), { target: { value: '501' } })
    fireEvent.change(screen.getByLabelText('Trạng thái kết quả'), { target: { value: 'PASSED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(dashboardApi.getExamOverview).toHaveBeenLastCalledWith(expect.objectContaining({
      departmentId: '3', paperId: '1', professionalFieldId: '9', employeeId: '501', resultStatus: 'PASSED',
    })))
    expect(screen.getByTestId('active-count')).toHaveTextContent('5')
    expect(screen.queryByLabelText('Khoa/phòng')).not.toBeInTheDocument()
  })

  it('chặn áp dụng khi khoảng ngày không hợp lệ', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(screen.getByLabelText('Khoa/phòng')).toBeInTheDocument()
  })

  it('xoá lỗi ngày khi người dùng sửa lại hoặc đóng bảng lọc', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(dateInputs()[1], { target: { value: `${THIS_YEAR}-06-30` } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('đếm khoảng ngày tuỳ chỉnh vào số bộ lọc đang bật', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR}-03-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('1'))
  })

  it('xoá bộ lọc đưa mọi tham số về mặc định', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái kết quả'), { target: { value: 'FAILED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('1'))

    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('0'))
  })

  it('hiện lỗi khi nạp dữ liệu bộ lọc thất bại', async () => {
    // Ở chế độ quản lý khoa, dashboard dừng sớm khi chưa có khoa nên lỗi nạp bộ lọc không bị ghi đè.
    assignmentApi.listManagerAssignments.mockRejectedValue({ response: { data: { message: 'Không tải được đợt giao' } } })
    render(<EvaluationDashboardPage role="manager" />)
    expect(await screen.findByText('Không tải được đợt giao')).toBeInTheDocument()
    expect(dashboardApi.getExamOverview).not.toHaveBeenCalled()
  })

  it('chịu được danh sách đề trả về dạng mảng phẳng', async () => {
    admin.getDepartments.mockResolvedValue({ data: { data: [{ id: 4, name: 'Khoa Dược' }] } })
    await renderAdmin()
    openFilters()
    expect(screen.getByRole('option', { name: 'Khoa Dược' })).toBeInTheDocument()
  })

  it('chịu được payload tuỳ chọn không có lĩnh vực', async () => {
    training.getRecordOptions.mockResolvedValue({ data: { data: {} } })
    await renderAdmin()
    openFilters()
    expect(within(screen.getByLabelText('Lĩnh vực chuyên môn')).getAllByRole('option')).toHaveLength(1)
  })
})

describe('EvaluationDashboardPage - chế độ quản lý khoa', () => {
  it('khoá bộ lọc khoa vào khoa của người dùng', async () => {
    await renderManager()

    expect(assignmentApi.listManagerAssignments).toHaveBeenCalled()
    expect(paperApi.listExamPapers).not.toHaveBeenCalled()
    await waitFor(() => expect(dashboardApi.getExamOverview).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: '3' }),
    ))
    openFilters()
    expect(screen.getByLabelText('Khoa/phòng')).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Khoa Hồi sức' })).toBeInTheDocument()
  })

  it('dựng danh sách đề và lĩnh vực từ các đợt được giao', async () => {
    await renderManager()
    openFilters()
    expect(screen.getByRole('option', { name: 'Đề A' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('Lĩnh vực chuyên môn')).getAllByRole('option')).toHaveLength(2)
  })

  it('không đếm bộ lọc khoa với tài khoản quản lý khoa', async () => {
    await renderManager()
    expect(screen.getByTestId('active-count')).toHaveTextContent('0')
  })

  it('giữ lại khoa của người dùng khi xoá bộ lọc', async () => {
    await renderManager()
    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    await waitFor(() => expect(dashboardApi.getExamOverview).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: '3' }),
    ))
  })

  it('báo lỗi khi tài khoản quản lý chưa được gán khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: {} } })
    render(<EvaluationDashboardPage role="manager" />)

    expect(await screen.findByText('Tài khoản Quản lý cấp Khoa chưa được gán khoa/phòng.')).toBeInTheDocument()
    expect(dashboardApi.getExamOverview).not.toHaveBeenCalled()
  })

  it('dùng nhãn mặc định khi hồ sơ thiếu tên khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 3 } } })
    await renderManager()
    openFilters()
    expect(screen.getByRole('option', { name: 'Khoa của tôi' })).toBeInTheDocument()
  })

  it.each([401, 403])('hiện thông báo thiếu quyền cho lỗi %i', async (status) => {
    dashboardApi.getExamOverview.mockRejectedValue({ response: { status } })
    render(<EvaluationDashboardPage role="manager" />)

    expect(await screen.findByText('Bạn chưa được cấp quyền xem tổng hợp điểm bài kiểm tra.')).toBeInTheDocument()
  })

  it('dùng thông báo chung cho các lỗi khác của quản lý khoa', async () => {
    dashboardApi.getExamOverview.mockRejectedValue({ status: 500, response: { data: { message: 'Máy chủ lỗi' } } })
    render(<EvaluationDashboardPage role="manager" />)
    expect(await screen.findByText('Máy chủ lỗi')).toBeInTheDocument()
  })

  it('chịu được danh sách đợt trả về dạng phân trang', async () => {
    assignmentApi.listManagerAssignments.mockResolvedValue({
      data: { data: { content: [{ examPaperId: 7, examPaperCode: 'DE-07', examPaperName: 'Đề G' }] } },
    })
    await renderManager()
    openFilters()
    expect(screen.getByRole('option', { name: 'Đề G' })).toBeInTheDocument()
  })
})
