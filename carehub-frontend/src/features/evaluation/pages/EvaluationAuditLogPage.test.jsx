import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EvaluationAuditLogPage from './EvaluationAuditLogPage.jsx'

const showToast = vi.fn()
const api = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('../api/evaluationAuditLogApi.js', () => ({ evaluationAuditLogApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
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
  default: ({ actions, activeCount, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
      <div>{actions}</div>
    </section>
  ),
}))

const log = (id, overrides = {}) => ({
  id,
  action: 'QUESTION_CREATED',
  actionText: `Tạo câu hỏi #${id}`,
  entityType: 'QUESTION',
  entityId: 900 + id,
  actor: 'admin',
  summary: `Đã tạo câu hỏi ${id}`,
  createdAt: '2026-08-01T03:05:00',
  detailJson: '{"questionId":901}',
  ...overrides,
})

const EMPTY_FILTERS = { q: '', action: '', entityType: '', actor: '' }

beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue({ data: { data: [log(1), log(2, { actionText: null, action: 'PARAPHRASE_APPLIED' })] } })
})

afterEach(() => vi.useRealTimers())

const renderPage = async () => {
  render(<EvaluationAuditLogPage />)
  await screen.findAllByText('Tạo câu hỏi #1')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const table = () => screen.getByRole('table')
const detail = () => document.querySelector('.eal-detail')

describe('EvaluationAuditLogPage - danh sách audit', () => {
  it('tải và hiển thị danh sách audit log', async () => {
    render(<EvaluationAuditLogPage />)
    expect(screen.getByText('Đang tải audit đánh giá...')).toBeInTheDocument()

    await screen.findAllByText('Tạo câu hỏi #1')
    expect(api.list).toHaveBeenCalledWith(EMPTY_FILTERS)
    expect(screen.getByText('2 bản ghi')).toBeInTheDocument()
    expect(within(table()).getAllByText('03:05 01/08/2026')).toHaveLength(2)
    expect(within(table()).getAllByText(/Câu hỏi #90/).length).toBeGreaterThan(0)
    expect(within(table()).getByText('Đã tạo câu hỏi 1')).toBeInTheDocument()
  })

  it('dùng mã hành động khi thiếu nhãn hiển thị', async () => {
    await renderPage()
    expect(within(table()).getByText('PARAPHRASE_APPLIED')).toBeInTheDocument()
  })

  it('điền giá trị mặc định cho các cột còn trống', async () => {
    api.list.mockResolvedValue({ data: { data: [log(1, { entityId: null, actor: null, summary: null })] } })
    await renderPage()

    expect(within(table()).getAllByText('system').length).toBeGreaterThan(0)
    expect(within(table()).getAllByText('---').length).toBeGreaterThan(0)
  })

  it('dịch mã đối tượng lạ và đối tượng rỗng', async () => {
    api.list.mockResolvedValue({
      data: { data: [
        log(1, { entityType: 'WEIRD_ENTITY' }),
        log(2, { entityType: null, actionText: 'Hành động 2' }),
      ] },
    })
    await renderPage()

    expect(within(table()).getByText(/WEIRD_ENTITY/)).toBeInTheDocument()
    expect(within(table()).getByText(/Không rõ/)).toBeInTheDocument()
  })

  it('hiện thông báo khi không có audit phù hợp', async () => {
    api.list.mockResolvedValue({ data: { data: [] } })
    render(<EvaluationAuditLogPage />)

    expect(await screen.findByText('Chưa có audit log phù hợp.')).toBeInTheDocument()
    expect(screen.getByText('Chọn một audit log để xem chi tiết.')).toBeInTheDocument()
    expect(screen.getByText('0 bản ghi')).toBeInTheDocument()
  })

  it('chịu được phản hồi rỗng', async () => {
    api.list.mockResolvedValue({ data: {} })
    render(<EvaluationAuditLogPage />)
    expect(await screen.findByText('Chưa có audit log phù hợp.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải danh sách thất bại', async () => {
    api.list.mockRejectedValue({ response: { data: { message: 'Không có quyền xem audit' } } })
    render(<EvaluationAuditLogPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền xem audit', 'error'))
  })

  it('báo lỗi mặc định khi máy chủ không phản hồi', async () => {
    api.list.mockRejectedValue(new Error('down'))
    render(<EvaluationAuditLogPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })

  it('tải lại danh sách bằng nút Tải lại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại audit đánh giá' }))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
  })
})

describe('EvaluationAuditLogPage - khối chi tiết', () => {
  it('tự chọn bản ghi đầu tiên và hiển thị metadata', async () => {
    await renderPage()

    expect(within(detail()).getByRole('heading', { name: 'Tạo câu hỏi #1' })).toBeInTheDocument()
    expect(within(detail()).getByText('QUESTION_CREATED')).toBeInTheDocument()
    expect(within(detail()).getByText(/Câu hỏi/)).toBeInTheDocument()
    expect(document.querySelector('.eal-json pre').textContent).toContain('"questionId": 901')
  })

  it('chuyển chi tiết khi bấm xem một dòng khác', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết audit 2' }))

    expect(within(detail()).getByRole('heading', { name: 'PARAPHRASE_APPLIED' })).toBeInTheDocument()
    expect(document.querySelectorAll('.eal-row--active')).toHaveLength(1)
  })

  it('giữ nguyên bản ghi đang chọn sau khi tải lại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết audit 2' }))

    api.list.mockResolvedValue({ data: { data: [log(2, { actionText: 'Bản ghi 2 mới' }), log(1)] } })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại audit đánh giá' }))

    await waitFor(() => expect(within(detail()).getByRole('heading', { name: 'Bản ghi 2 mới' })).toBeInTheDocument())
  })

  it('hiện metadata rỗng khi bản ghi không có detailJson', async () => {
    api.list.mockResolvedValue({ data: { data: [log(1, { detailJson: null })] } })
    await renderPage()
    expect(document.querySelector('.eal-json pre').textContent).toBe('{}')
  })

  it('giữ nguyên chuỗi metadata không phải JSON', async () => {
    api.list.mockResolvedValue({ data: { data: [log(1, { detailJson: 'không-phải-json' })] } })
    await renderPage()
    expect(document.querySelector('.eal-json pre').textContent).toBe('không-phải-json')
  })

  it('điền giá trị mặc định trong chi tiết', async () => {
    api.list.mockResolvedValue({ data: { data: [log(1, { actor: null, summary: null, entityId: null, createdAt: null })] } })
    await renderPage()

    expect(within(detail()).getByText('system')).toBeInTheDocument()
    expect(within(detail()).getAllByText('---').length).toBeGreaterThanOrEqual(2)
  })
})

