import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompetencySummaryPage from './CompetencySummaryPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const authState = vi.hoisted(() => ({ roles: ['ADMIN'] }))
const validateDateRange = vi.hoisted(() => vi.fn(() => ''))
const apis = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getByField: vi.fn(),
  getByTechnique: vi.fn(),
  listCategories: vi.fn(),
  getDepartments: vi.fn(),
  getProfile: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/auth/tokenStorage.js', () => ({ tokenStorage: { getAccessToken: () => 'token' } }))
vi.mock('../../../shared/auth/jwt.js', () => ({ getRolesFromAccessToken: () => authState.roles }))
vi.mock('../api/examAssignmentApi.js', () => ({ competencyApi: {
  getSummary: apis.getSummary,
  getByField: apis.getByField,
  getByTechnique: apis.getByTechnique,
} }))
vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: { listCategories: apis.listCategories } }))
vi.mock('../../admin/api/adminApi.js', () => ({ adminApi: { getDepartments: apis.getDepartments } }))
vi.mock('../../staff/api/staffApi.js', () => ({ staffApi: { getProfile: apis.getProfile } }))
vi.mock('../../../shared/utils/dateRange.js', () => ({
  currentYearDateRange: () => ({ fromDate: '2026-01-01', toDate: '2026-08-25' }),
  validateHistoricalDateRange: validateDateRange,
}))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, breadcrumbs, title }) => (
    <main>
      <div data-testid="shell-title">{title}</div>
      <div data-testid="breadcrumbs">{breadcrumbs?.map((item) => item.label).join(' / ')}</div>
      {children}
    </main>
  ),
}))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({
    activeCount, actions, ariaLabel, children, errorMessage, header, isOpen,
    onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue,
  }) => (
    <section aria-label={ariaLabel}>
      {header}
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button type="button" onClick={onToggle}>Bộ lọc ({activeCount})</button>
      {isOpen && <div data-testid="filter-panel">{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
      {errorMessage && <div role="alert">{errorMessage}</div>}
      {actions}
    </section>
  ),
}))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange, min, max }) => (
    <input data-min={min} data-max={max} aria-label={`Ngày ${value}`} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options, disabled }) => (
    <label>{label}<select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
  ),
}))
vi.mock('../../../shared/components/PassFailBadge.jsx', () => ({
  default: ({ passed }) => <span>{passed == null ? 'Chưa có dữ liệu' : passed ? 'Đạt' : 'Chưa đạt'}</span>,
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="chart">{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: ({ children }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Cell: ({ fill }) => <i data-fill={fill} />,
  Tooltip: ({ labelFormatter, formatter }) => {
    labelFormatter?.('Đạt')
    labelFormatter?.('Không xác định')
    formatter?.(2)
    return null
  },
}))

const response = (data) => ({ data: { data } })
const summaryData = (overrides = {}) => ({
  departmentName: 'Toàn viện',
  targetScore: 6,
  knowledgeWeight: 0.4,
  skillWeight: 0.6,
  totalElements: 23,
  totalPages: 9,
  items: [
    { employeeId: 1, employeeCode: 'NV01', employeeName: 'An', departmentName: 'Khoa A', examScore: 8, skillAverage: 7, overallScore: 7.4, isPassed: true },
    { employeeId: 2, employeeCode: 'NV02', employeeName: 'Bình', departmentName: 'Khoa B', knowledgeAverage: 4, skillAverage: 5, overallScore: 4.6, isPassed: false },
    { employeeId: 3, employeeCode: 'NV03', employeeName: 'Chi', departmentName: null, examScore: null, skillAverage: null, overallScore: null, isPassed: false },
  ],
  ...overrides,
})
const fieldData = (overrides = {}) => ({
  departmentName: 'Khoa A', categoryName: 'Hồi sức', totalElements: 1, totalPages: 1,
  items: [{ employeeId: 11, employeeCode: 'NV11', employeeName: 'Dũng', departmentName: 'Khoa A', attemptCount: 3, averageScore: 8.2, passRate: 75, isPassed: true }],
  ...overrides,
})
const techniqueData = (overrides = {}) => ({
  departmentName: 'Khoa A', complianceTarget: 80, totalElements: 2, totalPages: 1,
  forms: [{ id: 51, title: 'Thay băng vết thương' }],
  items: [
    { employeeId: 21, employeeCode: 'NV21', employeeName: 'Hà', departmentName: 'Khoa A', evaluationCount: 4, averageScore: 7.5, passRate: 50, belowTarget: true, isPassed: false },
    { employeeId: 22, employeeCode: 'NV22', employeeName: 'Lan', departmentName: 'Khoa A', evaluationCount: 5, averageScore: 9, passRate: 90, belowTarget: false, isPassed: true },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  authState.roles = ['ADMIN']
  validateDateRange.mockReturnValue('')
  apis.getDepartments.mockResolvedValue(response([{ id: 4, name: 'Khoa A' }, { id: 5, name: 'Khoa B' }]))
  apis.listCategories.mockResolvedValue(response([{ id: 9, name: 'Hồi sức' }]))
  apis.getProfile.mockResolvedValue(response({ departmentId: 4, departmentName: 'Khoa A' }))
  apis.getSummary.mockResolvedValue(response(summaryData()))
  apis.getByField.mockResolvedValue(response(fieldData()))
  apis.getByTechnique.mockResolvedValue(response(techniqueData()))
})

const renderPage = async () => {
  render(<CompetencySummaryPage />)
  await screen.findByText('NV01')
}

describe('CompetencySummaryPage', () => {
  it('loads the admin summary, renders distribution, sorts, paginates, searches and reloads', async () => {
    await renderPage()
    expect(apis.getDepartments).toHaveBeenCalled()
    expect(apis.listCategories).toHaveBeenCalled()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Dashboard / Đánh giá / Năng lực chuyên môn')
    expect(screen.getByText('≥ 6,0/10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    expect(screen.getByText('Lý thuyết 40% · Thực hành 60%')).toBeInTheDocument()
    expect(screen.getByTestId('chart')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa đạt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chưa có dữ liệu').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText(/Điểm kiểm tra/))
    fireEvent.click(screen.getByText(/Điểm kiểm tra/))
    fireEvent.click(screen.getByText(/Điểm thực hành/))
    fireEvent.click(screen.getByText(/Tổng điểm/))
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(apis.getSummary).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })))
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))

    fireEvent.change(screen.getByLabelText('Tìm theo tên hoặc mã nhân viên'), { target: { value: '  Nam  ' } })
    await waitFor(() => expect(apis.getSummary).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'Nam' })), { timeout: 1500 })
  })

  it('validates, applies and resets the common filter fields', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    const panel = screen.getByTestId('filter-panel')
    await waitFor(() => expect(within(panel).getByLabelText('Khoa/phòng').querySelector('option[value="4"]')).not.toBeNull())
    fireEvent.change(within(panel).getByLabelText('Khoa/phòng'), { target: { value: '4' } })
    const dates = within(panel).getAllByRole('textbox')
    fireEvent.change(dates[0], { target: { value: '2026-02-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-07-31' } })
    validateDateRange.mockReturnValueOnce('Khoảng ngày không hợp lệ')
    fireEvent.click(within(panel).getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Khoảng ngày không hợp lệ')

    validateDateRange.mockReturnValueOnce('')
    fireEvent.click(within(panel).getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(apis.getSummary).toHaveBeenCalledWith(expect.objectContaining({
      departmentId: '4', fromDate: '2026-02-01', toDate: '2026-07-31',
    })))
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(apis.getSummary).toHaveBeenCalledWith(expect.objectContaining({ departmentId: undefined, fromDate: '2026-01-01' })))
  })

  it('switches to field report, filters category and opens an employee detail', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Năng lực theo lĩnh vực' }))
    expect(await screen.findByText('NV11')).toBeInTheDocument()
    expect(apis.getByField).toHaveBeenCalledWith(expect.objectContaining({ size: 10 }))
    expect(screen.getAllByText(/Khoa A/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    await waitFor(() => expect(screen.getByLabelText('Lĩnh vực').querySelector('option[value="9"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lĩnh vực'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(apis.getByField).toHaveBeenCalledWith(expect.objectContaining({ categoryId: '9' })))
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết năng lực của Dũng/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/competency-by-field/11')
  })

  it('switches to technique report, filters a form and opens admin technique detail', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Kỹ năng chuyên môn' }))
    expect(await screen.findByText('NV21')).toBeInTheDocument()
    expect(screen.getByText(/2 điều dưỡng trên trang hiện tại/)).toBeInTheDocument()
    expect(screen.getByText(/2 dưới mục tiêu|1 dưới mục tiêu/)).toBeInTheDocument()
    expect(screen.getByText('< 80%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    fireEvent.change(screen.getByLabelText('Kỹ thuật'), { target: { value: '51' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(apis.getByTechnique).toHaveBeenCalledWith(expect.objectContaining({ formId: '51' })))
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết kỹ năng chuyên môn của Hà/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/compliance-by-technique/21?from=2026-01-01&to=2026-08-25')
  })

  it('reports API failures and renders empty states', async () => {
    apis.getDepartments.mockRejectedValueOnce(new Error('departments'))
    apis.listCategories.mockRejectedValueOnce(new Error('categories'))
    apis.getSummary.mockRejectedValueOnce({ response: { data: { message: 'Không tải được báo cáo' } } })
    render(<CompetencySummaryPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tải được báo cáo', 'error'))
    expect(screen.getByText('Chưa có dữ liệu năng lực trong phạm vi đã chọn.')).toBeInTheDocument()
  })

  it('uses the manager department, paths and manager-only columns', async () => {
    authState.roles = ['MANAGER']
    render(<CompetencySummaryPage />)
    expect(await screen.findByText('NV01')).toBeInTheDocument()
    expect(apis.getProfile).toHaveBeenCalled()
    expect(apis.getSummary).toHaveBeenCalledWith(expect.objectContaining({ departmentId: '4' }))
    expect(screen.getByTestId('shell-title')).toHaveTextContent('Năng lực chuyên môn')
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    expect(screen.getByLabelText('Khoa/phòng')).toBeDisabled()

    fireEvent.click(screen.getByRole('tab', { name: 'Năng lực theo lĩnh vực' }))
    await screen.findByText('NV11')
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết năng lực của Dũng/ }))
    expect(navigate).toHaveBeenCalledWith('/manager/competency-by-field/11')

    fireEvent.click(screen.getByRole('tab', { name: 'Kỹ năng chuyên môn' }))
    await screen.findByText('NV21')
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết kỹ năng chuyên môn của Hà/ }))
    expect(navigate).toHaveBeenCalledWith('/manager/compliance-by-technique/21?from=2026-01-01&to=2026-08-25')
  })

  it('stops manager loading and warns when profile has no department', async () => {
    authState.roles = ['MANAGER']
    apis.getProfile.mockRejectedValueOnce(new Error('profile'))
    render(<CompetencySummaryPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy khoa/phòng của bạn', 'error'))
    expect(apis.getSummary).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: 'Kỹ năng chuyên môn' }))
    expect(screen.getByText('Vui lòng chọn khoa/phòng.')).toBeInTheDocument()
  })

  it('renders technique and field empty data branches', async () => {
    apis.getByTechnique.mockResolvedValueOnce(response(techniqueData({ items: [], totalElements: 0, totalPages: 0 })))
    apis.getByField.mockResolvedValueOnce(response(fieldData({ items: [], totalElements: 0, totalPages: 0 })))
    await renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Kỹ năng chuyên môn' }))
    expect(await screen.findByText('Chưa có dữ liệu kỹ năng chuyên môn.')).toBeInTheDocument()
    expect(screen.getByText(/Chưa có dữ liệu kỹ năng chuyên môn trong khoảng/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Năng lực theo lĩnh vực' }))
    expect(await screen.findByText('Chưa có dữ liệu đánh giá cho lĩnh vực này.')).toBeInTheDocument()
  })
})
