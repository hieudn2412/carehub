import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboard from './AdminDashboard.jsx'

const navigate = vi.fn()
const overviewProps = vi.hoisted(() => ({ current: null }))
const admin = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  getUsers: vi.fn(),
  getDashboardFormPerformance: vi.fn(),
  getDashboardFormTrend: vi.fn(),
}))
const training = vi.hoisted(() => ({ getTrainingDashboardSummary: vi.fn() }))
const competency = vi.hoisted(() => ({ getSummary: vi.fn() }))
const helpers = vi.hoisted(() => ({
  loadCompetencyOverview: vi.fn(),
  loadAllDashboardItems: vi.fn(),
  findExactEmployee: vi.fn(),
  mapChecklistPerformance: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/adminApi.js', () => ({ adminApi: admin }))
vi.mock('../../training/api/trainingApi.js', () => ({ trainingApi: training }))
vi.mock('../../evaluation/api/examAssignmentApi.js', () => ({ competencyApi: competency }))
vi.mock('../../dashboard/utils/competencyOverview.js', () => ({
  loadCompetencyOverview: (...args) => helpers.loadCompetencyOverview(...args),
}))
vi.mock('../../dashboard/utils/paginatedDashboard.js', () => ({
  loadAllDashboardItems: (...args) => helpers.loadAllDashboardItems(...args),
}))
vi.mock('../../dashboard/utils/dashboardChecklistPerformance.js', () => ({
  findExactEmployee: (...args) => helpers.findExactEmployee(...args),
  mapChecklistPerformance: (...args) => helpers.mapChecklistPerformance(...args),
}))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../dashboard/components/OverviewDashboard.jsx', () => ({
  default: (props) => {
    overviewProps.current = props
    return (
      <section data-testid="overview">
        <span data-testid="loading">{String(props.loading)}</span>
        <span data-testid="error">{props.error}</span>
        <span data-testid="departments">{props.departments.length}</span>
        <span data-testid="compliance-only">{String(props.complianceOnly)}</span>
        <span data-testid="training">{JSON.stringify(props.domains.training)}</span>
        <span data-testid="exams">{JSON.stringify(props.domains.exams)}</span>
        <span data-testid="quality">{JSON.stringify(props.domains.quality)}</span>
        <span data-testid="chart">{JSON.stringify(props.complianceChart)}</span>
        <button onClick={() => props.onFilterChange('employeeCode', 'NV001')}>Lọc nhân viên</button>
        <button onClick={() => props.onFilterChange('departmentId', '3')}>Lọc khoa</button>
        <button onClick={() => props.onFilterChange('toDate', '2000-01-01')}>Đặt ngày sai</button>
        <button onClick={() => props.onNavigate('/admin/reports/training-dashboard')}>Điều hướng</button>
        <button onClick={() => props.onLoadComplianceTrend(7)}>Tải xu hướng</button>
      </section>
    )
  },
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`

const trainingTotals = {
  employeeCount: 100, compliantCount: 70, nonCompliantCount: 20, atRiskCount: 5, notConfiguredCount: 5,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  overviewProps.current = null
  admin.getDepartments.mockResolvedValue({ data: { data: [{ id: 3, name: 'Khoa Ngoại' }] } })
  admin.getDashboardFormTrend.mockResolvedValue({ data: { data: { items: [{ date: '2026-08-01', rate: 80 }] } } })
  training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: { totals: trainingTotals } } })
  helpers.loadCompetencyOverview.mockResolvedValue({ total: 50, passed: 40, failed: 10, rate: 80 })
  helpers.loadAllDashboardItems.mockResolvedValue([{ formId: 1 }])
  helpers.findExactEmployee.mockReturnValue({ id: 501 })
  helpers.mapChecklistPerformance.mockReturnValue({
    totals: { total: 20, passed: 16, failed: 4, convertedScoreSum: 150 },
    chart: [{ formId: 1, rate: 80 }],
  })
})

afterEach(() => vi.useRealTimers())

const renderDashboard = async (props = {}) => {
  render(<AdminDashboard {...props} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(400) })
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
}
const domainOf = (name) => JSON.parse(screen.getByTestId(name).textContent)

describe('AdminDashboard - tải tổng quan', () => {
  it('nạp khoa và tổng hợp ba nhóm chỉ số', async () => {
    await renderDashboard()

    expect(admin.getDepartments).toHaveBeenCalled()
    expect(screen.getByTestId('departments')).toHaveTextContent('1')
    expect(training.getTrainingDashboardSummary).toHaveBeenCalledWith({
      departmentId: undefined, employeeId: undefined, asOf: expect.any(String),
    })

    expect(domainOf('training')).toMatchObject({ total: 100, passed: 70, failed: 30, rate: 70, available: true })
    expect(domainOf('exams')).toMatchObject({ total: 50, passed: 40, rate: 80, available: true })
    expect(domainOf('quality')).toMatchObject({ total: 20, passed: 16, failed: 4, rate: 80, available: true })
    expect(domainOf('quality').note).toContain('7,50/10')
    expect(screen.getByTestId('chart')).toHaveTextContent('"rate":80')
  })

  it('chịu được danh sách khoa dạng phân trang', async () => {
    admin.getDepartments.mockResolvedValue({ data: { data: { content: [{ id: 4 }, { id: 5 }] } } })
    await renderDashboard()
    expect(screen.getByTestId('departments')).toHaveTextContent('2')
  })

  it('hiện lỗi khi không tải được danh sách khoa', async () => {
    admin.getDepartments.mockRejectedValue(new Error('down'))
    await renderDashboard()
    expect(screen.getByTestId('error')).toHaveTextContent('Không thể tải danh sách khoa/phòng.')
  })

  it('coi mọi số liệu đào tạo thiếu là 0', async () => {
    training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: {} } })
    await renderDashboard()
    expect(domainOf('training')).toMatchObject({ total: 0, passed: 0, failed: 0, rate: 0 })
  })

  it('trả tỷ lệ 0 khi chưa có lượt bảng kiểm nào', async () => {
    helpers.mapChecklistPerformance.mockReturnValue({
      totals: { total: 0, passed: 0, failed: 0, convertedScoreSum: 0 }, chart: [],
    })
    await renderDashboard()
    expect(domainOf('quality')).toMatchObject({ rate: 0 })
    expect(domainOf('quality').note).toContain('0,00/10')
  })
})

describe('AdminDashboard - chế độ chất lượng chăm sóc', () => {
  it('bỏ qua giờ đào tạo và năng lực', async () => {
    await renderDashboard({ variant: 'care-quality' })

    expect(screen.getByTestId('compliance-only')).toHaveTextContent('true')
    expect(training.getTrainingDashboardSummary).not.toHaveBeenCalled()
    expect(helpers.loadCompetencyOverview).not.toHaveBeenCalled()
    expect(domainOf('training')).toMatchObject({ available: true })
    expect(domainOf('exams')).toMatchObject({
      available: false, emptyMessage: 'Không thể tải dữ liệu năng lực chuyên môn từ máy chủ.',
    })
  })
})

describe('AdminDashboard - bộ lọc', () => {
  it('chặn khoảng ngày ngược', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt ngày sai' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    expect(screen.getByTestId('error')).toHaveTextContent('Từ ngày không được lớn hơn Đến ngày.')
  })

  it('truyền khoa đang lọc xuống mọi lời gọi', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc khoa' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(training.getTrainingDashboardSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: '3' }),
    ))
  })

  it('tra mã nhân viên rồi lọc theo id tìm được', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(helpers.loadAllDashboardItems).toHaveBeenCalledWith(
      admin.getUsers, expect.objectContaining({ keyword: 'NV001' }),
    ))
    await waitFor(() => expect(training.getTrainingDashboardSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeId: 501 }),
    ))
  })

  it('báo không tìm thấy khi mã nhân viên không khớp', async () => {
    helpers.findExactEmployee.mockReturnValue(null)
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(screen.getByTestId('error'))
      .toHaveTextContent('Không tìm thấy nhân viên có mã "NV001" trong phạm vi đang chọn.'))
  })

  it('báo lỗi khi không xác minh được mã nhân viên', async () => {
    helpers.loadAllDashboardItems.mockImplementation((fetcher) => (
      fetcher === admin.getUsers ? Promise.reject(new Error('down')) : Promise.resolve([{ formId: 1 }])
    ))
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(screen.getByTestId('error'))
      .toHaveTextContent('Không thể xác minh mã nhân viên. Vui lòng thử lại.'))
  })
})

describe('AdminDashboard - xử lý lỗi từng nhóm', () => {
  it('nêu tên nhóm bị lỗi mà vẫn hiển thị phần còn lại', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('Không thể tải dữ liệu giờ đào tạo')
    expect(domainOf('training')).toMatchObject({
      available: false, emptyMessage: 'Không thể tải dữ liệu giờ đào tạo từ máy chủ.',
    })
    expect(domainOf('quality')).toMatchObject({ available: true })
  })

  it('gộp nhiều nhóm lỗi vào một thông báo', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    helpers.loadCompetencyOverview.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('giờ đào tạo, năng lực chuyên môn')
  })

  it('báo lỗi toàn cục khi cả ba nhóm đều thất bại', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    helpers.loadCompetencyOverview.mockRejectedValue(new Error('down'))
    helpers.loadAllDashboardItems.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('Không thể tải dashboard.')
  })

  it('hiện thông báo riêng khi chỉ lịch sử bảng kiểm lỗi', async () => {
    helpers.loadAllDashboardItems.mockImplementation((fetcher) => (
      fetcher === admin.getDashboardFormPerformance ? Promise.reject(new Error('down')) : Promise.resolve([])
    ))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('lịch sử bảng kiểm')
    expect(domainOf('quality')).toMatchObject({
      available: false, emptyMessage: 'Không thể tải dữ liệu tuân thủ quy trình.',
    })
  })
})

describe('AdminDashboard - điều hướng và xu hướng', () => {
  it('gắn đường dẫn báo cáo cho từng nhóm', async () => {
    await renderDashboard()
    expect(domainOf('training').path).toBe('/admin/reports/training-dashboard')
    expect(domainOf('exams').path).toBe('/admin/reports/quality-dashboard')
    expect(domainOf('quality').path).toBe('/admin/reports/checklist-dashboard')
  })

  it('chuyển trang qua callback điều hướng', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Điều hướng' }))
    expect(navigate).toHaveBeenCalledWith('/admin/reports/training-dashboard')
  })

  it('tải xu hướng theo bảng kiểm với phạm vi đang lọc', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Tải xu hướng' }))

    await waitFor(() => expect(admin.getDashboardFormTrend).toHaveBeenCalledWith({
      fromDate: FROM, toDate: expect.any(String),
      departmentId: undefined, subjectUserId: undefined, formId: 7, bucket: 'DAY',
    }))
    await expect(overviewProps.current.onLoadComplianceTrend(7)).resolves.toEqual([{ date: '2026-08-01', rate: 80 }])
  })

  it('trả về mảng rỗng khi phản hồi xu hướng thiếu items', async () => {
    admin.getDashboardFormTrend.mockResolvedValue({ data: { data: {} } })
    await renderDashboard()
    await expect(overviewProps.current.onLoadComplianceTrend(7)).resolves.toEqual([])
  })
})
