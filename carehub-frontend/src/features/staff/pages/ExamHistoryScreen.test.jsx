import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExamHistoryScreen from './ExamHistoryScreen.jsx'

const showToast = vi.fn()
const api = vi.hoisted(() => ({ listAttempts: vi.fn(), getAttempt: vi.fn() }))

vi.mock('../../evaluation/api/myExamApi.js', () => ({ myExamApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/PassFailBadge.jsx', () => ({
  default: ({ passed, unknownLabel }) => (
    <span>{passed === null ? unknownLabel : passed ? 'Đạt' : 'Không đạt'}</span>
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

const attempt = (id, overrides = {}) => ({
  id,
  assignmentName: `Đợt kiểm tra ${id}`,
  examPaperName: `Đề số ${id}`,
  professionalFieldId: 9,
  professionalFieldName: 'Kiểm soát nhiễm khuẩn',
  professionalFieldCode: 'KSNK',
  status: 'GRADED',
  score: 8,
  passed: true,
  submittedAt: '2026-08-20T03:00:00Z',
  timeSpentSeconds: 1800,
  attemptNumber: 1,
  ...overrides,
})

const attemptDetail = (overrides = {}) => ({
  ...attempt(1),
  questions: [
    { paperQuestionId: 100, position: 1, stem: 'Rửa tay bao lâu?', optionA: '10 giây', optionB: '20 giây', optionC: '30 giây', optionD: '60 giây' },
    { paperQuestionId: 101, position: 2, stem: 'Câu chưa chọn?', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', selectedAnswer: null },
  ],
  answers: [
    { paperQuestionId: 100, selectedAnswer: 'B', correct: true, correctAnswer: 'B', explanation: 'Đúng theo hướng dẫn' },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.listAttempts.mockResolvedValue({
    data: { data: [
      attempt(1),
      attempt(2, { passed: false, score: 4, status: 'SUBMITTED', professionalFieldId: 10, professionalFieldName: 'Hồi sức' }),
      attempt(3, { status: 'EXPIRED', passed: null, score: null, professionalFieldId: null, professionalFieldName: null, timeSpentSeconds: null }),
      attempt(4, { status: 'IN_PROGRESS' }),
    ] },
  })
  api.getAttempt.mockResolvedValue({ data: { data: attemptDetail() } })
})

const renderPage = async () => {
  render(<ExamHistoryScreen />)
  await screen.findByText('Đợt kiểm tra 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm theo tên bài thi...')
const rowOf = (name) => screen.getByText(name).closest('tr')

describe('ExamHistoryScreen - danh sách lượt thi', () => {
  it('tải lịch sử và chỉ hiển thị lượt đã kết thúc', async () => {
    render(<ExamHistoryScreen />)
    expect(screen.getByText('Đang tải lịch sử thi...')).toBeInTheDocument()

    await screen.findByText('Đợt kiểm tra 1')
    expect(api.listAttempts).toHaveBeenCalled()
    expect(screen.getByText('Đợt kiểm tra 2')).toBeInTheDocument()
    expect(screen.getByText('Đợt kiểm tra 3')).toBeInTheDocument()
    // lượt đang làm dở không nằm trong lịch sử
    expect(screen.queryByText('Đợt kiểm tra 4')).not.toBeInTheDocument()
  })

  it('tính tổng hợp trên các lượt đã kết thúc', async () => {
    await renderPage()

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6/10')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('trả 0 khi chưa có lượt nào được chấm điểm', async () => {
    api.listAttempts.mockResolvedValue({ data: { data: [attempt(3, { status: 'EXPIRED', score: null, passed: null })] } })
    render(<ExamHistoryScreen />)
    await screen.findByText('Đợt kiểm tra 3')

    expect(screen.getByText('0/10')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('hiển thị điểm, kết quả và thời gian từng lượt', async () => {
    await renderPage()

    expect(within(rowOf('Đợt kiểm tra 1')).getByText('8/10')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra 1')).getByText('Đạt')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra 1')).getByText('30 phút')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra 2')).getByText('Không đạt')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra 3')).getByText('0 phút')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra 3')).getByText('—')).toBeInTheDocument()
  })

  it('hiện Chờ công bố khi lượt đã chấm nhưng chưa có điểm', async () => {
    api.listAttempts.mockResolvedValue({ data: { data: [attempt(1, { score: null, status: 'GRADED' })] } })
    await renderPage()
    expect(screen.getByText('Chờ công bố')).toBeInTheDocument()
  })

  it('hiện dấu ba chấm khi lượt chưa chấm và chưa có điểm', async () => {
    await renderPage()
    expect(within(rowOf('Đợt kiểm tra 3')).getByText('---')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra 3')).getByText('--')).toBeInTheDocument()
  })

  it('dùng tên đề khi lượt không có tên đợt', async () => {
    api.listAttempts.mockResolvedValue({ data: { data: [attempt(1, { assignmentName: null })] } })
    render(<ExamHistoryScreen />)
    expect(await screen.findByText('Đề số 1')).toBeInTheDocument()
  })

  it('dùng nhãn mặc định khi thiếu cả tên đợt lẫn tên đề', async () => {
    api.listAttempts.mockResolvedValue({ data: { data: [attempt(1, { assignmentName: null, examPaperName: null })] } })
    render(<ExamHistoryScreen />)
    expect(await screen.findByText('Bài kiểm tra')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có lịch sử', async () => {
    api.listAttempts.mockResolvedValue({ data: { data: [] } })
    render(<ExamHistoryScreen />)
    expect(await screen.findByText('Chưa có lịch sử thi.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải lịch sử thất bại', async () => {
    api.listAttempts.mockRejectedValue({ response: { data: { message: 'Hết phiên đăng nhập' } } })
    render(<ExamHistoryScreen />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Hết phiên đăng nhập', 'error'))
  })
})

describe('ExamHistoryScreen - tìm kiếm và lọc', () => {
  it('tìm theo tên đợt và tên đề', async () => {
    await renderPage()

    fireEvent.change(searchBox(), { target: { value: 'đợt kiểm tra 2' } })
    await waitFor(() => expect(screen.queryByText('Đợt kiểm tra 1')).not.toBeInTheDocument())

    fireEvent.change(searchBox(), { target: { value: 'đề số 3' } })
    expect(await screen.findByText('Đợt kiểm tra 3')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    expect(await screen.findByText('Chưa có lịch sử thi.')).toBeInTheDocument()
  })

  it.each([
    ['pass', 'Đợt kiểm tra 1'],
    ['fail', 'Đợt kiểm tra 2'],
    ['expired', 'Đợt kiểm tra 3'],
  ])('lọc theo trạng thái %s', async (value, expected) => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value } })

    expect(await screen.findByText(expected)).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('dựng danh sách lĩnh vực từ dữ liệu và lọc theo lĩnh vực', async () => {
    await renderPage()
    expect(screen.getByRole('option', { name: 'Hồi sức' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '10' } })
    expect(await screen.findByText('Đợt kiểm tra 2')).toBeInTheDocument()
    expect(screen.queryByText('Đợt kiểm tra 1')).not.toBeInTheDocument()
  })

  it('dùng mã lĩnh vực khi thiếu tên', async () => {
    api.listAttempts.mockResolvedValue({
      data: { data: [attempt(1, { professionalFieldName: null, professionalFieldCode: 'KSNK' })] },
    })
    await renderPage()
    expect(screen.getByRole('option', { name: 'KSNK' })).toBeInTheDocument()
  })

  it('trả về tất cả khi chọn lại trạng thái mặc định', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'pass' } })
    await waitFor(() => expect(screen.queryByText('Đợt kiểm tra 2')).not.toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'all' } })
    expect(await screen.findByText('Đợt kiểm tra 2')).toBeInTheDocument()
  })
})

describe('ExamHistoryScreen - chi tiết lượt thi', () => {
  it('mở chi tiết và hiển thị từng câu hỏi', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    await waitFor(() => expect(api.getAttempt).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Rửa tay bao lâu?')).toBeInTheDocument()
    expect(screen.getByText('Câu 1')).toBeInTheDocument()
    expect(screen.getByText('Đúng')).toBeInTheDocument()
    expect(screen.getByText('Đã chọn: B | Đáp án đúng: B')).toBeInTheDocument()
    expect(screen.getByText('Giải thích: Đúng theo hướng dẫn')).toBeInTheDocument()
  })

  it('hiện Chưa chọn cho câu không có đáp án đã chọn', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    expect(await screen.findByText('Đã chọn: Chưa chọn')).toBeInTheDocument()
  })

  it('đánh dấu câu trả lời sai', async () => {
    api.getAttempt.mockResolvedValue({
      data: { data: attemptDetail({
        answers: [{ paperQuestionId: 100, selectedAnswer: 'A', correct: false, correctAnswer: null }],
      }) },
    })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    expect(await screen.findByText('Sai')).toBeInTheDocument()
    expect(screen.getByText('Đã chọn: A | Đáp án đúng: ---')).toBeInTheDocument()
  })

  it('nhắc chưa công bố đáp án khi lượt không có answers', async () => {
    api.getAttempt.mockResolvedValue({ data: { data: attemptDetail({ answers: [] }) } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    expect(await screen.findByText(/Chưa hiển thị đáp án đúng và giải thích/)).toBeInTheDocument()
  })

  it('chịu được chi tiết không có câu hỏi', async () => {
    api.getAttempt.mockResolvedValue({ data: { data: { ...attempt(1), questions: null, answers: null } } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    expect(await screen.findByText(/Chưa hiển thị đáp án đúng/)).toBeInTheDocument()
  })

  it('hiện Chờ công bố trên tiêu đề chi tiết', async () => {
    api.getAttempt.mockResolvedValue({ data: { data: attemptDetail({ score: null, status: 'GRADED' }) } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    expect(await screen.findByText('Chờ công bố')).toBeInTheDocument()
  })

  it('hiện dấu ba chấm khi chi tiết chưa có điểm', async () => {
    api.getAttempt.mockResolvedValue({ data: { data: attemptDetail({ score: null, status: 'SUBMITTED' }) } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    await waitFor(() => expect(document.querySelector('.eh-detail-card')).toBeInTheDocument())
    expect(within(document.querySelector('.eh-detail-card')).getByText('---')).toBeInTheDocument()
  })

  it('báo lỗi khi tải chi tiết thất bại', async () => {
    api.getAttempt.mockRejectedValue({ response: { data: { message: 'Không tìm thấy lượt thi' } } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra 1')).getByRole('button', { name: /Chi tiết/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy lượt thi', 'error'))
    expect(document.querySelector('.eh-detail-card')).toBeNull()
  })
})
