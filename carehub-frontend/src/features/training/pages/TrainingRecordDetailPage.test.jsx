import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingRecordDetailPage from './TrainingRecordDetailPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const route = { params: { id: '55' }, hash: '' }
const shell = vi.hoisted(() => ({ current: null }))
const galleryProps = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ getRecord: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
  useLocation: () => ({ hash: route.hash }),
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, back, breadcrumbs }) => {
    shell.current = { back, breadcrumbs }
    return (
      <main>
        <button onClick={back.onClick}>{back.label}</button>
        <nav data-testid="breadcrumbs">{breadcrumbs.map((crumb) => `${crumb.label}|${crumb.link || ''}`).join(' / ')}</nav>
        {children}
      </main>
    )
  },
}))
vi.mock('../components/EvidenceGallery.jsx', () => ({
  default: (props) => {
    galleryProps.current = props
    return (
      <div data-testid="gallery" data-record={props.recordId} data-count={props.evidences.length}>
        <button onClick={() => props.onError('Không mở được minh chứng')}>Báo lỗi minh chứng</button>
      </div>
    )
  },
}))

const record = (overrides = {}) => ({
  id: 55, title: 'Khoá cấp cứu cơ bản',
  employeeId: 7, employeeName: 'Nguyễn Văn A', employeeCode: 'NV001',
  workflowStatus: 'SUBMITTED', declaredHours: 8,
  startDate: '2026-08-01', endDate: '2026-08-02',
  activityTypeName: 'Hội thảo', professionalFieldName: 'Kiểm soát nhiễm khuẩn',
  submittedAt: '2026-08-03T03:00:00Z', createdAt: '2026-08-01T03:00:00Z',
  description: 'Ghi chú hồ sơ',
  evidences: [{ id: 1 }, { id: 2 }],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = { id: '55' }
  route.hash = ''
  shell.current = null
  galleryProps.current = null
  api.getRecord.mockResolvedValue({ data: { data: record() } })
})

afterEach(() => vi.useRealTimers())

const renderPage = async (overrides) => {
  if (overrides) api.getRecord.mockResolvedValue({ data: { data: record(overrides) } })
  render(<TrainingRecordDetailPage />)
  await screen.findByRole('heading', { name: 'Khoá cấp cứu cơ bản' })
}

