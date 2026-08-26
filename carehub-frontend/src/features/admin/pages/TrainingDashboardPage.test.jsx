import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingDashboardPage from './TrainingDashboardPage.jsx'

const navigate = vi.fn()
const staff = vi.hoisted(() => ({ getProfile: vi.fn() }))
const training = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  getRecordOptions: vi.fn(),
  getTrainingDashboardSummary: vi.fn(),
  getEmployeeTrainingStatuses: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../../staff/api/staffApi.js', () => ({ staffApi: staff }))
vi.mock('../../training/api/trainingApi.js', () => ({ trainingApi: training }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ProgressRing.jsx', () => ({
  default: ({ progress }) => <span data-testid="progress-ring">{progress}</span>,
}))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Tính đến ngày" type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
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
  default: ({ activeCount, actions, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchValue }) => (
    <section>
      <input aria-label="Tìm nhân sự" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-filter-count">{activeCount}</span>
      {isOpen && (
        <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>
      )}
      <div>{actions}</div>
    </section>
  ),
}))
vi.mock('../components/ChartConfigPanel.jsx', () => ({
  default: ({ sortOrder, onSortOrderChange, displayLimit, onDisplayLimitChange }) => (
    <div>
      <button onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}>Đổi thứ tự</button>
      <button onClick={() => onDisplayLimitChange('2')}>Giới hạn 2</button>
      <button onClick={() => onDisplayLimitChange('all')}>Xem tất cả</button>
      <button onClick={() => onDisplayLimitChange('xyz')}>Giới hạn sai</button>
      <span>{sortOrder}-{displayLimit}</span>
    </div>
  ),
}))
vi.mock('../../training/components/DepartmentTrainingStaffTable.jsx', () => ({
  default: ({ externalFilters }) => <div data-testid="dept-staff-table">{JSON.stringify(externalFilters)}</div>,
}))
vi.mock('recharts', () => {
  const React = globalThis.React
  const stub = (name) => function Stub() { return <span data-testid={name} /> }
  return {
    ResponsiveContainer: ({ children }) => <div data-testid="responsive">{children}</div>,
    BarChart: ({ data = [], children }) => {
      const kids = React.Children.toArray(children)
      const axis = kids.find((kid) => kid?.props?.tick && typeof kid.props.tick === 'object')
      return (
        <div data-testid="bar-chart">
          <span data-testid="chart-series">{data.map((row) => `${row.name}:${row.rate ?? row.hours}`).join('|')}</span>
          {axis && data.map((row, index) => (
            <svg key={index}>{React.cloneElement(axis.props.tick, { x: 0, y: 0, payload: { value: row.name } })}</svg>
          ))}
          {kids.filter((kid) => kid?.props?.dataKey === 'rate' || kid?.props?.dataKey === 'hours')}
        </div>
      )
    },
    Bar: ({ children }) => <div data-testid="bar">{children}</div>,
    Cell: stub('cell'),
    LabelList: stub('label-list'),
    CartesianGrid: stub('grid'),
    XAxis: stub('x-axis'),
    YAxis: stub('y-axis'),
    Tooltip: stub('tooltip'),
    Pie: stub('pie'),
    PieChart: ({ children }) => <div>{children}</div>,
  }
})

const TODAY = new Date().toISOString().slice(0, 10)

const summary = {
  totals: {
    employeeCount: 120, configuredCount: 100, notConfiguredCount: 20,
    compliantCount: 90, atRiskCount: 10, nonCompliantCount: 30,
    submittedHours: 480, requiredHours: 600, remainingHours: 120, complianceRate: 75,
  },
  byDepartment: [
    { departmentName: 'Khoa Ngoại', employeeCount: 40, complianceRate: 85 },
    { departmentName: 'Khoa Nội', employeeCount: 50, complianceRate: 60 },
    { departmentName: null, employeeCount: 30, complianceRate: 40 },
  ],
  byProfessionalField: [
    { professionalFieldName: 'Kiểm soát nhiễm khuẩn', submittedHours: 200 },
    { professionalFieldName: 'Hồi sức cấp cứu chuyên sâu nâng cao', submittedHours: 150 },
    { professionalFieldName: null, submittedHours: 50 },
  ],
  byActivityType: [
    { activityTypeName: 'Hội thảo', submittedHours: 300 },
    { activityTypeName: 'Tự học', submittedHours: 120 },
    { activityTypeName: null, submittedHours: 60 },
  ],
}

