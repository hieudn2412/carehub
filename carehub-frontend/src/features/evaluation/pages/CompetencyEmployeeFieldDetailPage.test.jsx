import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CompetencyEmployeeFieldDetailPage from './CompetencyEmployeeFieldDetailPage.jsx'

const showToast = vi.fn()
const shell = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ getEmployeeByField: vi.fn() }))
const auth = vi.hoisted(() => ({ getAccessToken: vi.fn(), getRolesFromAccessToken: vi.fn() }))

vi.mock('react-router-dom', () => ({ useParams: () => ({ employeeId: '501' }) }))
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
        <a href={back.to}>{back.label}</a>
        <span data-testid="title">{title || ''}</span>
        <nav data-testid="breadcrumbs">{(breadcrumbs || []).map((crumb) => `${crumb.label}|${crumb.link || ''}`).join(' / ')}</nav>
        {children}
      </main>
    )
  },
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`
const TODAY = new Date().toISOString().slice(0, 10)

const detail = (overrides = {}) => ({
  employeeName: 'Nguyễn Văn A', employeeCode: 'NV001',
  items: [
    {
      categoryName: 'Kiểm soát nhiễm khuẩn', attemptCount: 3, averageScore: 8, passRate: 80, isPassed: true,
      attempts: [
        { attemptDate: '2026-08-01T03:00:00Z', examPaperTitle: 'Đề số 1', score: 9, correctCount: 18, totalQuestions: 20, passed: true },
        { attemptDate: null, examPaperTitle: null, score: null, correctCount: null, totalQuestions: null, passed: false },
      ],
    },
    { categoryName: null, attemptCount: 1, averageScore: 4, passRate: 40, isPassed: false, attempts: [] },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  shell.current = null
  auth.getAccessToken.mockReturnValue('token')
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_ADMIN'])
  api.getEmployeeByField.mockResolvedValue({ data: { data: detail() } })
})

const renderAdmin = async () => {
  render(<CompetencyEmployeeFieldDetailPage />)
  await screen.findByText('Kiểm soát nhiễm khuẩn')
}
const renderManager = async () => {
  auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
  render(<CompetencyEmployeeFieldDetailPage />)
  await screen.findByText('Kiểm soát nhiễm khuẩn')
}

describe('CompetencyEmployeeFieldDetailPage - tải chi tiết', () => {
  it('tải dữ liệu và hiển thị hồ sơ nhân viên', async () => {
    render(<CompetencyEmployeeFieldDetailPage />)
    expect(screen.getByText('Đang tải dữ liệu...')).toBeInTheDocument()
    expect(screen.getByText('Đang tải...')).toBeInTheDocument()

    await screen.findByText('Kiểm soát nhiễm khuẩn')
    expect(api.getEmployeeByField).toHaveBeenCalledWith('501', { fromDate: FROM, toDate: TODAY })
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Mã NV: NV001')).toBeInTheDocument()
    expect(screen.getByText('2 lĩnh vực có dữ liệu')).toBeInTheDocument()
  })

  it('tính điểm trung bình chung từ các lĩnh vực', async () => {
    await renderAdmin()
    // (8 + 4) / 2 = 6
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('coi điểm thiếu là 0 khi tính trung bình', async () => {
    api.getEmployeeByField.mockResolvedValue({
      data: { data: detail({ items: [
        { categoryName: 'A', attemptCount: 1, averageScore: 10, passRate: 100, isPassed: true, attempts: [] },
        { categoryName: 'B', attemptCount: 1, averageScore: null, passRate: 0, isPassed: false, attempts: [] },
      ] }) },
    })
    render(<CompetencyEmployeeFieldDetailPage />)
    await screen.findByText('A')
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có dữ liệu', async () => {
    api.getEmployeeByField.mockResolvedValue({ data: { data: detail({ items: [] }) } })
    render(<CompetencyEmployeeFieldDetailPage />)

    expect(await screen.findByText('Chưa có dữ liệu kiểm tra cho nhân viên này.')).toBeInTheDocument()
    expect(screen.getByText('0 lĩnh vực có dữ liệu')).toBeInTheDocument()
  })

  it('chịu được phản hồi rỗng', async () => {
    api.getEmployeeByField.mockResolvedValue({ data: { data: null } })
    render(<CompetencyEmployeeFieldDetailPage />)

    expect(await screen.findByText('Chưa có dữ liệu kiểm tra cho nhân viên này.')).toBeInTheDocument()
    expect(screen.getByText('Mã NV: —')).toBeInTheDocument()
  })

  it('báo lỗi khi tải dữ liệu thất bại', async () => {
    api.getEmployeeByField.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<CompetencyEmployeeFieldDetailPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('tải lại dữ liệu bằng nút Tải lại', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Tải lại/ }))
    await waitFor(() => expect(api.getEmployeeByField).toHaveBeenCalledTimes(2))
  })
})

describe('CompetencyEmployeeFieldDetailPage - bảng lĩnh vực', () => {
  it('hiển thị đầy đủ cột và tô đỏ dòng chưa đạt', async () => {
    await renderAdmin()
    const row = screen.getByText('Kiểm soát nhiễm khuẩn').closest('tr')

    expect(within(row).getByText('3')).toBeInTheDocument()
    expect(within(row).getByText('8')).toBeInTheDocument()
    expect(within(row).getByText('80%')).toBeInTheDocument()
    expect(within(row).getByText('Đạt chuẩn')).toBeInTheDocument()
    expect(screen.getByText('Chung').closest('tr').className).toContain('evd-row--danger')
  })

  it('dùng nhãn Chung khi lĩnh vực không có tên', async () => {
    await renderAdmin()
    expect(screen.getByText('Chung')).toBeInTheDocument()
  })

  it('hiện gạch ngang khi thiếu tỷ lệ đạt', async () => {
    api.getEmployeeByField.mockResolvedValue({
      data: { data: detail({ items: [{ categoryName: 'A', attemptCount: 1, averageScore: 5, passRate: null, isPassed: false, attempts: [] }] }) },
    })
    render(<CompetencyEmployeeFieldDetailPage />)
    await screen.findByText('A')
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('CompetencyEmployeeFieldDetailPage - mở rộng lịch sử thi', () => {
  it('mở và đóng lịch sử của một lĩnh vực', async () => {
    await renderAdmin()
    const fieldRow = () => screen.getAllByText('Kiểm soát nhiễm khuẩn')[0].closest('tr')
    fireEvent.click(fieldRow())

    expect(screen.getByText('Lịch sử thi — Kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(screen.getByText('Đề số 1')).toBeInTheDocument()
    expect(screen.getByText('18/20')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getByText('Không đạt')).toBeInTheDocument()

    fireEvent.click(fieldRow())
    expect(screen.queryByText('Lịch sử thi — Kiểm soát nhiễm khuẩn')).not.toBeInTheDocument()
  })

  it('điền gạch ngang cho lượt thi thiếu dữ liệu', async () => {
    await renderAdmin()
    fireEvent.click(screen.getAllByText('Kiểm soát nhiễm khuẩn')[0].closest('tr'))

    const historyRows = screen.getAllByRole('row').filter((row) => within(row).queryAllByText('—').length)
    expect(historyRows.length).toBeGreaterThan(0)
  })

  it('không mở rộng lĩnh vực chưa có lượt thi', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByText('Chung').closest('tr'))
    expect(screen.queryByText(/Lịch sử thi —/)).not.toBeInTheDocument()
  })
})

describe('CompetencyEmployeeFieldDetailPage - điều hướng theo vai trò', () => {
  it('hiện breadcrumb và đường dẫn quay lại của quản trị viên', async () => {
    await renderAdmin()

    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Dashboard|/admin/dashboard')
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Nguyễn Văn A')
    expect(screen.getByRole('link', { name: 'Quay lại' }))
      .toHaveAttribute('href', '/admin/evaluation/competency-by-field')
    expect(screen.getByTestId('title')).toHaveTextContent('')
  })

  it('hiện tiêu đề riêng và đường dẫn quay lại của quản lý khoa', async () => {
    await renderManager()

    expect(screen.getByTestId('title')).toHaveTextContent('Năng lực: Nguyễn Văn A')
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('')
    expect(screen.getByRole('link', { name: 'Quay lại' }))
      .toHaveAttribute('href', '/manager/competency-by-field')
  })

  it('hiện dấu ba chấm trên tiêu đề khi chưa tải xong', () => {
    auth.getRolesFromAccessToken.mockReturnValue(['ROLE_MANAGER'])
    api.getEmployeeByField.mockReturnValue(new Promise(() => {}))
    render(<CompetencyEmployeeFieldDetailPage />)

    expect(screen.getByTestId('title')).toHaveTextContent('Năng lực: ...')
  })
})
