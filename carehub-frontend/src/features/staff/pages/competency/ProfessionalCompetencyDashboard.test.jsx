import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionalCompetencyDashboard from './ProfessionalCompetencyDashboard.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const setSearchParams = vi.fn()
const search = { current: new URLSearchParams() }
const shell = vi.hoisted(() => ({ current: null }))
const competency = vi.hoisted(() => ({ getSummary: vi.fn() }))
const exam = vi.hoisted(() => ({ listAssignments: vi.fn(), startAssignment: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [search.current, setSearchParams],
}))
vi.mock('../../../evaluation/api/myCompetencyApi.js', () => ({ myCompetencyApi: competency }))
vi.mock('../../../evaluation/api/myExamApi.js', () => ({ myExamApi: exam }))
vi.mock('../../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, mobileSearch }) => {
    shell.current = { mobileSearch }
    return (
      <main>
        {mobileSearch && (
          <section data-testid="mobile-search" data-active={mobileSearch.activeCount}>
            {mobileSearch.renderContent({ close: () => { shell.current.closed = true } })}
          </section>
        )}
        {children}
      </main>
    )
  },
}))
vi.mock('../../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))
vi.mock('../../../../shared/components/EmptyState.jsx', () => ({ default: ({ children }) => <p>{children}</p> }))
vi.mock('../../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset }) => (
    <>
      <button onClick={onApply}>Áp dụng (mobile)</button>
      <button onClick={onReset}>Xóa bộ lọc (mobile)</button>
    </>
  ),
}))
vi.mock('../../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange, 'aria-label': ariaLabel }) => (
    <input type="date" aria-label={ariaLabel} value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ activeCount, children, errorMessage, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section data-testid="toolbar">
      <input aria-label={`${searchAriaLabel} (toolbar)`} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
    </section>
  ),
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`
const TODAY = (() => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
})()

const assignment = (id, overrides = {}) => ({
  id, name: `Bài kiểm tra ${id}`, professionalFieldName: 'Kiểm soát nhiễm khuẩn',
  dueAt: '2026-09-01T03:00:00Z', createdAt: '2026-08-01T03:00:00Z',
  currentAttemptId: null, actionable: true, ...overrides,
})

const summaryPayload = (overrides = {}) => ({
  knowledgeAverage: 8, skillAverage: 6, overallScore: 7,
  knowledgeAttemptCount: 4, skillEvaluationCount: 3,
  targetScore: 6.5, isPassed: true, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  search.current = new URLSearchParams()
  shell.current = null
  competency.getSummary.mockResolvedValue({ data: { data: summaryPayload() } })
  exam.listAssignments.mockResolvedValue({ data: { data: [assignment(1), assignment(2)] } })
  exam.startAssignment.mockResolvedValue({ data: { data: { id: 500 } } })
})

const renderPage = async (query = '') => {
  search.current = new URLSearchParams(query)
  render(<ProfessionalCompetencyDashboard />)
  await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0))
}
const paramsOf = (call) => Object.fromEntries(call[0].entries())
const mobile = () => within(screen.getByTestId('mobile-search'))

describe('ProfessionalCompetencyDashboard - tổng hợp năng lực', () => {
  it('tải tổng hợp và hiển thị hai nhóm năng lực', async () => {
    render(<ProfessionalCompetencyDashboard />)
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)

    await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0))
    expect(competency.getSummary).toHaveBeenCalledWith({ fromDate: FROM, toDate: TODAY })
    expect(screen.getByText('Kiến thức')).toBeInTheDocument()
    expect(screen.getByText('8,0')).toBeInTheDocument()
    expect(screen.getByText('6,0')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getByText(/Điểm sàn hiện tại: 6,5\/10/)).toBeInTheDocument()
  })

  it('hiện không đạt khi backend đánh dấu chưa đạt', async () => {
    competency.getSummary.mockResolvedValue({ data: { data: summaryPayload({ isPassed: false }) } })
    await renderPage()
    expect(screen.getByText('Không đạt')).toBeInTheDocument()
  })

  it('tự tính điểm tổng và so với ngưỡng mặc định khi thiếu targetScore', async () => {
    competency.getSummary.mockResolvedValue({
      data: { data: { knowledgeAverage: 8, skillAverage: 6, targetScore: null, overallScore: null } },
    })
    await renderPage()

    expect(screen.getByText('7,0')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getByText(/Điểm sàn hiện tại: 6,0\/10/)).toBeInTheDocument()
  })

  it('kết luận không đạt khi điểm tự tính dưới ngưỡng mặc định', async () => {
    competency.getSummary.mockResolvedValue({
      data: { data: { knowledgeAverage: 4, skillAverage: 4, targetScore: null, overallScore: null } },
    })
    await renderPage()
    expect(screen.getByText('Không đạt')).toBeInTheDocument()
  })

  it('coi mọi số liệu thiếu là 0', async () => {
    competency.getSummary.mockResolvedValue({ data: { data: null } })
    await renderPage()
    expect(screen.getAllByText('0,0').length).toBeGreaterThan(0)
  })

  it('hiện lỗi kèm nút thử lại khi tải tổng hợp thất bại', async () => {
    competency.getSummary.mockRejectedValueOnce({ response: { data: { message: 'Không có quyền' } } })
    render(<ProfessionalCompetencyDashboard />)

    const alert = await screen.findByText('Không có quyền')
    fireEvent.click(within(alert.closest('div')).getByRole('button', { name: /Thử lại/ }))
    await waitFor(() => expect(competency.getSummary).toHaveBeenCalledTimes(2))
  })
})

describe('ProfessionalCompetencyDashboard - danh sách bài kiểm tra', () => {
  it('hiển thị các bài kiểm tra có thể làm', async () => {
    await renderPage()

    expect(exam.listAssignments).toHaveBeenCalled()
    expect(screen.getByText('Bài kiểm tra 1')).toBeInTheDocument()
    expect(screen.getAllByText(/Kiểm soát nhiễm khuẩn · Hạn/)).toHaveLength(2)
  })

  it('loại các bài chưa sẵn sàng', async () => {
    exam.listAssignments.mockResolvedValue({
      data: { data: [assignment(1), assignment(2, { actionable: false, currentAttemptId: null })] },
    })
    await renderPage()

    expect(screen.getByText('Bài kiểm tra 1')).toBeInTheDocument()
    expect(screen.queryByText('Bài kiểm tra 2')).not.toBeInTheDocument()
  })

  it('ưu tiên bài đang làm dở rồi tới hạn nộp gần nhất', async () => {
    exam.listAssignments.mockResolvedValue({
      data: { data: [
        assignment(1, { name: 'Hạn xa', dueAt: '2026-12-01T00:00:00Z' }),
        assignment(2, { name: 'Đang làm dở', currentAttemptId: 700, dueAt: '2026-12-31T00:00:00Z' }),
        assignment(3, { name: 'Hạn gần', dueAt: '2026-09-01T00:00:00Z' }),
      ] },
    })
    await renderPage()

    const rows = screen.getAllByRole('button').filter((button) => button.className.includes('pc-assignment-row'))
    expect(rows[0]).toHaveTextContent('Đang làm dở')
    expect(rows[1]).toHaveTextContent('Hạn gần')
    expect(rows[2]).toHaveTextContent('Hạn xa')
  })

  it('xếp bài không có hạn xuống cuối và dùng ngày tạo để phân định', async () => {
    exam.listAssignments.mockResolvedValue({
      data: { data: [
        assignment(1, { name: 'Không hạn cũ', dueAt: null, createdAt: '2026-01-01T00:00:00Z' }),
        assignment(2, { name: 'Không hạn mới', dueAt: null, createdAt: '2026-08-01T00:00:00Z' }),
        assignment(3, { name: 'Có hạn', dueAt: '2026-09-01T00:00:00Z' }),
      ] },
    })
    await renderPage()

    const rows = screen.getAllByRole('button').filter((button) => button.className.includes('pc-assignment-row'))
    expect(rows[0]).toHaveTextContent('Có hạn')
    expect(rows[1]).toHaveTextContent('Không hạn mới')
    expect(rows[2]).toHaveTextContent('Không hạn cũ')
  })

  it('bỏ qua ngày không hợp lệ khi sắp xếp', async () => {
    exam.listAssignments.mockResolvedValue({
      data: { data: [assignment(1, { dueAt: 'không phải ngày' }), assignment(2)] },
    })
    await renderPage()
    expect(screen.getByText('Bài kiểm tra 2')).toBeInTheDocument()
  })

  it('chỉ hiển thị tối đa 4 bài', async () => {
    exam.listAssignments.mockResolvedValue({
      data: { data: Array.from({ length: 8 }, (_, index) => assignment(index + 1)) },
    })
    await renderPage()

    const rows = screen.getAllByRole('button').filter((button) => button.className.includes('pc-assignment-row'))
    expect(rows).toHaveLength(4)
  })

  it('dùng nhãn mặc định khi thiếu lĩnh vực chuyên môn', async () => {
    exam.listAssignments.mockResolvedValue({ data: { data: [assignment(1, { professionalFieldName: null })] } })
    await renderPage()
    expect(screen.getByText(/Năng lực chuyên môn · Hạn/)).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có bài nào', async () => {
    exam.listAssignments.mockResolvedValue({ data: { data: [] } })
    await renderPage()
    expect(screen.getByText('Hiện không có bài kiểm tra nào cần làm.')).toBeInTheDocument()
  })

  it('đổi thông báo rỗng khi đang tìm kiếm', async () => {
    exam.listAssignments.mockResolvedValue({ data: { data: [] } })
    await renderPage('q=abc')
    expect(screen.getByText('Không có bài kiểm tra phù hợp.')).toBeInTheDocument()
  })

  it('lọc theo tên bài kiểm tra từ query string', async () => {
    await renderPage('q=tra 2')
    expect(screen.getByText('Bài kiểm tra 2')).toBeInTheDocument()
    expect(screen.queryByText('Bài kiểm tra 1')).not.toBeInTheDocument()
  })

  it('hiện lỗi kèm nút thử lại khi tải danh sách thất bại', async () => {
    exam.listAssignments.mockRejectedValueOnce({ response: { data: { message: 'Lỗi tải bài thi' } } })
    render(<ProfessionalCompetencyDashboard />)

    const alert = await screen.findByText('Lỗi tải bài thi')
    fireEvent.click(within(alert.closest('div')).getByRole('button', { name: /Thử lại/ }))
    await waitFor(() => expect(exam.listAssignments).toHaveBeenCalledTimes(2))
  })

  it('chuyển sang trang xem toàn bộ', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Xem toàn bộ/ }))
    expect(navigate).toHaveBeenCalledWith('/staff/professional-competency/all')
  })
})

describe('ProfessionalCompetencyDashboard - bắt đầu làm bài', () => {
  it('tạo lượt mới rồi chuyển sang trang làm bài', async () => {
    await renderPage()
    fireEvent.click(screen.getByText('Bài kiểm tra 1').closest('button'))

    await waitFor(() => expect(exam.startAssignment).toHaveBeenCalledWith(1))
    expect(navigate).toHaveBeenCalledWith('/staff/exam/take/500')
  })

  it('vào thẳng lượt đang làm dở', async () => {
    exam.listAssignments.mockResolvedValue({ data: { data: [assignment(1, { currentAttemptId: 700 })] } })
    await renderPage()
    fireEvent.click(screen.getByText('Bài kiểm tra 1').closest('button'))

    expect(navigate).toHaveBeenCalledWith('/staff/exam/take/700')
    expect(exam.startAssignment).not.toHaveBeenCalled()
  })

  it('báo lỗi khi máy chủ không trả về lượt làm bài', async () => {
    exam.startAssignment.mockResolvedValue({ data: { data: null } })
    await renderPage()
    fireEvent.click(screen.getByText('Bài kiểm tra 1').closest('button'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('báo lỗi khi tạo lượt thất bại', async () => {
    exam.startAssignment.mockRejectedValue({ response: { data: { message: 'Đã hết lượt làm bài' } } })
    await renderPage()
    fireEvent.click(screen.getByText('Bài kiểm tra 1').closest('button'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã hết lượt làm bài', 'error'))
  })

  it('khoá các bài khác trong lúc đang mở một bài', async () => {
    let resolveStart
    exam.startAssignment.mockReturnValue(new Promise((resolve) => { resolveStart = resolve }))
    await renderPage()
    fireEvent.click(screen.getByText('Bài kiểm tra 1').closest('button'))

    await waitFor(() => expect(screen.getByText('Bài kiểm tra 2').closest('button')).toBeDisabled())
    // bấm tiếp không tạo thêm lượt
    fireEvent.click(screen.getByText('Bài kiểm tra 1').closest('button'))
    expect(exam.startAssignment).toHaveBeenCalledTimes(1)

    await act(async () => { resolveStart({ data: { data: { id: 500 } } }) })
  })
})

describe('ProfessionalCompetencyDashboard - bộ lọc', () => {
  it('áp dụng từ khoá và khoảng ngày vào query string', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Tìm bài kiểm tra (toolbar)'), { target: { value: '  cấp cứu  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(within(screen.getByTestId('toolbar')).getByLabelText('Từ ngày năng lực'), { target: { value: `${THIS_YEAR}-03-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(setSearchParams).toHaveBeenCalled())
    expect(paramsOf(setSearchParams.mock.calls.at(-1))).toMatchObject({
      q: 'cấp cứu', dateFrom: `${THIS_YEAR}-03-01`,
    })
  })

  it('chặn áp dụng khi khoảng ngày không hợp lệ', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(within(screen.getByTestId('toolbar')).getByLabelText('Từ ngày năng lực'), { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('xoá lỗi ngày khi người dùng sửa lại và khi đóng bảng lọc', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    const fromInput = within(screen.getByTestId('toolbar')).getByLabelText('Từ ngày năng lực')
    fireEvent.change(fromInput, { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)

    fireEvent.change(within(screen.getByTestId('toolbar')).getByLabelText('Đến ngày năng lực'), { target: { value: `${THIS_YEAR}-12-31` } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc trả bản nháp về mặc định', async () => {
    await renderPage('q=abc&dateFrom=2020-01-01')
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    expect(screen.getByLabelText('Tìm bài kiểm tra (toolbar)')).toHaveValue('')
    expect(within(screen.getByTestId('toolbar')).getByLabelText('Từ ngày năng lực')).toHaveValue(FROM)
  })

  it('hiển thị khoảng ngày đang áp dụng trên tiêu đề', async () => {
    await renderPage('dateFrom=2026-02-01&dateTo=2026-03-01')
    expect(screen.getByText('2026-02-01 → 2026-03-01')).toBeInTheDocument()
  })
})

describe('ProfessionalCompetencyDashboard - tìm kiếm trên di động', () => {
  it('đếm số bộ lọc đang bật', async () => {
    await renderPage('q=abc&dateFrom=2020-01-01')
    expect(screen.getByTestId('mobile-search')).toHaveAttribute('data-active', '2')
  })

  it('áp dụng bằng phím Enter và đóng bảng tìm', async () => {
    await renderPage()
    const input = mobile().getByLabelText('Tìm bài kiểm tra')
    fireEvent.change(input, { target: { value: 'cấp cứu' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(setSearchParams).toHaveBeenCalled())
    expect(shell.current.closed).toBe(true)
  })

  it('bỏ qua phím khác Enter', async () => {
    await renderPage()
    fireEvent.keyDown(mobile().getByLabelText('Tìm bài kiểm tra'), { key: 'Escape' })
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('không đóng bảng tìm khi khoảng ngày sai', async () => {
    await renderPage()
    fireEvent.change(mobile().getByLabelText('Từ ngày năng lực'), { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(mobile().getByRole('button', { name: 'Áp dụng (mobile)' }))

    expect(shell.current.closed).toBeUndefined()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('xoá bộ lọc từ bảng tìm di động', async () => {
    await renderPage('q=abc')
    fireEvent.click(mobile().getByRole('button', { name: 'Xóa bộ lọc (mobile)' }))
    expect(mobile().getByLabelText('Tìm bài kiểm tra')).toHaveValue('')
  })
})