const employeeRow = (index) => ({
  employeeId: index, employeeCode: `NV${index}`, employeeName: `Nhân viên ${index}`,
  departmentName: 'Khoa Ngoại', positionName: 'Điều dưỡng',
  requiredHours: 24, submittedHours: 12, remainingHours: 12, complianceStatus: 'NON_COMPLIANT',
})

beforeEach(() => {
  vi.clearAllMocks()
  training.getDepartments.mockResolvedValue({ data: { data: [{ id: 1, name: 'Khoa Ngoại' }] } })
  training.getRecordOptions.mockResolvedValue({
    data: { data: { professionalFields: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn' }] } },
  })
  training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: summary } })
  training.getEmployeeTrainingStatuses.mockResolvedValue({
    data: { data: { content: [employeeRow(1)], totalPages: 1 } },
  })
  staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 3, departmentName: 'Khoa Hồi sức' } } })
})

const renderAdmin = async () => {
  render(<TrainingDashboardPage />)
  await screen.findByText('Tổng nhân viên')
}
const renderManager = async () => {
  render(<TrainingDashboardPage role="manager" />)
  await screen.findByText('Tổng nhân viên')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const cardOf = (heading) => screen.getByRole('heading', { name: heading }).closest('article')

describe('TrainingDashboardPage - chỉ số tổng hợp', () => {
  it('hiện trạng thái tải rồi đổ ba thẻ KPI', async () => {
    render(<TrainingDashboardPage />)
    expect(screen.getByText('Đang tải thống kê đào tạo...')).toBeInTheDocument()

    await screen.findByText('Tổng nhân viên')
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('75,0% nhân viên')).toBeInTheDocument()
    const rings = screen.getAllByTestId('progress-ring')
    expect(rings[0]).toHaveTextContent('75')
    expect(rings[1]).toHaveTextContent('25')
  })

  it('gọi API tổng hợp với bộ lọc rỗng ở lần tải đầu', async () => {
    await renderAdmin()
    expect(training.getTrainingDashboardSummary).toHaveBeenCalledWith({
      departmentId: undefined, professionalFieldId: undefined, complianceStatus: undefined, asOf: TODAY,
    })
  })

  it('coi mọi số liệu thiếu là 0', async () => {
    training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: {} } })
    await renderAdmin()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getByText('0,0% nhân viên')).toBeInTheDocument()
    expect(screen.getAllByTestId('progress-ring')[1]).toHaveTextContent('0')
  })

  it('hiện khối rỗng khi không có nhân viên nào khớp bộ lọc', async () => {
    training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: { totals: { employeeCount: 0 } } } })
    await renderAdmin()
    expect(screen.getByText('Chưa có dữ liệu đào tạo phù hợp')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tỷ lệ hoàn thành theo khoa' })).not.toBeInTheDocument()
  })

  it('hiện cảnh báo khi tải thống kê thất bại', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    render(<TrainingDashboardPage />)
    expect(await screen.findByText('Không thể tải thống kê giờ đào tạo từ máy chủ.')).toBeInTheDocument()
  })
})