describe('EvaluationAuditLogPage - bộ lọc', () => {
  it('mở và đóng bảng bộ lọc', async () => {
    await renderPage()
    expect(screen.queryByLabelText('Hành động')).not.toBeInTheDocument()

    openFilters()
    expect(screen.getByLabelText('Hành động')).toBeInTheDocument()
    openFilters()
    expect(screen.queryByLabelText('Hành động')).not.toBeInTheDocument()
  })

  it('áp dụng bộ lọc hành động, đối tượng và người thao tác', async () => {
    await renderPage()
    openFilters()

    fireEvent.change(screen.getByLabelText('Hành động'), { target: { value: 'PARAPHRASE' } })
    fireEvent.change(screen.getByLabelText('Đối tượng'), { target: { value: 'PARAPHRASE_JOB' } })
    fireEvent.change(screen.getByPlaceholderText('Tên đăng nhập'), { target: { value: '  admin  ' } })
    expect(screen.getByTestId('active-count')).toHaveTextContent('3')

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.list).toHaveBeenCalledWith({
      q: '', action: 'PARAPHRASE', entityType: 'PARAPHRASE_JOB', actor: 'admin',
    }))
  })

  it('xoá toàn bộ bộ lọc', async () => {
    await renderPage()
    openFilters()
    fireEvent.change(screen.getByLabelText('Hành động'), { target: { value: 'EXAM_PAPER' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(EMPTY_FILTERS))
    expect(screen.getByTestId('active-count')).toHaveTextContent('0')
  })

  it('tìm kiếm với độ trễ 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<EvaluationAuditLogPage />)
    await screen.findAllByText('Tạo câu hỏi #1')

    fireEvent.change(screen.getByLabelText('Tìm audit đánh giá'), { target: { value: '  câu hỏi  ' } })
    expect(api.list).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ ...EMPTY_FILTERS, q: 'câu hỏi' }))
  })

  it('không gọi lại khi từ khoá không đổi sau khi cắt khoảng trắng', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<EvaluationAuditLogPage />)
    await screen.findAllByText('Tạo câu hỏi #1')

    fireEvent.change(screen.getByLabelText('Tìm audit đánh giá'), { target: { value: '   ' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })

    expect(api.list).toHaveBeenCalledTimes(1)
  })
})
