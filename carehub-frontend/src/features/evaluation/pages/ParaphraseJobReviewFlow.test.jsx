import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ParaphraseJobReviewPage from './ParaphraseJobReviewPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({
  getParaphraseJob: vi.fn(),
  updateParaphraseCandidate: vi.fn(),
  approveParaphraseCandidate: vi.fn(),
  rejectParaphraseCandidate: vi.fn(),
  saveParaphraseCandidateAsQuestion: vi.fn(),
  approveParaphraseCandidates: vi.fn(),
  rejectParaphraseCandidates: vi.fn(),
  saveParaphraseCandidatesAsQuestions: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ jobId: '12' }),
}))
vi.mock('../api/questionBankApi.js', () => ({ questionBankApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ value, onChange, options }) => (
    <select aria-label="Mức độ nhận thức" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const candidate = (overrides = {}) => ({
  id: 201,
  stem: 'Biến thể câu hỏi thứ nhất',
  optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1',
  correctAnswer: 'A',
  status: 'VALIDATED',
  explanation: 'Giải thích biến thể',
  cognitiveLevel: 'FOUNDATION',
  semanticSimilarityToSource: 0.96,
  lexicalDifferenceFromSource: 0.42,
  duplicateMaxSimilarity: 0.5,
  warnings: '["Giữ nghĩa hơi thấp"]',
  ...overrides,
})

const job = (overrides = {}) => ({
  id: 12,
  status: 'COMPLETED',
  requestedCount: 3,
  changeStrength: 'MEDIUM',
  createdAt: '2026-08-22T03:00:00Z',
  errorMessage: null,
  sourceQuestion: {
    stem: 'Câu hỏi gốc về vệ sinh tay',
    optionA: 'Gốc A', optionB: 'Gốc B', optionC: 'Gốc C', optionD: 'Gốc D',
    correctAnswer: 'B', cognitiveLevel: 'CLINICAL_APPLICATION',
  },
  candidates: [candidate(), candidate({ id: 202, stem: 'Biến thể thứ hai', status: 'APPROVED' })],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'prompt').mockReturnValue('')
  api.getParaphraseJob.mockResolvedValue({ data: { data: job() } })
  api.updateParaphraseCandidate.mockResolvedValue({ data: { data: candidate({ stem: 'Đã sửa' }) } })
  api.approveParaphraseCandidate.mockResolvedValue({ data: { data: candidate({ status: 'APPROVED' }) } })
  api.rejectParaphraseCandidate.mockResolvedValue({ data: { data: candidate({ status: 'REJECTED' }) } })
  api.saveParaphraseCandidateAsQuestion.mockResolvedValue({ data: { data: candidate({ status: 'SAVED' }) } })
  api.approveParaphraseCandidates.mockResolvedValue({ data: { data: { candidates: [candidate({ status: 'APPROVED' })], succeededCandidateIds: [201], failedCount: 0 } } })
  api.rejectParaphraseCandidates.mockResolvedValue({ data: { data: { candidates: [candidate({ status: 'REJECTED' })], succeededCandidateIds: [201], failedCount: 0 } } })
  api.saveParaphraseCandidatesAsQuestions.mockResolvedValue({ data: { data: { candidates: [candidate({ id: 202, status: 'SAVED' })], succeededCandidateIds: [202], failedCount: 0 } } })
})

afterEach(() => {
  window.prompt.mockRestore?.()
  vi.useRealTimers()
})

const renderPage = async (overrides) => {
  if (overrides) api.getParaphraseJob.mockResolvedValue({ data: { data: job(overrides) } })
  render(<ParaphraseJobReviewPage />)
  await screen.findByText('Duyệt câu hỏi diễn đạt lại')
}
const cardOf = (stem) => screen.getByText(stem).closest('article')
const batchBar = () => screen.getByText('Chọn tất cả').closest('section')
const selectAll = () => fireEvent.click(within(batchBar()).getByRole('checkbox'))

describe('ParaphraseJobReviewPage - tải phiên', () => {
  it('tải phiên và hiển thị tóm tắt cùng câu gốc', async () => {
    render(<ParaphraseJobReviewPage />)
    expect(screen.getByText('Đang tải phiên diễn đạt lại...')).toBeInTheDocument()

    await screen.findByText('Duyệt câu hỏi diễn đạt lại')
    expect(api.getParaphraseJob).toHaveBeenCalledWith('12')
    expect(screen.getByText('2/3 biến thể')).toBeInTheDocument()
    expect(screen.getByText('Mức thay đổi: MEDIUM')).toBeInTheDocument()
    expect(screen.getByText('1 đã duyệt')).toBeInTheDocument()
    expect(screen.getByText('0 đã lưu')).toBeInTheDocument()
    expect(screen.getByText('Câu hỏi gốc về vệ sinh tay')).toBeInTheDocument()
  })

  it('hiện thông báo khi không tìm thấy phiên', async () => {
    api.getParaphraseJob.mockResolvedValue({ data: { data: null } })
    render(<ParaphraseJobReviewPage />)
    expect(await screen.findByText('Không tìm thấy phiên diễn đạt lại.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải phiên thất bại', async () => {
    api.getParaphraseJob.mockRejectedValue({ response: { data: { message: 'Phiên không tồn tại' } } })
    render(<ParaphraseJobReviewPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Phiên không tồn tại', 'error'))
  })

  it('tải lại phiên khi bấm nút Tải lại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tải lại/ }))
    await waitFor(() => expect(api.getParaphraseJob).toHaveBeenCalledTimes(2))
  })

  it('tự làm mới mỗi 2 giây khi phiên chưa kết thúc', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getParaphraseJob.mockResolvedValue({ data: { data: job({ status: 'GENERATING' }) } })
    render(<ParaphraseJobReviewPage />)
    await screen.findByText('Duyệt câu hỏi diễn đạt lại')

    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(api.getParaphraseJob).toHaveBeenCalledTimes(2)
  })

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'])('không tự làm mới khi phiên ở trạng thái %s', async (status) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getParaphraseJob.mockResolvedValue({ data: { data: job({ status }) } })
    render(<ParaphraseJobReviewPage />)
    await screen.findByText('Duyệt câu hỏi diễn đạt lại')

    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(api.getParaphraseJob).toHaveBeenCalledTimes(1)
  })

  it('hiện lỗi của phiên và cảnh báo thiếu biến thể', async () => {
    await renderPage({ errorMessage: 'Model quá tải' })
    expect(screen.getByText('Model quá tải')).toBeInTheDocument()
    expect(screen.getByText('Model chỉ tạo được 2/3 biến thể đạt bộ lọc.')).toBeInTheDocument()
  })

  it('không cảnh báo khi tạo đủ số biến thể', async () => {
    await renderPage({ requestedCount: 2 })
    expect(screen.queryByText(/Model chỉ tạo được/)).not.toBeInTheDocument()
  })

  it('hiện thông báo khi chưa có biến thể nào', async () => {
    await renderPage({ candidates: [] })
    expect(screen.getByText('Chưa có câu diễn đạt nào.')).toBeInTheDocument()
  })

  it('hiện thông báo khi thiếu câu hỏi gốc', async () => {
    await renderPage({ sourceQuestion: null })
    expect(screen.getByText('Không có dữ liệu câu hỏi gốc.')).toBeInTheDocument()
  })
})

describe('ParaphraseJobReviewPage - hiển thị thẻ biến thể', () => {
  it('hiển thị chỉ số tương đồng, cảnh báo và ghi chú', async () => {
    await renderPage({ candidates: [candidate({
      duplicateQuestionStemSnapshot: 'Câu gần nhất trong ngân hàng câu hỏi',
      reviewerNotes: 'Cần rà lại đáp án',
    })] })

    expect(screen.getByText('Giữ nghĩa với câu gốc: 96%')).toBeInTheDocument()
    expect(screen.getByText('Thay đổi từ vựng: 42%')).toBeInTheDocument()
    expect(screen.getByText('Gần câu khác nhất: 50%')).toBeInTheDocument()
    expect(screen.getByText('Giữ nghĩa hơi thấp')).toBeInTheDocument()
    expect(screen.getByText('Câu gần nhất trong ngân hàng câu hỏi')).toBeInTheDocument()
    expect(screen.getByText('Cần rà lại đáp án')).toBeInTheDocument()
    expect(screen.getByText('Giải thích biến thể')).toBeInTheDocument()
  })

  it('ẩn các khối chỉ số khi backend không trả về', async () => {
    await renderPage({ candidates: [candidate({
      semanticSimilarityToSource: null, lexicalDifferenceFromSource: null,
      duplicateMaxSimilarity: null, warnings: null, explanation: null,
    })] })

    expect(screen.queryByText(/Giữ nghĩa với câu gốc/)).not.toBeInTheDocument()
    expect(screen.queryByText('Giải thích')).not.toBeInTheDocument()
  })

  it('bỏ qua cảnh báo rỗng hoặc không phải chuỗi', async () => {
    await renderPage({ candidates: [candidate({ warnings: '["", 5, "  "]' })] })
    expect(document.querySelector('.qdoc-warning-list')).toBeNull()
  })

  it('ẩn ô chọn khi chỉ có một biến thể', async () => {
    await renderPage({ candidates: [candidate()] })
    expect(screen.queryByText('Chọn tất cả')).not.toBeInTheDocument()
    expect(within(cardOf('Biến thể câu hỏi thứ nhất')).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('khoá đúng nút theo trạng thái từng biến thể', async () => {
    await renderPage({ candidates: [
      candidate({ id: 301, stem: 'Biến thể đã lưu', status: 'SAVED' }),
      candidate({ id: 302, stem: 'Biến thể bị từ chối', status: 'REJECTED' }),
      candidate({ id: 303, stem: 'Biến thể đã duyệt', status: 'APPROVED' }),
    ] })

    const saved = cardOf('Biến thể đã lưu')
    expect(within(saved).getByRole('button', { name: /Sửa/ })).toBeDisabled()
    expect(within(saved).getByRole('button', { name: /Lưu vào ngân hàng/ })).toBeDisabled()

    const rejected = cardOf('Biến thể bị từ chối')
    expect(within(rejected).getByRole('button', { name: /Duyệt/ })).toBeDisabled()
    expect(within(rejected).getByRole('button', { name: /Từ chối/ })).toBeDisabled()
    expect(within(rejected).getByRole('button', { name: /Sửa/ })).toBeEnabled()

    const approved = cardOf('Biến thể đã duyệt')
    expect(within(approved).getByRole('button', { name: /Lưu vào ngân hàng/ })).toBeEnabled()
    expect(within(approved).getByRole('button', { name: /Duyệt/ })).toBeDisabled()
  })
})

describe('ParaphraseJobReviewPage - thao tác từng biến thể', () => {
  it('duyệt một biến thể', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(api.approveParaphraseCandidate).toHaveBeenCalledWith(201, ''))
    expect(showToast).toHaveBeenCalledWith('Duyệt candidate paraphrase thành công.', 'success')
  })

  it('gửi kèm ghi chú sẵn có khi duyệt', async () => {
    await renderPage({ candidates: [candidate({ reviewerNotes: 'Ghi chú cũ' })] })
    fireEvent.click(screen.getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(api.approveParaphraseCandidate).toHaveBeenCalledWith(201, 'Ghi chú cũ'))
  })

  it('báo lỗi khi duyệt thất bại', async () => {
    api.approveParaphraseCandidate.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })

  it('từ chối một biến thể kèm ghi chú', async () => {
    window.prompt.mockReturnValue('Sai ngữ nghĩa')
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(api.rejectParaphraseCandidate).toHaveBeenCalledWith(201, 'Sai ngữ nghĩa'))
    expect(showToast).toHaveBeenCalledWith('Từ chối candidate paraphrase thành công.', 'success')
  })

  it('gửi ghi chú rỗng khi bỏ qua hộp nhập', async () => {
    window.prompt.mockReturnValue(null)
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(api.rejectParaphraseCandidate).toHaveBeenCalledWith(201, ''))
  })

  it('báo lỗi khi từ chối thất bại', async () => {
    api.rejectParaphraseCandidate.mockRejectedValue({ response: { data: { message: 'Không từ chối được' } } })
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không từ chối được', 'error'))
  })

  it('lưu biến thể đã duyệt vào ngân hàng', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể thứ hai')).getByRole('button', { name: /Lưu vào ngân hàng/ }))

    await waitFor(() => expect(api.saveParaphraseCandidateAsQuestion).toHaveBeenCalledWith(202))
    expect(showToast).toHaveBeenCalledWith('Lưu câu paraphrase vào ngân hàng câu hỏi thành công.', 'success')
  })

  it('báo lỗi khi lưu thất bại', async () => {
    api.saveParaphraseCandidateAsQuestion.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể thứ hai')).getByRole('button', { name: /Lưu vào ngân hàng/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })
})

describe('ParaphraseJobReviewPage - thao tác hàng loạt', () => {
  it('chọn tất cả rồi bỏ chọn', async () => {
    await renderPage()
    expect(screen.getByText('Chọn câu để thao tác hàng loạt')).toBeInTheDocument()

    selectAll()
    expect(screen.getByText('2 đã chọn')).toBeInTheDocument()
    selectAll()
    expect(screen.getByText('Chọn câu để thao tác hàng loạt')).toBeInTheDocument()
  })

  it('chọn từng biến thể bằng ô tích trên thẻ', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('checkbox'))
    expect(screen.getByText('1 đã chọn')).toBeInTheDocument()

    fireEvent.click(within(cardOf('Biến thể câu hỏi thứ nhất')).getByRole('checkbox'))
    expect(screen.getByText('Chọn câu để thao tác hàng loạt')).toBeInTheDocument()
  })

  it('duyệt hàng loạt các biến thể chưa duyệt', async () => {
    await renderPage()
    selectAll()
    fireEvent.click(within(batchBar()).getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(api.approveParaphraseCandidates).toHaveBeenCalledWith([201], ''))
    expect(showToast).toHaveBeenCalledWith('Đã duyệt hàng loạt candidate', 'success')
  })

  it('từ chối hàng loạt kèm ghi chú', async () => {
    window.prompt.mockReturnValue('Chất lượng thấp')
    await renderPage()
    selectAll()
    fireEvent.click(within(batchBar()).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(api.rejectParaphraseCandidates).toHaveBeenCalledWith([201, 202], 'Chất lượng thấp'))
  })

  it('lưu hàng loạt chỉ các biến thể đã duyệt', async () => {
    await renderPage()
    selectAll()
    fireEvent.click(within(batchBar()).getByRole('button', { name: /Lưu vào ngân hàng/ }))

    await waitFor(() => expect(api.saveParaphraseCandidatesAsQuestions).toHaveBeenCalledWith([202]))
    expect(showToast).toHaveBeenCalledWith('Đã lưu hàng loạt candidate vào ngân hàng', 'success')
  })

  it('cảnh báo khi thao tác hàng loạt có phần thất bại', async () => {
    api.approveParaphraseCandidates.mockResolvedValue({
      data: { data: { candidates: [candidate({ status: 'APPROVED' })], succeededCandidateIds: [201], failedCount: 2 } },
    })
    await renderPage()
    selectAll()
    fireEvent.click(within(batchBar()).getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã duyệt hàng loạt candidate. 2 candidate lỗi.', 'warning'))
  })

  it('báo lỗi khi thao tác hàng loạt thất bại', async () => {
    api.approveParaphraseCandidates.mockRejectedValue({ response: { data: { message: 'Lỗi hàng loạt' } } })
    await renderPage()
    selectAll()
    fireEvent.click(within(batchBar()).getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Lỗi hàng loạt', 'error'))
  })

  it('bỏ qua phản hồi hàng loạt không có biến thể nào', async () => {
    api.approveParaphraseCandidates.mockResolvedValue({ data: { data: { candidates: [], succeededCandidateIds: [], failedCount: 0 } } })
    await renderPage()
    selectAll()
    fireEvent.click(within(batchBar()).getByRole('button', { name: /Duyệt/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã duyệt hàng loạt candidate', 'success'))
  })

  it('khoá nút hàng loạt khi không còn biến thể phù hợp', async () => {
    await renderPage({ candidates: [
      candidate({ id: 301, stem: 'Đã lưu 1', status: 'SAVED' }),
      candidate({ id: 302, stem: 'Đã lưu 2', status: 'SAVED' }),
    ] })
    selectAll()

    expect(within(batchBar()).getByRole('button', { name: /Duyệt/ })).toBeDisabled()
    expect(within(batchBar()).getByRole('button', { name: /Từ chối/ })).toBeDisabled()
    expect(within(batchBar()).getByRole('button', { name: /Lưu vào ngân hàng/ })).toBeDisabled()
  })
})

describe('ParaphraseJobReviewPage - sửa biến thể', () => {
  const openEdit = async (stem = 'Biến thể câu hỏi thứ nhất') => {
    fireEvent.click(within(cardOf(stem)).getByRole('button', { name: /Sửa/ }))
    await screen.findByRole('dialog', { name: /Sửa câu diễn đạt lại/i })
  }

  it('nạp sẵn dữ liệu biến thể vào biểu mẫu', async () => {
    await renderPage()
    await openEdit()

    expect(screen.getByDisplayValue('Biến thể câu hỏi thứ nhất')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A1')).toBeInTheDocument()
    expect(screen.getByLabelText('Mức độ nhận thức')).toHaveValue('FOUNDATION')
  })

  it('rơi về giá trị của câu gốc khi biến thể thiếu dữ liệu', async () => {
    await renderPage({ candidates: [candidate({ correctAnswer: null, cognitiveLevel: null, explanation: null, topic: null, reviewerNotes: null })] })
    await openEdit()

    expect(screen.getByDisplayValue('B')).toBeInTheDocument()
    expect(screen.getByLabelText('Mức độ nhận thức')).toHaveValue('CLINICAL_APPLICATION')
  })

  it('chặn lưu khi thiếu câu hỏi hoặc đáp án', async () => {
    await renderPage()
    await openEdit()
    fireEvent.change(screen.getByDisplayValue('A1'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    expect(showToast).toHaveBeenCalledWith('Vui lòng nhập đầy đủ câu hỏi và 4 đáp án.', 'warning')
    expect(api.updateParaphraseCandidate).not.toHaveBeenCalled()
  })

  it('lưu chỉnh sửa rồi đóng hộp thoại', async () => {
    await renderPage()
    await openEdit()
    fireEvent.change(screen.getByDisplayValue('Biến thể câu hỏi thứ nhất'), { target: { value: 'Đã sửa' } })
    fireEvent.change(screen.getByLabelText('Mức độ nhận thức'), { target: { value: 'CLINICAL_REASONING_ANALYSIS' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    await waitFor(() => expect(api.updateParaphraseCandidate).toHaveBeenCalledWith(201, expect.objectContaining({
      stem: 'Đã sửa', cognitiveLevel: 'CLINICAL_REASONING_ANALYSIS',
    })))
    expect(showToast).toHaveBeenCalledWith('Cập nhật và kiểm tra lại candidate thành công.', 'success')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sửa được chủ đề và các ô văn bản còn lại', async () => {
    await renderPage({ candidates: [candidate({ topic: 'Chủ đề cũ' })] })
    await openEdit()
    fireEvent.change(screen.getByDisplayValue('Chủ đề cũ'), { target: { value: 'Chủ đề mới' } })
    fireEvent.change(screen.getByDisplayValue('Giải thích biến thể'), { target: { value: 'Giải thích mới' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    await waitFor(() => expect(api.updateParaphraseCandidate).toHaveBeenCalledWith(201, expect.objectContaining({
      topic: 'Chủ đề mới', explanation: 'Giải thích mới',
    })))
  })

  it('giữ hộp thoại mở khi lưu thất bại', async () => {
    api.updateParaphraseCandidate.mockRejectedValue({ response: { data: { message: 'Nội dung không hợp lệ' } } })
    await renderPage()
    await openEdit()
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Nội dung không hợp lệ', 'error'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('đóng hộp thoại bằng nút Hủy', async () => {
    await renderPage()
    await openEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hiện đáp án đúng ở chế độ chỉ đọc', async () => {
    await renderPage()
    await openEdit()
    expect(screen.getByDisplayValue('A')).toHaveAttribute('readonly')
  })
})