describe('TrainingDashboardPage - biểu đồ', () => {
  it('vẽ ba biểu đồ với dữ liệu đã sắp xếp giảm dần', async () => {
    await renderAdmin()

    expect(within(cardOf('Tỷ lệ hoàn thành theo khoa')).getByTestId('chart-series'))
      .toHaveTextContent('Khoa Ngoại:85|Khoa Nội:60|Chưa xác định:40')
    expect(within(cardOf('Tổng giờ đào tạo theo lĩnh vực')).getByTestId('chart-series'))
      .toHaveTextContent('Kiểm soát nhiễm khuẩn:200|Hồi sức cấp cứu chuyên sâu nâng cao:150|Chưa xác định:50')
    expect(within(cardOf('Tổng giờ đào tạo theo hình thức')).getByTestId('chart-series'))
      .toHaveTextContent('Hội thảo:300|Tự học:120|Chưa xác định:60')
  })

  it('đảo thứ tự sắp xếp từng biểu đồ độc lập', async () => {
    await renderAdmin()
    const deptCard = cardOf('Tỷ lệ hoàn thành theo khoa')
    fireEvent.click(within(deptCard).getByRole('button', { name: 'Đổi thứ tự' }))

    expect(within(cardOf('Tỷ lệ hoàn thành theo khoa')).getByTestId('chart-series'))
      .toHaveTextContent('Chưa xác định:40|Khoa Nội:60|Khoa Ngoại:85')
    // biểu đồ khác không bị ảnh hưởng
    expect(within(cardOf('Tổng giờ đào tạo theo lĩnh vực')).getByTestId('chart-series'))
      .toHaveTextContent('Kiểm soát nhiễm khuẩn:200')
  })

  it.each([
    ['Tổng giờ đào tạo theo lĩnh vực', 'Hồi sức cấp cứu chuyên sâu nâng cao:150|Kiểm soát nhiễm khuẩn:200'],
    ['Tổng giờ đào tạo theo hình thức', 'Chưa xác định:60|Tự học:120|Hội thảo:300'],
  ])('sắp xếp tăng dần cho biểu đồ %s', async (heading, expected) => {
    await renderAdmin()
    fireEvent.click(within(cardOf(heading)).getByRole('button', { name: 'Đổi thứ tự' }))
    expect(within(cardOf(heading)).getByTestId('chart-series')).toHaveTextContent(expected)
  })

  it('giới hạn số cột hiển thị và bỏ giới hạn khi chọn tất cả', async () => {
    await renderAdmin()
    const card = () => cardOf('Tỷ lệ hoàn thành theo khoa')

    fireEvent.click(within(card()).getByRole('button', { name: 'Giới hạn 2' }))
    expect(within(card()).getByTestId('chart-series')).toHaveTextContent('Khoa Ngoại:85|Khoa Nội:60')
    expect(within(card()).getByTestId('chart-series')).not.toHaveTextContent('Chưa xác định')

    fireEvent.click(within(card()).getByRole('button', { name: 'Xem tất cả' }))
    expect(within(card()).getByTestId('chart-series')).toHaveTextContent('Chưa xác định:40')
  })

  it('rơi về giới hạn 12 khi giá trị giới hạn không phải số', async () => {
    await renderAdmin()
    for (const heading of ['Tỷ lệ hoàn thành theo khoa', 'Tổng giờ đào tạo theo lĩnh vực', 'Tổng giờ đào tạo theo hình thức']) {
      fireEvent.click(within(cardOf(heading)).getByRole('button', { name: 'Giới hạn sai' }))
      expect(within(cardOf(heading)).getByTestId('chart-series').textContent.split('|')).toHaveLength(3)
    }
  })

  it('ngắt nhãn dài thành nhiều dòng và giữ tên đầy đủ ở tooltip', async () => {
    await renderAdmin()
    const fieldCard = cardOf('Tổng giờ đào tạo theo lĩnh vực')
    expect(within(fieldCard).getByText('Hồi sức cấp cứu chuyên sâu nâng cao', { selector: 'title' })).toBeInTheDocument()
    expect(within(fieldCard).getByText('Kiểm soát')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng riêng cho từng biểu đồ không có dữ liệu', async () => {
    training.getTrainingDashboardSummary.mockResolvedValue({
      data: { data: { totals: summary.totals, byDepartment: [], byProfessionalField: [], byActivityType: [] } },
    })
    await renderAdmin()
    expect(screen.getByText('Chưa có dữ liệu theo khoa trong phạm vi này.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có dữ liệu theo lĩnh vực trong phạm vi này.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có dữ liệu theo hình thức trong phạm vi này.')).toBeInTheDocument()
  })
})

describe('TrainingDashboardPage - bộ lọc', () => {
  it('áp dụng bộ lọc rồi gọi lại API và đếm số bộ lọc đang bật', async () => {
    await renderAdmin()
    openFilters()
    await waitFor(() => expect(screen.getByLabelText('Khoa/Phòng').querySelector('option[value="1"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Khoa/Phòng'), { target: { value: '1' } })
    await waitFor(() => expect(screen.getByLabelText('Lĩnh vực chuyên môn').querySelector('option[value="9"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'COMPLIANT' } })
    fireEvent.change(screen.getByLabelText('Tính đến ngày'), { target: { value: '2026-01-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(training.getTrainingDashboardSummary).toHaveBeenLastCalledWith({
      departmentId: '1', professionalFieldId: '9', complianceStatus: 'COMPLIANT', asOf: '2026-01-31',
    }))
    expect(screen.getByTestId('active-filter-count')).toHaveTextContent('4')
    // bảng lọc tự đóng sau khi áp dụng
    expect(screen.queryByLabelText('Khoa/Phòng')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc đưa mọi tham số về mặc định', async () => {
    await renderAdmin()
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'COMPLIANT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByTestId('active-filter-count')).toHaveTextContent('1'))

    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('active-filter-count')).toHaveTextContent('0'))
  })

  it('nạp danh sách khoa dạng phân trang', async () => {
    training.getDepartments.mockResolvedValue({ data: { data: { content: [{ id: 4, name: 'Khoa Dược' }] } } })
    await renderAdmin()
    openFilters()
    expect(screen.getByRole('option', { name: 'Khoa Dược' })).toBeInTheDocument()
  })

  it('vẫn hiển thị dashboard khi nạp dữ liệu tham chiếu thất bại', async () => {
    training.getDepartments.mockRejectedValue(new Error('down'))
    training.getRecordOptions.mockRejectedValue(new Error('down'))
    await renderAdmin()
    openFilters()
    expect(within(screen.getByLabelText('Khoa/Phòng')).getAllByRole('option')).toHaveLength(1)
  })

  it('bỏ qua danh sách lĩnh vực khi máy chủ không trả về', async () => {
    training.getRecordOptions.mockResolvedValue({ data: { data: {} } })
    await renderAdmin()
    openFilters()
    expect(within(screen.getByLabelText('Lĩnh vực chuyên môn')).getAllByRole('option')).toHaveLength(1)
  })
})

describe('TrainingDashboardPage - chế độ quản lý khoa', () => {
  it('lấy khoa từ hồ sơ và thay biểu đồ khoa bằng bảng nhân sự', async () => {
    await renderManager()

    expect(staff.getProfile).toHaveBeenCalled()
    expect(training.getDepartments).not.toHaveBeenCalled()
    await waitFor(() => expect(training.getTrainingDashboardSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: 3 }),
    ))
    expect(screen.getByRole('heading', { name: 'Nhân sự trong khoa' })).toBeInTheDocument()
    expect(screen.getAllByText('Khoa Hồi sức').length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Tỷ lệ hoàn thành theo khoa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tổng giờ đào tạo theo lĩnh vực' })).not.toBeInTheDocument()
  })

  it('truyền bộ lọc hiện hành xuống bảng nhân sự', async () => {
    await renderManager()
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'NON_COMPLIANT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(screen.getByTestId('dept-staff-table'))
      .toHaveTextContent('"complianceStatus":"NON_COMPLIANT"'))
  })

  it('không đếm bộ lọc khoa với tài khoản quản lý khoa', async () => {
    await renderManager()
    expect(screen.getByTestId('active-filter-count')).toHaveTextContent('0')
  })

  it('báo lỗi khi tài khoản quản lý chưa được gán khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: {} } })
    render(<TrainingDashboardPage role="manager" />)

    expect(await screen.findByText(/chưa được gán khoa\/phòng/)).toBeInTheDocument()
    expect(training.getTrainingDashboardSummary).not.toHaveBeenCalled()
  })

  it('ẩn nút xem chi tiết với tài khoản quản lý khoa', async () => {
    await renderManager()
    expect(screen.queryByRole('button', { name: /Xem chi tiết/ })).not.toBeInTheDocument()
  })
})

describe('TrainingDashboardPage - xuất danh sách', () => {
  let createObjectURL
  let revokeObjectURL
  let clickSpy

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('điều hướng sang trang chi tiết giờ đào tạo', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }))
    expect(navigate).toHaveBeenCalledWith('/training/employees')
  })

  it('tải toàn bộ nhân viên rồi tạo tệp CSV', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(training.getEmployeeTrainingStatuses).toHaveBeenCalledWith(expect.objectContaining({ page: 0, size: 100 }))
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('gộp mọi trang khi backend trả về nhiều trang', async () => {
    training.getEmployeeTrainingStatuses.mockImplementation(({ page }) => Promise.resolve({
      data: { data: { content: [employeeRow(page + 1)], totalPages: 3 } },
    }))
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))

    await waitFor(() => expect(training.getEmployeeTrainingStatuses).toHaveBeenCalledTimes(3))
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('chịu được trang sau trả về payload thiếu content', async () => {
    training.getEmployeeTrainingStatuses.mockImplementation(({ page }) => Promise.resolve(
      page === 0
        ? { data: { data: { content: [employeeRow(1)], totalPages: 2 } } }
        : { data: { data: {} } },
    ))
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })

  it('chịu được phản hồi thiếu mảng content ở trang đầu', async () => {
    training.getEmployeeTrainingStatuses.mockResolvedValue({ data: { data: { content: null, totalPages: null } } })
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })

  it('điền giá trị mặc định cho nhân viên thiếu thông tin', async () => {
    const blobText = []
    globalThis.Blob = class { constructor(parts) { blobText.push(parts.join('')) } }
    training.getEmployeeTrainingStatuses.mockResolvedValue({
      data: { data: { content: [{ employeeId: 1, jobPositionName: 'Kỹ thuật viên', complianceStatus: 'COMPLIANT' }], totalPages: 1 } },
    })
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))

    await waitFor(() => expect(blobText.length).toBeGreaterThan(0))
    expect(blobText[0]).toContain('"Chưa xác định"')
    expect(blobText[0]).toContain('"Kỹ thuật viên"')
    expect(blobText[0]).toContain('"Đạt"')
  })

  it('báo lỗi khi tải danh sách xuất báo cáo thất bại', async () => {
    training.getEmployeeTrainingStatuses.mockRejectedValue(new Error('down'))
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))

    expect(await screen.findByText('Không thể tải danh sách nhân viên để xuất báo cáo.')).toBeInTheDocument()
  })

  it('khoá nút xuất khi không có nhân viên nào', async () => {
    training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: { totals: { employeeCount: 0 } } } })
    await renderAdmin()
    expect(screen.getByRole('button', { name: /Xuất danh sách/ })).toBeDisabled()
  })

  it('gửi kèm từ khoá tìm kiếm khi xuất báo cáo', async () => {
    await renderAdmin()
    fireEvent.change(screen.getByLabelText('Tìm nhân sự'), { target: { value: 'NV001' } })
    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Xuất danh sách/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Xuất danh sách/ }))

    await waitFor(() => expect(training.getEmployeeTrainingStatuses)
      .toHaveBeenCalledWith(expect.objectContaining({ keyword: 'NV001' })))
  })
})
