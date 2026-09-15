import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerDashboard from './ManagerDashboard.jsx'

const navigate = vi.fn()
const overviewProps = vi.hoisted(() => ({ current: null }))
const staff = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getManagerDashboardEmployee: vi.fn(),
  getQualityChecklistDashboard: vi.fn(),
  getDashboardFormTrend: vi.fn(),
}))
const training = vi.hoisted(() => ({ getTrainingDashboardSummary: vi.fn() }))
const competency = vi.hoisted(() => ({ getSummary: vi.fn() }))
const helpers = vi.hoisted(() => ({
  loadCompetencyOverview: vi.fn(),
  loadAllDashboardItems: vi.fn(),
  mapChecklistPerformance: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../../api/staffApi.js', () => ({ staffApi: staff }))
vi.mock('../../../training/api/trainingApi.js', () => ({ trainingApi: training }))
vi.mock('../../../evaluation/api/examAssignmentApi.js', () => ({ competencyApi: competency }))
vi.mock('../../../dashboard/utils/competencyOverview.js', () => ({
  loadCompetencyOverview: (...args) => helpers.loadCompetencyOverview(...args),
}))
vi.mock('../../../dashboard/utils/paginatedDashboard.js', () => ({
  loadAllDashboardItems: (...args) => helpers.loadAllDashboardItems(...args),
}))
vi.mock('../../../dashboard/utils/dashboardChecklistPerformance.js', () => ({
  mapChecklistPerformance: (...args) => helpers.mapChecklistPerformance(...args),
}))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../dashboard/components/OverviewDashboard.jsx', () => ({
  default: (props) => {
    overviewProps.current = props
    return (
      <section data-testid="overview">
        <span data-testid="loading">{String(props.loading)}</span>
        <span data-testid="error">{props.error}</span>
        <span data-testid="profile">{props.profile?.departmentName || ''}</span>
        <span data-testid="training">{JSON.stringify(props.domains.training)}</span>
        <span data-testid="exams">{JSON.stringify(props.domains.exams)}</span>
        <span data-testid="quality">{JSON.stringify(props.domains.quality)}</span>
        <span data-testid="chart">{JSON.stringify(props.complianceChart)}</span>
        <span data-testid="visible">{props.visibleDomains.join(',')}</span>
        <button onClick={() => props.onFilterChange('employeeCode', 'NV001')}>Lọc nhân viên</button>
        <button onClick={() => props.onFilterChange('toDate', '2000-01-01')}>Đặt ngày sai</button>
        <button onClick={() => props.onNavigate('/manager/reports/training-dashboard')}>Điều hướng</button>
      </section>
    )
  },
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`

const trainingTotals = {
  employeeCount: 40, compliantCount: 30, nonCompliantCount: 5, atRiskCount: 3, notConfiguredCount: 2, complianceRate: 75,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  overviewProps.current = null
  staff.getProfile.mockResolvedValue({ data: { data: { departmentId: 3, departmentName: 'Khoa Hồi sức' } } })
  staff.getManagerDashboardEmployee.mockResolvedValue({ data: { data: { found: true, employeeId: 501 } } })
  staff.getDashboardFormTrend.mockResolvedValue({ data: { data: { items: [{ date: '2026-08-01', rate: 80 }] } } })
  training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: { totals: trainingTotals } } })
  helpers.loadCompetencyOverview.mockResolvedValue({ total: 20, passed: 15, failed: 5, rate: 75 })
  helpers.loadAllDashboardItems.mockResolvedValue([{ formId: 1 }])
  helpers.mapChecklistPerformance.mockReturnValue({
    totals: { total: 10, passed: 8, failed: 2, convertedScoreSum: 82 },
    chart: [{ formId: 1, rate: 80 }],
  })
})

afterEach(() => vi.useRealTimers())

const renderDashboard = async () => {
  render(<ManagerDashboard />)
  await act(async () => { await vi.advanceTimersByTimeAsync(400) })
  await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
}
const domainOf = (name) => JSON.parse(screen.getByTestId(name).textContent)

describe('ManagerDashboard - phạm vi khoa', () => {
  it('lấy khoa từ hồ sơ rồi tải ba nhóm chỉ số', async () => {
    await renderDashboard()

    expect(staff.getProfile).toHaveBeenCalled()
    expect(screen.getByTestId('profile')).toHaveTextContent('Khoa Hồi sức')
    expect(training.getTrainingDashboardSummary).toHaveBeenCalledWith({
      departmentId: '3', employeeId: undefined, asOf: expect.any(String),
    })
    expect(domainOf('training')).toMatchObject({ total: 40, passed: 30, failed: 10, rate: 75, available: true })
    expect(domainOf('exams')).toMatchObject({ total: 20, passed: 15, rate: 75, available: true })
    expect(domainOf('quality')).toMatchObject({ total: 10, passed: 8, failed: 2, rate: 80, available: true })
    expect(domainOf('quality').note).toContain('8,20/10')
    expect(screen.getByTestId('visible')).toHaveTextContent('training,exams,quality')
  })

  it('báo lỗi khi tài khoản chưa được gán khoa', async () => {
    staff.getProfile.mockResolvedValue({ data: { data: {} } })
    render(<ManagerDashboard />)
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    expect(screen.getByTestId('error')).toHaveTextContent('chưa được gán khoa/phòng')
    expect(training.getTrainingDashboardSummary).not.toHaveBeenCalled()
  })

  it('báo lỗi khi không lấy được hồ sơ', async () => {
    staff.getProfile.mockRejectedValue(new Error('down'))
    render(<ManagerDashboard />)
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    expect(screen.getByTestId('error')).toHaveTextContent('Không thể xác định khoa/phòng của Quản lý cấp Khoa.')
  })

  it('gắn đường dẫn báo cáo của quản lý cho từng nhóm', async () => {
    await renderDashboard()
    expect(domainOf('training').path).toBe('/manager/reports/training-dashboard')
    expect(domainOf('exams').path).toBe('/manager/reports/quality-dashboard')
    expect(domainOf('quality').path).toBe('/manager/reports/checklist-dashboard')
  })

  it('chuyển trang qua callback điều hướng', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Điều hướng' }))
    expect(navigate).toHaveBeenCalledWith('/manager/reports/training-dashboard')
  })
})

describe('ManagerDashboard - bộ lọc', () => {
  it('chặn khoảng ngày ngược', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt ngày sai' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    expect(screen.getByTestId('error')).toHaveTextContent('Từ ngày không được lớn hơn Đến ngày.')
  })

  it('tra mã nhân viên rồi lọc theo id tìm được', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(staff.getManagerDashboardEmployee).toHaveBeenCalledWith({ employeeCode: 'NV001' }))
    await waitFor(() => expect(training.getTrainingDashboardSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeId: 501 }),
    ))
  })

  it('báo không tìm thấy khi mã nhân viên ngoài khoa', async () => {
    staff.getManagerDashboardEmployee.mockResolvedValue({ data: { data: { found: false } } })
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(screen.getByTestId('error'))
      .toHaveTextContent('Không tìm thấy nhân viên có mã "NV001" trong khoa của bạn.'))
  })

  it('báo lỗi khi không xác minh được mã nhân viên', async () => {
    staff.getManagerDashboardEmployee.mockRejectedValue(new Error('down'))
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })

    await waitFor(() => expect(screen.getByTestId('error'))
      .toHaveTextContent('Không thể xác minh mã nhân viên trong khoa. Vui lòng thử lại.'))
  })
})

describe('ManagerDashboard - xử lý lỗi từng nhóm', () => {
  it('nêu tên nhóm bị lỗi mà vẫn hiển thị phần còn lại', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('Không thể tải dữ liệu giờ đào tạo')
    expect(domainOf('training')).toMatchObject({ available: false, total: 0 })
    expect(domainOf('quality')).toMatchObject({ available: true })
  })

  it('gộp nhiều nhóm lỗi vào một thông báo', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    helpers.loadCompetencyOverview.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('giờ đào tạo, năng lực chuyên môn')
    expect(domainOf('exams')).toMatchObject({
      available: false, emptyMessage: 'Không thể tải dữ liệu năng lực chuyên môn trong khoa.',
    })
  })

  it('báo lỗi toàn cục và dọn biểu đồ khi cả ba nhóm đều thất bại', async () => {
    training.getTrainingDashboardSummary.mockRejectedValue(new Error('down'))
    helpers.loadCompetencyOverview.mockRejectedValue(new Error('down'))
    helpers.loadAllDashboardItems.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('Không thể tải dashboard của khoa.')
    expect(screen.getByTestId('chart')).toHaveTextContent('[]')
    expect(domainOf('quality')).toMatchObject({ available: false })
  })

  it('hiện thông báo riêng khi chỉ dashboard bảng kiểm lỗi', async () => {
    helpers.loadAllDashboardItems.mockRejectedValue(new Error('down'))
    await renderDashboard()

    expect(screen.getByTestId('error')).toHaveTextContent('dashboard bảng kiểm')
    expect(domainOf('quality')).toMatchObject({
      available: false, emptyMessage: 'Không thể tải dữ liệu checklist trong khoa.',
    })
  })

  it('trả tỷ lệ 0 khi chưa có lượt bảng kiểm nào', async () => {
    helpers.mapChecklistPerformance.mockReturnValue({
      totals: { total: 0, passed: 0, failed: 0, convertedScoreSum: 0 }, chart: [],
    })
    await renderDashboard()
    expect(domainOf('quality')).toMatchObject({ rate: 0 })
    expect(domainOf('quality').note).toContain('0,00/10')
  })

  it('coi mọi số liệu đào tạo thiếu là 0', async () => {
    training.getTrainingDashboardSummary.mockResolvedValue({ data: { data: {} } })
    await renderDashboard()
    expect(domainOf('training')).toMatchObject({ total: 0, passed: 0, failed: 0, rate: 0 })
  })
})

describe('ManagerDashboard - xu hướng bảng kiểm', () => {
  it('tải xu hướng với phạm vi khoa đang lọc', async () => {
    await renderDashboard()
    await expect(overviewProps.current.onLoadComplianceTrend(7)).resolves.toEqual([{ date: '2026-08-01', rate: 80 }])

    expect(staff.getDashboardFormTrend).toHaveBeenCalledWith({
      fromDate: FROM, toDate: expect.any(String),
      departmentId: '3', subjectUserId: undefined, formId: 7, bucket: 'DAY',
    })
  })

  it('trả về mảng rỗng khi phản hồi xu hướng thiếu items', async () => {
    staff.getDashboardFormTrend.mockResolvedValue({ data: { data: {} } })
    await renderDashboard()
    await expect(overviewProps.current.onLoadComplianceTrend(7)).resolves.toEqual([])
  })

  it('gửi kèm id nhân viên đang lọc', async () => {
    await renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Lọc nhân viên' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    await waitFor(() => expect(training.getTrainingDashboardSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeId: 501 }),
    ))

    await overviewProps.current.onLoadComplianceTrend(7)
    expect(staff.getDashboardFormTrend).toHaveBeenLastCalledWith(expect.objectContaining({ subjectUserId: 501 }))
  })
})
