import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComplianceEmployeeTechniqueDetailPage from './ComplianceEmployeeTechniqueDetailPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const search = { current: new URLSearchParams() }
const shell = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ getEmployeeByTechnique: vi.fn() }))
const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(), getRolesFromAccessToken: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ employeeId: '501' }),
  useSearchParams: () => [search.current],
}))
vi.mock('../api/examAssignmentApi.js', () => ({ competencyApi: api }))
vi.mock('../../../shared/auth/tokenStorage.js', () => ({ tokenStorage: { getAccessToken: auth.getAccessToken } }))
vi.mock('../../../shared/auth/jwt.js', () => ({ getRolesFromAccessToken: auth.getRolesFromAccessToken }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/PassFailBadge.jsx', () => ({
  default: ({ passed }) => <span>{passed ? 'Đạt chuẩn' : 'Chưa đạt chuẩn'}</span>,
}))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, back, breadcrumbs, title }) => {
    shell.current = { back, breadcrumbs, title }
    return (
      <main>
        <button onClick={back.onClick}>{back.label}</button>
        <span data-testid="title">{title || ''}</span>
        <nav data-testid="breadcrumbs">{(breadcrumbs || []).map((crumb) => crumb.label).join(' / ')}</nav>
        {children}
      </main>
    )
  },
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`
const TODAY = new Date().toISOString().slice(0, 10)

const detail = (overrides = {}) => ({
  employeeName: 'Nguyễn Văn An', employeeCode: 'NV001', departmentName: 'Khoa Ngoại',
  overallAverageScore: 8.25,
  items: [
    {
      formId: 1, formName: 'Rửa tay ngoại khoa', evaluationCount: 4, averageScore: 8.5,
      passCount: 3, passRate: 75, isPassed: true, belowTarget: false,
      attempts: [
        { evaluatedAt: '2026-08-01T03:00:00Z', evaluatedBy: 'Quản lý A', formName: 'Rửa tay ngoại khoa', score: 9, passed: true },
        { evaluatedAt: null, evaluatedBy: null, formName: null, score: null, passed: false },
      ],
    },
    {
      formId: 2, formName: null, evaluationCount: 2, averageScore: 4,
      passCount: null, passRate: null, isPassed: false, belowTarget: true, attempts: [],
    },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  search.current = new URLSearchParams()
  shell.current = null
  auth.getAccessToken.mockReturnValue('token')
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_ADMIN'])
  api.getEmployeeByTechnique.mockResolvedValue({ data: { data: detail() } })
})

const renderAdmin = async (query = '') => {
  search.current = new URLSearchParams(query)
  render(<ComplianceEmployeeTechniqueDetailPage />)
  await screen.findByText('Rửa tay ngoại khoa')
}
const renderManager = async () => {
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
  render(<ComplianceEmployeeTechniqueDetailPage />)
  await screen.findByText('Rửa tay ngoại khoa')
}

describe('ComplianceEmployeeTechniqueDetailPage - tải chi tiết', () => {
  it('tải dữ liệu với khoảng ngày mặc định và hiển thị hồ sơ nhân viên', async () => {
    render(<ComplianceEmployeeTechniqueDetailPage />)
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()

    await screen.findByText('Rửa tay ngoại khoa')
    expect(api.getEmployeeByTechnique).toHaveBeenCalledWith('501', { fromDate: FROM, toDate: TODAY })
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Mã NV: NV001 · Khoa Ngoại')).toBeInTheDocument()
    expect(screen.getByText('8,25')).toBeInTheDocument()
    // chữ cái đầu của tên gọi
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('dùng khoảng ngày từ query string', async () => {
    await renderAdmin('from=2026-02-01&to=2026-03-01')
    expect(api.getEmployeeByTechnique).toHaveBeenCalledWith('501', { fromDate: '2026-02-01', toDate: '2026-03-01' })
  })

  it('điền dấu hỏi và gạch ngang khi thiếu thông tin nhân viên', async () => {
    api.getEmployeeByTechnique.mockResolvedValue({
      data: { data: detail({ employeeName: null, employeeCode: null, departmentName: null, overallAverageScore: null }) },
    })
    await renderAdmin()

    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getByText('Mã NV: —')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('hiện thông báo rỗng khi chưa có dữ liệu giám sát', async () => {
    api.getEmployeeByTechnique.mockResolvedValue({ data: { data: detail({ items: [] }) } })
    render(<ComplianceEmployeeTechniqueDetailPage />)

    expect(await screen.findByText('Chưa có dữ liệu giám sát kỹ năng thực hành')).toBeInTheDocument()
  })

  it('chịu được phản hồi rỗng', async () => {
    api.getEmployeeByTechnique.mockResolvedValue({ data: { data: null } })
    render(<ComplianceEmployeeTechniqueDetailPage />)

    expect(await screen.findByText('Chưa có dữ liệu giám sát kỹ năng thực hành')).toBeInTheDocument()
    expect(screen.queryByText('Tải lại')).not.toBeInTheDocument()
  })

  it('báo lỗi khi tải dữ liệu thất bại', async () => {
    api.getEmployeeByTechnique.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<ComplianceEmployeeTechniqueDetailPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('tải lại dữ liệu bằng nút Tải lại', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Tải lại/ }))
    await waitFor(() => expect(api.getEmployeeByTechnique).toHaveBeenCalledTimes(2))
  })
})

describe('ComplianceEmployeeTechniqueDetailPage - bảng kỹ thuật', () => {
  it('hiển thị đầy đủ các cột của từng kỹ thuật', async () => {
    await renderAdmin()
    const row = screen.getByText('Rửa tay ngoại khoa').closest('tr')

    expect(within(row).getByText('4')).toBeInTheDocument()
    expect(within(row).getByText('8,5')).toBeInTheDocument()
    expect(within(row).getByText('3/4')).toBeInTheDocument()
    expect(within(row).getByText('75%')).toBeInTheDocument()
    expect(within(row).getByText('Đạt chuẩn')).toBeInTheDocument()
  })

  it('điền 0 và gạch ngang cho kỹ thuật thiếu dữ liệu', async () => {
    await renderAdmin()
    const rows = screen.getAllByRole('row')
    const emptyRow = rows.find((row) => within(row).queryByText('0/2'))

    expect(emptyRow).toBeTruthy()
    expect(within(emptyRow).getAllByText('—').length).toBeGreaterThan(0)
    expect(within(emptyRow).getByText('Chưa đạt chuẩn')).toBeInTheDocument()
  })

  it('tô đỏ dòng dưới ngưỡng và tô vàng dòng chưa đạt', async () => {
    api.getEmployeeByTechnique.mockResolvedValue({
      data: { data: detail({ items: [
        { formId: 1, formName: 'Dưới ngưỡng', evaluationCount: 1, averageScore: 3, passCount: 0, passRate: 0, isPassed: false, belowTarget: true, attempts: [] },
        { formId: 2, formName: 'Chưa đạt', evaluationCount: 1, averageScore: 5, passCount: 0, passRate: 0, isPassed: false, belowTarget: false, attempts: [] },
        { formId: 3, formName: 'Đạt', evaluationCount: 1, averageScore: 9, passCount: 1, passRate: 100, isPassed: true, belowTarget: false, attempts: [] },
      ] }) },
    })
    render(<ComplianceEmployeeTechniqueDetailPage />)
    await screen.findByText('Dưới ngưỡng')

    expect(screen.getByText('Dưới ngưỡng').closest('tr').className).toContain('evd-row--danger')
    expect(screen.getByText('Chưa đạt').closest('tr').className).toContain('evd-row--warning')
    expect(screen.getByText('Đạt').closest('tr').className).toBe('')
  })
})

describe('ComplianceEmployeeTechniqueDetailPage - mở rộng lịch sử giám sát', () => {
  it('mở và đóng lịch sử của một kỹ thuật', async () => {
    await renderAdmin()
    const techniqueRow = () => screen.getAllByText('Rửa tay ngoại khoa')[0].closest('tr')
    fireEvent.click(techniqueRow())

    const history = within(document.querySelector('.evd-detail-table'))
    expect(screen.getByText('Lịch sử giám sát — Rửa tay ngoại khoa')).toBeInTheDocument()
    expect(history.getByText('Quản lý A')).toBeInTheDocument()
    expect(history.getByText('9')).toBeInTheDocument()
    expect(history.getByText('Đạt')).toBeInTheDocument()
    expect(history.getByText('Không đạt')).toBeInTheDocument()

    fireEvent.click(techniqueRow())
    expect(screen.queryByText('Lịch sử giám sát — Rửa tay ngoại khoa')).not.toBeInTheDocument()
  })

  it('điền gạch ngang cho lượt giám sát thiếu dữ liệu', async () => {
    await renderAdmin()
    fireEvent.click(screen.getAllByText('Rửa tay ngoại khoa')[0].closest('tr'))

    const historyRows = within(document.querySelector('.evd-detail-table')).getAllByRole('row')
    expect(within(historyRows[2]).getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })

  it('không mở rộng kỹ thuật chưa có lượt giám sát nào', async () => {
    await renderAdmin()
    const rows = screen.getAllByRole('row')
    const emptyRow = rows.find((row) => within(row).queryByText('0/2'))

    fireEvent.click(emptyRow)
    expect(screen.queryByText(/Lịch sử giám sát/)).not.toBeInTheDocument()
  })

  it('chỉ mở một kỹ thuật tại một thời điểm', async () => {
    api.getEmployeeByTechnique.mockResolvedValue({
      data: { data: detail({ items: [
        { formId: 1, formName: 'Kỹ thuật A', evaluationCount: 1, averageScore: 9, passCount: 1, passRate: 100, isPassed: true, belowTarget: false, attempts: [{ evaluatedAt: '2026-08-01', evaluatedBy: 'X', formName: 'A', score: 9, passed: true }] },
        { formId: 2, formName: 'Kỹ thuật B', evaluationCount: 1, averageScore: 8, passCount: 1, passRate: 100, isPassed: true, belowTarget: false, attempts: [{ evaluatedAt: '2026-08-02', evaluatedBy: 'Y', formName: 'B', score: 8, passed: true }] },
      ] }) },
    })
    render(<ComplianceEmployeeTechniqueDetailPage />)
    await screen.findByText('Kỹ thuật A')

    fireEvent.click(screen.getByText('Kỹ thuật A').closest('tr'))
    expect(screen.getByText('Lịch sử giám sát — Kỹ thuật A')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Kỹ thuật B').closest('tr'))
    expect(screen.queryByText('Lịch sử giám sát — Kỹ thuật A')).not.toBeInTheDocument()
    expect(screen.getByText('Lịch sử giám sát — Kỹ thuật B')).toBeInTheDocument()
  })
})

describe('ComplianceEmployeeTechniqueDetailPage - điều hướng theo vai trò', () => {
  it('quay lại danh sách của quản trị viên kèm khoảng ngày', async () => {
    await renderAdmin('from=2026-02-01&to=2026-03-01')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/compliance-by-technique?from=2026-02-01&to=2026-03-01')
  })

  it('hiện breadcrumb cho quản trị viên', async () => {
    await renderAdmin()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Nguyễn Văn An')
    expect(screen.getByTestId('title')).toHaveTextContent('')
  })

  it('quay lại danh sách của quản lý khoa và hiện tiêu đề riêng', async () => {
    await renderManager()

    expect(screen.getByTestId('title')).toHaveTextContent('Tuân thủ chung: Nguyễn Văn An')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/manager/compliance-by-technique?from='))
  })

  it('hiện dấu ba chấm trên tiêu đề khi chưa tải xong', () => {
    auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
    api.getEmployeeByTechnique.mockReturnValue(new Promise(() => {}))
    render(<ComplianceEmployeeTechniqueDetailPage />)

    expect(screen.getByTestId('title')).toHaveTextContent('Tuân thủ chung: ...')
  })
})