describe('TrainingRecordDetailPage - hiển thị hồ sơ', () => {
  it('tải và hiển thị đầy đủ thông tin hồ sơ', async () => {
    render(<TrainingRecordDetailPage />)
    expect(screen.getByText('Đang tải thông tin hồ sơ...')).toBeInTheDocument()

    await screen.findByRole('heading', { name: 'Khoá cấp cứu cơ bản' })
    expect(api.getRecord).toHaveBeenCalledWith('55')
    expect(screen.getByText('Đã nộp')).toBeInTheDocument()
    expect(screen.getByText('8h')).toBeInTheDocument()
    expect(screen.getByText('8 giờ')).toBeInTheDocument()
    expect(screen.getByText('Hội thảo')).toBeInTheDocument()
    expect(screen.getByText('Kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú hồ sơ')).toBeInTheDocument()
    expect(screen.getByText(/Hình ảnh minh chứng \(2\)/)).toBeInTheDocument()
  })

  it.each([
    ['DRAFT', 'Bản nháp'],
    ['CANCELLED', 'Đã hủy'],
  ])('hiển thị nhãn trạng thái %s', async (workflowStatus, label) => {
    await renderPage({ workflowStatus })
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('giữ nguyên mã trạng thái lạ', async () => {
    await renderPage({ workflowStatus: 'ARCHIVED_X' })
    expect(screen.getByText('ARCHIVED_X')).toBeInTheDocument()
  })

  it('hiện gạch ngang khi hồ sơ không có trạng thái', async () => {
    await renderPage({ workflowStatus: null })
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('điền giá trị mặc định cho các trường còn trống', async () => {
    await renderPage({
      declaredHours: null, endDate: null, activityTypeName: null,
      professionalFieldName: null, description: null, submittedAt: null, evidences: null,
    })

    expect(screen.getByText('0h')).toBeInTheDocument()
    expect(screen.getByText('0 giờ')).toBeInTheDocument()
    expect(screen.getByText('Không có ghi chú')).toBeInTheDocument()
    expect(screen.getByText(/Hình ảnh minh chứng \(0\)/)).toBeInTheDocument()
    expect(screen.getByTestId('gallery')).toHaveAttribute('data-count', '0')
  })

  it('dùng ngày bắt đầu làm ngày kết thúc khi thiếu', async () => {
    await renderPage({ endDate: null })
    expect(screen.getAllByText('1/8/2026').length).toBeGreaterThanOrEqual(2)
  })

  it('dùng ngày tạo khi hồ sơ chưa nộp', async () => {
    await renderPage({ submittedAt: null })
    expect(screen.getByText(/01\/08\/2026/)).toBeInTheDocument()
  })

  it('ẩn dòng nhân viên trên tiêu đề khi thiếu tên', async () => {
    await renderPage({ employeeName: null })
    // Dòng nhân viên ở phần tiêu đề bị ẩn; khối chi tiết vẫn giữ mã nhân viên.
    expect(document.querySelector('.th-detail-meta__field')).toBeNull()
  })

  it('hiện lỗi kèm nút thử lại khi tải hồ sơ thất bại', async () => {
    api.getRecord.mockRejectedValueOnce({ response: { data: { message: 'Không tìm thấy hồ sơ' } } })
    render(<TrainingRecordDetailPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy hồ sơ')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('heading', { name: 'Khoá cấp cứu cơ bản' })
  })

  it('báo lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.getRecord.mockRejectedValue(new Error('down'))
    render(<TrainingRecordDetailPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối đến máy chủ')
  })

  it('không hiển thị gì khi phản hồi rỗng', async () => {
    api.getRecord.mockResolvedValue({ data: { data: null } })
    render(<TrainingRecordDetailPage />)
    await waitFor(() => expect(screen.queryByText('Đang tải thông tin hồ sơ...')).not.toBeInTheDocument())

    expect(screen.queryByTestId('gallery')).not.toBeInTheDocument()
  })
})

describe('TrainingRecordDetailPage - điều hướng', () => {
  it('quay lại trang nhân viên của hồ sơ', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(navigate).toHaveBeenCalledWith('/training/employees/7')
  })

  it('quay về danh sách khi hồ sơ chưa gắn nhân viên', async () => {
    await renderPage({ employeeId: null })
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(navigate).toHaveBeenCalledWith('/training/employees')
  })

  it('gắn breadcrumb theo nhân viên của hồ sơ', async () => {
    await renderPage()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Nguyễn Văn A|/training/employees/7')
  })

  it('dùng breadcrumb mặc định khi chưa tải xong hồ sơ', () => {
    api.getRecord.mockReturnValue(new Promise(() => {}))
    render(<TrainingRecordDetailPage />)
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Nhân viên|/training/employees')
  })
})

describe('TrainingRecordDetailPage - khối minh chứng', () => {
  it('truyền id hồ sơ và danh sách minh chứng xuống thư viện ảnh', async () => {
    await renderPage()
    expect(screen.getByTestId('gallery')).toHaveAttribute('data-record', '55')
    expect(screen.getByTestId('gallery')).toHaveAttribute('data-count', '2')
  })

  it('hiện toast khi thư viện ảnh báo lỗi', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Báo lỗi minh chứng' }))
    expect(showToast).toHaveBeenCalledWith('Không mở được minh chứng', 'error')
  })

  it('cuộn tới khối minh chứng khi URL có hash #evidence', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    route.hash = '#evidence'

    render(<TrainingRecordDetailPage />)
    await screen.findByRole('heading', { name: 'Khoá cấp cứu cơ bản' })
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('không cuộn khi URL không có hash', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(<TrainingRecordDetailPage />)
    await screen.findByRole('heading', { name: 'Khoá cấp cứu cơ bản' })
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
