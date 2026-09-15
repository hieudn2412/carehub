import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffCompetencyPage from './StaffCompetencyPage.jsx'

const showToast = vi.fn()
const setSearchParams = vi.fn()
const search = { current: new URLSearchParams() }
const shellProps = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ getSkills: vi.fn(), getSkillEvaluation: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [search.current, setSearchParams],
}))
vi.mock('../../../evaluation/api/myCompetencyApi.js', () => ({ myCompetencyApi: api }))
vi.mock('../../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, mobileSearch }) => {
    shellProps.current = { mobileSearch }
    return (
      <main>
        {mobileSearch && (
          <section data-testid="mobile-search" data-active={mobileSearch.activeCount}>
            {mobileSearch.renderContent({ close: () => shellProps.current.closed = true })}
          </section>
        )}
        {children}
      </main>
    )
  },
}))
vi.mock('../../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label || 'Đang tải dữ liệu...'}</div> }))
vi.mock('../../../../shared/components/EmptyState.jsx', () => ({ default: ({ children }) => <p>{children}</p> }))
vi.mock('../../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset, className }) => (
    <>
      <button onClick={onApply}>{className?.includes('mobile') ? 'Áp dụng (mobile)' : 'Áp dụng'}</button>
      <button onClick={onReset}>{className?.includes('mobile') ? 'Xóa bộ lọc (mobile)' : 'Xóa bộ lọc'}</button>
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
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
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

const skillItem = (id, overrides = {}) => ({
  formId: id, formName: `Quy trình ${id}`, evaluationCount: 4, passCount: 3, passRate: 75,
  attempts: [
    { submissionId: 900 + id, evaluatedAt: '2026-08-20T03:00:00Z', passed: true, score: 8.5 },
    { submissionId: 800 + id, evaluatedAt: '2026-07-20T03:00:00Z', passed: false, score: 4 },
  ],
  ...overrides,
})

const detailPayload = (overrides = {}) => ({
  title: 'Quy trình 1',
  result: 'PASSED',
  convertedScore: 8.5,
  answers: [{ questionKey: 'q1', optionLabel: 'Đạt' }],
  scoreBreakdown: [
    { questionKey: 'q1', code: 'B1', title: 'Bước rửa tay', critical: true, baseScore: 1 },
    { questionKey: 'q2', code: null, title: null, critical: false, baseScore: 0 },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  search.current = new URLSearchParams()
  shellProps.current = null
  api.getSkills.mockResolvedValue({ data: { data: { items: [skillItem(1), skillItem(2, { formName: 'Quy trình yếu', passRate: 20, passCount: 1, evaluationCount: 5 })] } } })
  api.getSkillEvaluation.mockResolvedValue({ data: { data: detailPayload() } })
})

const renderPage = async (query = '') => {
  search.current = new URLSearchParams(query)
  render(<StaffCompetencyPage />)
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
}
// Ô tìm của thanh công cụ và ô tìm trên bảng di động dùng chung nhãn.
const mobileSearch = () => within(screen.getByTestId('mobile-search'))
const openDetail = async (name = 'Quy trình 1') => {
  fireEvent.click(screen.getByLabelText(new RegExp(`Xem chi tiết .* ${name}`)))
  await screen.findByText('Các bước và mức đánh giá')
}
const paramsOf = (call) => (call[0] instanceof URLSearchParams
  ? Object.fromEntries(call[0].entries())
  : call[0])

describe('StaffCompetencyPage - danh sách bảng kiểm', () => {
  it('tải danh sách với khoảng ngày mặc định và tính tổng hợp', async () => {
    render(<StaffCompetencyPage />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    await screen.findByText('Quy trình 1')
    expect(api.getSkills).toHaveBeenCalledWith({ fromDate: FROM, toDate: TODAY })
    // (3+1)/(4+5) = 44,44%
    expect(screen.getByText('44,444%')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('đánh dấu tỷ lệ thấp dưới 50%', async () => {
    await renderPage()
    const lowRate = screen.getByText('20%')
    expect(lowRate.className).toContain('is-low')
    expect(screen.getByText('75%').className).not.toContain('is-low')
  })

  it('hiện thông báo rỗng khi không có lượt đánh giá', async () => {
    api.getSkills.mockResolvedValue({ data: { data: { items: [] } } })
    render(<StaffCompetencyPage />)
    expect(await screen.findByText('Chưa có lượt đánh giá trong khoảng thời gian này.')).toBeInTheDocument()
  })

  it('đổi thông báo rỗng khi đang tìm kiếm', async () => {
    api.getSkills.mockResolvedValue({ data: { data: { items: [] } } })
    search.current = new URLSearchParams('q=abc')
    render(<StaffCompetencyPage />)
    expect(await screen.findByText('Không có bảng kiểm phù hợp.')).toBeInTheDocument()
  })

  it('chịu được phản hồi rỗng', async () => {
    api.getSkills.mockResolvedValue({ data: { data: null } })
    render(<StaffCompetencyPage />)
    expect(await screen.findByText('Chưa có lượt đánh giá trong khoảng thời gian này.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải danh sách thất bại', async () => {
    api.getSkills.mockRejectedValue({ response: { data: { message: 'Hết phiên đăng nhập' } } })
    render(<StaffCompetencyPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Hết phiên đăng nhập', 'error'))
  })

  it('lọc tại chỗ theo tên bảng kiểm từ query string', async () => {
    await renderPage('q=yếu')
    expect(screen.getByText('Quy trình yếu')).toBeInTheDocument()
    expect(screen.queryByText('Quy trình 1')).not.toBeInTheDocument()
  })

  it('ẩn nút xem chi tiết khi chưa có lượt nào', async () => {
    api.getSkills.mockResolvedValue({ data: { data: { items: [skillItem(1, { attempts: [] })] } } })
    await renderPage()
    expect(screen.queryByRole('button', { name: /Xem chi tiết/ })).not.toBeInTheDocument()
  })
})

describe('StaffCompetencyPage - bộ lọc', () => {
  it('áp dụng từ khoá và khoảng ngày vào query string', async () => {
    await renderPage()
    fireEvent.change(mobileSearch().getByLabelText('Tìm tên bảng kiểm'), { target: { value: '  rửa tay  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getAllByDisplayValue(FROM)[0], { target: { value: `${THIS_YEAR}-03-01` } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Áp dụng' })[0])

    await waitFor(() => expect(setSearchParams).toHaveBeenCalled())
    expect(paramsOf(setSearchParams.mock.calls.at(-1))).toMatchObject({
      q: 'rửa tay', dateFrom: `${THIS_YEAR}-03-01`,
    })
  })

  it('chặn áp dụng khi khoảng ngày không hợp lệ', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getAllByDisplayValue(FROM)[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Áp dụng' })[0])

    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('xoá lỗi ngày khi sửa lại và khi đóng bảng lọc', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getAllByDisplayValue(FROM)[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Áp dụng' })[0])
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)

    fireEvent.change(screen.getAllByDisplayValue(TODAY)[0], { target: { value: `${THIS_YEAR}-12-31` } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc trả query string về khoảng ngày mặc định', async () => {
    await renderPage('q=abc&dateFrom=2026-02-01')
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa bộ lọc' })[0])

    expect(paramsOf(setSearchParams.mock.calls.at(-1))).toEqual({ dateFrom: FROM, dateTo: TODAY })
  })

  it('đếm bộ lọc ngày tuỳ chỉnh', async () => {
    await renderPage('dateFrom=2020-01-01&dateTo=2020-12-31')
    expect(screen.getByTestId('active-count')).toHaveTextContent('2')
  })
})

describe('StaffCompetencyPage - tìm kiếm trên di động', () => {
  it('đếm số bộ lọc đang bật cho thanh tìm kiếm di động', async () => {
    await renderPage('q=abc&dateFrom=2020-01-01')
    expect(screen.getByTestId('mobile-search')).toHaveAttribute('data-active', '2')
  })

  it('áp dụng bộ lọc bằng phím Enter trong ô tìm di động', async () => {
    await renderPage()
    const input = mobileSearch().getByLabelText('Tìm tên bảng kiểm')

    fireEvent.change(input, { target: { value: 'rửa tay' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(setSearchParams).toHaveBeenCalled())
    expect(shellProps.current.closed).toBe(true)
  })

  it('bỏ qua phím khác Enter', async () => {
    await renderPage()
    fireEvent.keyDown(mobileSearch().getByLabelText('Tìm tên bảng kiểm'), { key: 'Escape' })
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('không đóng bảng tìm khi khoảng ngày sai', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: `${THIS_YEAR + 5}-01-01` } })
    fireEvent.keyDown(mobileSearch().getByLabelText('Tìm tên bảng kiểm'), { key: 'Enter' })

    expect(shellProps.current.closed).toBeUndefined()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('áp dụng và xoá bộ lọc từ nút trên bảng tìm di động', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: `${THIS_YEAR}-06-30` } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng (mobile)' }))
    await waitFor(() => expect(setSearchParams).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc (mobile)' }))
    expect(paramsOf(setSearchParams.mock.calls.at(-1))).toEqual({ dateFrom: FROM, dateTo: TODAY })
  })
})

describe('StaffCompetencyPage - chi tiết lượt đánh giá', () => {
  it('mở chi tiết lượt gần nhất và hiển thị từng bước', async () => {
    await renderPage()
    await openDetail()

    expect(api.getSkillEvaluation).toHaveBeenCalledWith(901)
    expect(screen.getByText('Bước rửa tay')).toBeInTheDocument()
    expect(screen.getByText(/Bước trọng yếu/)).toBeInTheDocument()
    expect(screen.getByText('Bước không có tên')).toBeInTheDocument()
    expect(screen.getByText('8,50/10')).toBeInTheDocument()
    expect(screen.getAllByText('Đạt').length).toBeGreaterThan(0)
  })

  it('hiện lịch sử các lượt và chuyển giữa các lượt', async () => {
    await renderPage()
    await openDetail()

    expect(screen.getByText('Lịch sử đánh giá (2 lượt)')).toBeInTheDocument()
    expect(screen.getByText('Lượt 2')).toBeInTheDocument()
    expect(screen.getByText(/Chưa đạt · 4,00\/10/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Lượt 1').closest('button'))
    await waitFor(() => expect(api.getSkillEvaluation).toHaveBeenCalledWith(801))
  })

  it('ẩn lịch sử khi chỉ có một lượt', async () => {
    api.getSkills.mockResolvedValue({
      data: { data: { items: [skillItem(1, { attempts: [{ submissionId: 901, evaluatedAt: null, passed: true, score: 9 }] })] } },
    })
    await renderPage()
    await openDetail()

    expect(screen.queryByText(/Lịch sử đánh giá/)).not.toBeInTheDocument()
  })

  it('hiện kết quả chưa đạt khi lượt không đạt', async () => {
    api.getSkillEvaluation.mockResolvedValue({ data: { data: detailPayload({ result: 'FAILED', convertedScore: null }) } })
    await renderPage()
    await openDetail()

    expect(screen.getByText('Chưa đạt')).toBeInTheDocument()
    expect(screen.getByText('0,00/10')).toBeInTheDocument()
  })

  it('hiện thông báo khi bảng kiểm chưa chấm theo bước', async () => {
    api.getSkillEvaluation.mockResolvedValue({ data: { data: detailPayload({ scoreBreakdown: [] }) } })
    await renderPage()
    await openDetail()

    expect(screen.getByText('Bảng kiểm này chưa có dữ liệu chấm theo từng bước.')).toBeInTheDocument()
  })

  it('hiện trạng thái đang tải chi tiết', async () => {
    let resolveDetail
    api.getSkillEvaluation.mockReturnValue(new Promise((resolve) => { resolveDetail = resolve }))
    await renderPage()
    fireEvent.click(screen.getByLabelText(/Xem chi tiết .* Quy trình 1/))

    expect(await screen.findByText('Đang tải...')).toBeInTheDocument()
    await act(async () => { resolveDetail({ data: { data: detailPayload() } }) })
  })

  it('báo lỗi và đóng hộp thoại khi tải chi tiết thất bại', async () => {
    api.getSkillEvaluation.mockRejectedValue({ response: { data: { message: 'Không tìm thấy lượt' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText(/Xem chi tiết .* Quy trình 1/))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy lượt', 'error'))
    await waitFor(() => expect(screen.queryByText('Các bước và mức đánh giá')).not.toBeInTheDocument())
  })

  it('đóng chi tiết bằng nút X và click ra nền', async () => {
    await renderPage()

    await openDetail()
    fireEvent.click(screen.getByLabelText('Đóng'))
    await waitFor(() => expect(screen.queryByText('Các bước và mức đánh giá')).not.toBeInTheDocument())

    await openDetail()
    fireEvent.mouseDown(screen.getByRole('presentation'))
    await waitFor(() => expect(screen.queryByText('Các bước và mức đánh giá')).not.toBeInTheDocument())
  })

  it('không đóng khi bấm vào bên trong hộp thoại', async () => {
    await renderPage()
    await openDetail()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.getByText('Các bước và mức đánh giá')).toBeInTheDocument()
  })

  it('dùng tên quy trình từ lượt khi chi tiết thiếu tiêu đề', async () => {
    api.getSkillEvaluation.mockResolvedValue({ data: { data: detailPayload({ title: null }) } })
    api.getSkills.mockResolvedValue({
      data: { data: { items: [skillItem(1, { attempts: [{ submissionId: 901, formName: 'Tên từ lượt', evaluatedAt: '2026-08-01', passed: true, score: 9 }] })] } },
    })
    await renderPage()
    await openDetail()

    expect(screen.getByRole('heading', { name: 'Tên từ lượt' })).toBeInTheDocument()
  })
})
