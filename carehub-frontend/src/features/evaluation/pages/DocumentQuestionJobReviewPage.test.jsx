import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DocumentQuestionJobReviewPage from './DocumentQuestionJobReviewPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const documentApi = vi.hoisted(() => ({
  getQuestionJob: vi.fn(),
  retryFailedChunks: vi.fn(),
  cancelQuestionJob: vi.fn(),
  rejectCandidate: vi.fn(),
  rejectCandidates: vi.fn(),
  saveCandidateAsQuestion: vi.fn(),
  saveCandidatesAsQuestions: vi.fn(),
  updateCandidate: vi.fn(),
  getPotentialDuplicates: vi.fn(),
}))
const categoryApi = vi.hoisted(() => ({ listCategories: vi.fn() }))
const training = vi.hoisted(() => ({ getRecordOptions: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ jobId: '71' }),
}))
vi.mock('../api/documentQuestionApi.js', () => ({ documentQuestionApi: documentApi }))
vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: categoryApi }))
vi.mock('../../training/api/trainingApi.js', () => ({ trainingApi: training }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, confirmText, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Giữ phiên</button>
      <button onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ value, onChange, options = [], placeholder }) => (
    <select aria-label={placeholder} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
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
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ activeCount, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
    </section>
  ),
}))

const candidate = (overrides = {}) => ({
  id: 101,
  stem: 'Dấu hiệu nào cần theo dõi sau mổ?',
  optionA: 'Mạch nhanh', optionB: 'Ăn ngon', optionC: 'Ngủ sâu', optionD: 'Da ấm',
  correctAnswer: 'A',
  explanation: 'Mạch nhanh là dấu hiệu cảnh báo.',
  status: 'VALIDATED',
  categoryId: 4,
  professionalFieldId: 9,
  professionalFieldCode: 'KSNK',
  professionalFieldName: 'Kiểm soát nhiễm khuẩn',
  cognitiveLevel: 'CLINICAL_APPLICATION',
  pageStart: 2, pageEnd: 3,
  duplicateMaxSimilarity: 0.4,
  ...overrides,
})

const job = (overrides = {}) => ({
  id: 71,
  status: 'COMPLETED',
  createdAt: '2026-08-21T03:00:00Z',
  errorMessage: null,
  candidateCount: 2,
  candidates: [candidate(), candidate({ id: 102, stem: 'Câu hỏi thứ hai', status: 'SAVED', savedQuestionId: 900 })],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'prompt').mockReturnValue('')
  documentApi.getQuestionJob.mockResolvedValue({ data: { data: job() } })
  documentApi.retryFailedChunks.mockResolvedValue({ data: { data: job({ status: 'GENERATING' }) } })
  documentApi.cancelQuestionJob.mockResolvedValue({ data: { data: job({ status: 'CANCELLED' }) } })
  documentApi.rejectCandidate.mockResolvedValue({ data: { data: candidate({ status: 'REJECTED' }) } })
  documentApi.saveCandidateAsQuestion.mockResolvedValue({ data: { data: candidate({ status: 'SAVED', savedQuestionId: 555 }) } })
  documentApi.rejectCandidates.mockResolvedValue({ data: { data: { candidates: [candidate({ status: 'REJECTED' })], succeededCandidateIds: [101], failedCount: 0 } } })
  documentApi.saveCandidatesAsQuestions.mockResolvedValue({ data: { data: { candidates: [candidate({ status: 'SAVED' })], succeededCandidateIds: [101], failedCount: 0 } } })
  documentApi.updateCandidate.mockResolvedValue({ data: { data: candidate({ stem: 'Câu hỏi đã sửa' }) } })
  documentApi.getPotentialDuplicates.mockResolvedValue({ data: { data: [] } })
  categoryApi.listCategories.mockResolvedValue({ data: { data: [{ id: 4, code: 'DD', name: 'Điều dưỡng' }] } })
  training.getRecordOptions.mockResolvedValue({ data: { data: { professionalFields: [{ id: 9, code: 'KSNK', name: 'Kiểm soát nhiễm khuẩn' }] } } })
})

afterEach(() => {
  window.prompt.mockRestore?.()
  vi.useRealTimers()
})

const renderPage = async (jobOverrides) => {
  if (jobOverrides) documentApi.getQuestionJob.mockResolvedValue({ data: { data: job(jobOverrides) } })
  render(<DocumentQuestionJobReviewPage />)
  await screen.findByText(/Review phiên tạo câu hỏi #71/)
}
const cardOf = (stem) => screen.getByText(stem).closest('article')
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))

describe('DocumentQuestionJobReviewPage - tải phiên', () => {
  it('tải phiên và hiển thị chỉ số, danh sách câu đề xuất', async () => {
    render(<DocumentQuestionJobReviewPage />)
    expect(screen.getByText('Đang tải phiên tạo câu hỏi...')).toBeInTheDocument()

    await screen.findByText(/Review phiên tạo câu hỏi #71/)
    expect(documentApi.getQuestionJob).toHaveBeenCalledWith('71')
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('Dấu hiệu nào cần theo dõi sau mổ?')).toBeInTheDocument()
    expect(screen.getByText('Câu hỏi thứ hai')).toBeInTheDocument()
  })

  it('hiện lỗi kèm nút tải lại khi không lấy được phiên', async () => {
    documentApi.getQuestionJob.mockRejectedValue({ response: { data: { message: 'Phiên không tồn tại' } } })
    render(<DocumentQuestionJobReviewPage />)

    expect(await screen.findByText('Phiên không tồn tại')).toBeInTheDocument()
    expect(showToast).toHaveBeenCalledWith('Phiên không tồn tại', 'error')

    documentApi.getQuestionJob.mockResolvedValue({ data: { data: job() } })
    fireEvent.click(screen.getByRole('button', { name: /Thử tải lại/ }))
    await screen.findByText(/Review phiên tạo câu hỏi #71/)
  })

  it('hiện thông báo mặc định khi phản hồi rỗng', async () => {
    documentApi.getQuestionJob.mockResolvedValue({ data: { data: null } })
    render(<DocumentQuestionJobReviewPage />)
    expect(await screen.findByText('Không tìm thấy phiên tạo câu hỏi.')).toBeInTheDocument()
  })

  it('bỏ qua lỗi khi nạp danh mục và lĩnh vực thất bại', async () => {
    categoryApi.listCategories.mockRejectedValue(new Error('down'))
    await renderPage()
    expect(screen.getByText('Dấu hiệu nào cần theo dõi sau mổ?')).toBeInTheDocument()
  })

  it('tự làm mới mỗi 3 giây khi phiên đang chạy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    documentApi.getQuestionJob.mockResolvedValue({ data: { data: job({ status: 'GENERATING' }) } })
    render(<DocumentQuestionJobReviewPage />)
    await screen.findByText(/Review phiên tạo câu hỏi #71/)
    expect(screen.getByText(/Phiên tạo câu hỏi đang xử lý nền/)).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(documentApi.getQuestionJob).toHaveBeenCalledTimes(2)
  })

  it('không tự làm mới khi phiên đã kết thúc', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderPage()
    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(documentApi.getQuestionJob).toHaveBeenCalledTimes(1)
  })
})

describe('DocumentQuestionJobReviewPage - cảnh báo và thao tác phiên', () => {
  it('hiện lỗi phiên dạng nguy hiểm khi phiên thất bại', async () => {
    await renderPage({ status: 'FAILED', errorMessage: 'Hết hạn mức API' })
    expect(screen.getByText('Hết hạn mức API')).toBeInTheDocument()
  })

  it('ẩn thông báo lỗi mang tính kỹ thuật của backend', async () => {
    await renderPage({ errorMessage: 'Có câu hỏi để duyệt nhưng vẫn còn chunk lỗi hoặc không tạo được đầu ra' })
    expect(screen.queryByText(/vẫn còn chunk lỗi/)).not.toBeInTheDocument()
  })

  it('cho chạy lại toàn bộ khi phiên trước không tạo được câu hỏi mới', async () => {
    await renderPage({
      status: 'PARTIALLY_COMPLETED', candidateCount: 0, candidates: [],
      errorMessage: 'Phiên không có câu hỏi mới nào',
    })
    fireEvent.click(screen.getByRole('button', { name: /Chạy lại toàn bộ đoạn/ }))

    await waitFor(() => expect(documentApi.retryFailedChunks).toHaveBeenCalledWith('71'))
    expect(showToast).toHaveBeenCalledWith('Đã chạy lại toàn bộ đoạn nội dung.', 'success')
  })

  it('báo lỗi khi chạy lại thất bại', async () => {
    documentApi.retryFailedChunks.mockRejectedValue({ response: { data: { message: 'Không chạy lại được' } } })
    await renderPage({
      status: 'PARTIALLY_COMPLETED', candidateCount: 0, candidates: [],
      errorMessage: 'Phiên không có câu hỏi mới nào',
    })
    fireEvent.click(screen.getByRole('button', { name: /Chạy lại toàn bộ đoạn/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không chạy lại được', 'error'))
  })

  it('cảnh báo khi còn câu thiếu danh mục hoặc lĩnh vực', async () => {
    await renderPage({ candidates: [candidate({ categoryId: null }), candidate({ id: 102, cognitiveLevel: null })] })
    expect(screen.getByText(/2 câu chưa đủ danh mục, lĩnh vực chuyên môn hoặc mức độ nhận thức/)).toBeInTheDocument()
  })

  it('hỏi xác nhận rồi hủy phiên đang chạy', async () => {
    await renderPage({ status: 'GENERATING' })
    fireEvent.click(screen.getByRole('button', { name: /Hủy phiên$/ }))

    const dialog = screen.getByRole('dialog', { name: 'Hủy phiên tạo câu hỏi?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy phiên' }))

    await waitFor(() => expect(documentApi.cancelQuestionJob).toHaveBeenCalledWith('71'))
    expect(showToast).toHaveBeenCalledWith('Đã hủy phiên tạo câu hỏi.', 'success')
  })

  it('không hủy phiên khi người dùng giữ lại', async () => {
    await renderPage({ status: 'GENERATING' })
    fireEvent.click(screen.getByRole('button', { name: /Hủy phiên$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Giữ phiên' }))

    expect(documentApi.cancelQuestionJob).not.toHaveBeenCalled()
  })

  it('báo lỗi khi hủy phiên thất bại', async () => {
    documentApi.cancelQuestionJob.mockRejectedValue(new Error('down'))
    await renderPage({ status: 'GENERATING' })
    fireEvent.click(screen.getByRole('button', { name: /Hủy phiên$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiên' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })

  it('ẩn nút hủy khi phiên đã kết thúc', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: /Hủy phiên$/ })).not.toBeInTheDocument()
  })
})

describe('DocumentQuestionJobReviewPage - lọc câu đề xuất', () => {
  it('tìm theo nội dung câu hỏi', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Tìm theo nội dung câu hỏi'), { target: { value: 'thứ hai' } })

    await waitFor(() => expect(screen.queryByText('Dấu hiệu nào cần theo dõi sau mổ?')).not.toBeInTheDocument())
    expect(screen.getByText('Câu hỏi thứ hai')).toBeInTheDocument()
  })

  it('lọc theo trạng thái, lĩnh vực và mức nhận thức', async () => {
    await renderPage()
    openFilters()

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'SAVED' } })
    await waitFor(() => expect(screen.queryByText('Dấu hiệu nào cần theo dõi sau mổ?')).not.toBeInTheDocument())
    expect(screen.getByTestId('active-count')).toHaveTextContent('1')

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: '' } })
    await waitFor(() => expect(screen.getByLabelText('Lĩnh vực chuyên môn').querySelector('option[value="9"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '9' } })
    expect(await screen.findByText('Dấu hiệu nào cần theo dõi sau mổ?')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Mức độ nhận thức'), { target: { value: 'FOUNDATION' } })
    expect(await screen.findByText('Không có câu hỏi đề xuất phù hợp bộ lọc.')).toBeInTheDocument()
  })

  it('lọc theo nhãn thay vì trạng thái khi backend gắn label', async () => {
    await renderPage({ candidates: [candidate({ status: 'VALIDATED', label: 'GOOD' })] })
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'GOOD' } })

    expect(await screen.findByText('Dấu hiệu nào cần theo dõi sau mổ?')).toBeInTheDocument()
  })

  it('đóng bảng lọc khi bấm Áp dụng và xoá sạch khi bấm Xóa bộ lọc', async () => {
    await renderPage()
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'SAVED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.queryByLabelText('Trạng thái')).not.toBeInTheDocument()

    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('0'))
    expect(screen.getByText('Dấu hiệu nào cần theo dõi sau mổ?')).toBeInTheDocument()
  })
})

describe('DocumentQuestionJobReviewPage - thao tác trên từng câu', () => {
  it('từ chối một câu kèm ghi chú của người duyệt', async () => {
    window.prompt.mockReturnValue('Nội dung sai')
    await renderPage()
    fireEvent.click(within(cardOf('Dấu hiệu nào cần theo dõi sau mổ?')).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(documentApi.rejectCandidate).toHaveBeenCalledWith(101, 'Nội dung sai'))
    expect(showToast).toHaveBeenCalledWith('Từ chối câu hỏi đề xuất thành công.', 'success')
  })

  it('gửi ghi chú rỗng khi người duyệt bấm huỷ hộp nhập', async () => {
    window.prompt.mockReturnValue(null)
    await renderPage()
    fireEvent.click(within(cardOf('Dấu hiệu nào cần theo dõi sau mổ?')).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(documentApi.rejectCandidate).toHaveBeenCalledWith(101, ''))
  })

  it('báo lỗi khi từ chối thất bại', async () => {
    documentApi.rejectCandidate.mockRejectedValue({ response: { data: { message: 'Không từ chối được' } } })
    await renderPage()
    fireEvent.click(within(cardOf('Dấu hiệu nào cần theo dõi sau mổ?')).getByRole('button', { name: /Từ chối/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không từ chối được', 'error'))
  })

  it('lưu một câu vào ngân hàng câu hỏi', async () => {
    await renderPage()
    fireEvent.click(within(cardOf('Dấu hiệu nào cần theo dõi sau mổ?')).getByRole('button', { name: /Lưu vào ngân hàng câu hỏi/ }))

    await waitFor(() => expect(documentApi.saveCandidateAsQuestion).toHaveBeenCalledWith(101))
    expect(showToast).toHaveBeenCalledWith('Lưu câu hỏi vào ngân hàng câu hỏi thành công.', 'success')
  })

  it('báo lỗi khi lưu một câu thất bại', async () => {
    documentApi.saveCandidateAsQuestion.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(within(cardOf('Dấu hiệu nào cần theo dõi sau mổ?')).getByRole('button', { name: /Lưu vào ngân hàng câu hỏi/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })

  it('khoá thao tác của câu đã lưu và mở được câu hỏi trong ngân hàng', async () => {
    await renderPage()
    const savedCard = cardOf('Câu hỏi thứ hai')
    expect(within(savedCard).getByRole('button', { name: /Sửa/ })).toBeDisabled()
    expect(within(savedCard).getByRole('button', { name: /Từ chối/ })).toBeDisabled()
    expect(within(savedCard).getByText('Câu hỏi #900')).toBeInTheDocument()

    fireEvent.click(within(savedCard).getByRole('button', { name: /Mở câu hỏi/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/question-bank/900/edit')
  })

  it('khoá nút từ chối với câu đã bị từ chối', async () => {
    await renderPage({ candidates: [candidate({ status: 'REJECTED' })] })
    const card = cardOf('Dấu hiệu nào cần theo dõi sau mổ?')
    expect(within(card).getByRole('button', { name: /Từ chối/ })).toBeDisabled()
    expect(within(card).getByRole('button', { name: /Lưu vào ngân hàng câu hỏi/ })).toBeDisabled()
    expect(within(card).getByRole('button', { name: /Sửa/ })).toBeEnabled()
  })

  it('chọn câu khi bấm vào thẻ', async () => {
    await renderPage()
    fireEvent.click(cardOf('Câu hỏi thứ hai'))
    expect(cardOf('Câu hỏi thứ hai').className).toContain('qdoc-candidate-card--active')
  })

  it('hiện nhãn mặc định khi câu thiếu lĩnh vực và mức nhận thức', async () => {
    await renderPage({ candidates: [candidate({ professionalFieldCode: null, professionalFieldId: null, cognitiveLevel: null })] })
    expect(screen.getAllByText('Chưa có lĩnh vực').length).toBeGreaterThan(0)
    expect(screen.getByText(/Lĩnh vực: Chưa có lĩnh vực chuyên môn/)).toBeInTheDocument()
  })

  it('ghép số trang vào phần giải thích', async () => {
    await renderPage({ candidates: [candidate()] })
    expect(screen.getByText(/\(Trang 2–3\)/)).toBeInTheDocument()
  })

  it('hiện riêng số trang khi câu không có giải thích', async () => {
    await renderPage({ candidates: [candidate({ explanation: null, pageEnd: null })] })
    expect(screen.getByText('Trang 2')).toBeInTheDocument()
  })

  it('bỏ khối giải thích khi không có cả giải thích lẫn số trang', async () => {
    await renderPage({ candidates: [candidate({ explanation: null, pageStart: null, pageEnd: null })] })
    expect(screen.queryByText('Giải thích')).not.toBeInTheDocument()
  })
})

describe('DocumentQuestionJobReviewPage - thao tác hàng loạt', () => {
  const selectAll = () => fireEvent.click(screen.getByRole('checkbox', { name: /Chọn tất cả trong bộ lọc/ }))
  const batchBar = () => screen.getByText(/đã chọn$/).closest('section')
  const batchButton = (name) => within(batchBar()).getByRole('button', { name })

  it('chọn tất cả rồi bỏ chọn tất cả trong bộ lọc', async () => {
    await renderPage()
    selectAll()
    expect(screen.getByText('2 đã chọn')).toBeInTheDocument()

    selectAll()
    expect(screen.getByText('0 đã chọn')).toBeInTheDocument()
  })

  it('chọn từng câu bằng ô tích trên thẻ', async () => {
    await renderPage()
    const checkbox = within(cardOf('Dấu hiệu nào cần theo dõi sau mổ?')).getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(screen.getByText('1 đã chọn')).toBeInTheDocument()

    fireEvent.click(checkbox)
    expect(screen.getByText('0 đã chọn')).toBeInTheDocument()
  })

  it('từ chối hàng loạt các câu còn thao tác được', async () => {
    window.prompt.mockReturnValue('Chất lượng thấp')
    await renderPage()
    selectAll()
    fireEvent.click(batchButton(/Từ chối/))

    await waitFor(() => expect(documentApi.rejectCandidates).toHaveBeenCalledWith([101], 'Chất lượng thấp'))
    expect(showToast).toHaveBeenCalledWith('Đã từ chối hàng loạt câu hỏi đề xuất', 'success')
  })

  it('lưu hàng loạt các câu hợp lệ', async () => {
    await renderPage()
    selectAll()
    fireEvent.click(batchButton(/Lưu vào ngân hàng$/))

    await waitFor(() => expect(documentApi.saveCandidatesAsQuestions).toHaveBeenCalledWith([101]))
    expect(showToast).toHaveBeenCalledWith('Đã lưu hàng loạt câu hỏi vào ngân hàng', 'success')
  })

  it('loại câu trùng mạnh khỏi thao tác lưu hàng loạt', async () => {
    await renderPage({ candidates: [candidate({ strongDuplicate: true, duplicateMaxSimilarity: 0.99 })] })
    selectAll()
    expect(batchButton(/Lưu vào ngân hàng$/)).toBeDisabled()
    expect(batchButton(/Từ chối/)).toBeEnabled()
  })

  it('cảnh báo khi thao tác hàng loạt mà không còn câu phù hợp', async () => {
    await renderPage({ candidates: [candidate({ status: 'SAVED' })] })
    // nút bị khoá nên gọi qua đường lưu một câu để chạm nhánh cảnh báo
    expect(batchButton(/Lưu vào ngân hàng$/)).toBeDisabled()
  })

  it('báo cảnh báo chi tiết khi một phần thao tác hàng loạt lỗi', async () => {
    documentApi.saveCandidatesAsQuestions.mockResolvedValue({
      data: { data: {
        candidates: [candidate({ status: 'SAVED' })],
        succeededCandidateIds: [101],
        failedCount: 1,
        errors: [{ candidateId: 102, message: 'Trùng câu hỏi đã có' }],
      } },
    })
    await renderPage()
    selectAll()
    fireEvent.click(batchButton(/Lưu vào ngân hàng$/))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Câu #102: Trùng câu hỏi đã có'), 'warning', 8000,
    ))
  })

  it('báo lỗi khi thao tác hàng loạt thất bại', async () => {
    documentApi.saveCandidatesAsQuestions.mockRejectedValue({ response: { data: { message: 'Lỗi hàng loạt' } } })
    await renderPage()
    selectAll()
    fireEvent.click(batchButton(/Lưu vào ngân hàng$/))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Lỗi hàng loạt', 'error'))
  })

  it('bỏ qua phản hồi hàng loạt không trả về câu nào', async () => {
    documentApi.saveCandidatesAsQuestions.mockResolvedValue({ data: { data: { candidates: [], succeededCandidateIds: [], failedCount: 0 } } })
    await renderPage()
    selectAll()
    fireEvent.click(batchButton(/Lưu vào ngân hàng$/))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã lưu hàng loạt câu hỏi vào ngân hàng', 'success'))
  })

  it('ẩn thanh thao tác hàng loạt khi bộ lọc không còn câu nào', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Tìm theo nội dung câu hỏi'), { target: { value: 'không khớp' } })
    expect(await screen.findByText('Không có câu hỏi đề xuất phù hợp bộ lọc.')).toBeInTheDocument()
    expect(screen.queryByText(/đã chọn/)).not.toBeInTheDocument()
  })
})

describe('DocumentQuestionJobReviewPage - sửa câu đề xuất', () => {
  const openEdit = async (stem = 'Dấu hiệu nào cần theo dõi sau mổ?') => {
    fireEvent.click(within(cardOf(stem)).getByRole('button', { name: /Sửa/ }))
    await screen.findByRole('dialog', { name: /Sửa câu hỏi đề xuất/i })
  }

  it('nạp sẵn dữ liệu câu hỏi vào biểu mẫu', async () => {
    await renderPage()
    await openEdit()

    expect(screen.getByDisplayValue('Dấu hiệu nào cần theo dõi sau mổ?')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mạch nhanh')).toBeInTheDocument()
    expect(screen.getByLabelText('-- Chọn hoặc gõ tìm danh mục --')).toHaveValue('4')
    expect(screen.getByLabelText('-- Chọn hoặc gõ tìm lĩnh vực --')).toHaveValue('9')
  })

  it('điền giá trị rỗng cho các trường còn thiếu', async () => {
    await renderPage({ candidates: [candidate({ categoryId: null, professionalFieldId: null, cognitiveLevel: null, explanation: null, correctAnswer: null })] })
    await openEdit()

    expect(screen.getByLabelText('-- Chọn hoặc gõ tìm danh mục --')).toHaveValue('')
    expect(screen.getByLabelText('-- Chọn mức độ --')).toHaveValue('')
  })

  it('đổi đáp án đúng bằng nút phân đoạn', async () => {
    await renderPage()
    await openEdit()
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    await waitFor(() => expect(documentApi.updateCandidate).toHaveBeenCalledWith(101, expect.objectContaining({ correctAnswer: 'C' })))
  })

  it('chặn lưu khi thiếu nội dung hoặc phân loại', async () => {
    await renderPage()
    await openEdit()
    fireEvent.change(screen.getByDisplayValue('Dấu hiệu nào cần theo dõi sau mổ?'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    expect(showToast).toHaveBeenCalledWith('Vui lòng nhập đầy đủ câu hỏi và 4 đáp án.', 'warning')
    expect(documentApi.updateCandidate).not.toHaveBeenCalled()
  })

  it('chặn lưu khi chưa chọn mức độ nhận thức', async () => {
    await renderPage()
    await openEdit()
    fireEvent.change(screen.getByLabelText('-- Chọn mức độ --'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    expect(showToast).toHaveBeenCalledWith('Vui lòng nhập đầy đủ câu hỏi và 4 đáp án.', 'warning')
  })

  it('lưu chỉnh sửa rồi đóng hộp thoại', async () => {
    await renderPage()
    await openEdit()
    fireEvent.change(screen.getByDisplayValue('Dấu hiệu nào cần theo dõi sau mổ?'), { target: { value: 'Câu hỏi đã sửa' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    await waitFor(() => expect(documentApi.updateCandidate).toHaveBeenCalledWith(101, expect.objectContaining({ stem: 'Câu hỏi đã sửa' })))
    expect(showToast).toHaveBeenCalledWith('Cập nhật và kiểm tra lại câu hỏi thành công.', 'success')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Sửa câu hỏi đề xuất/i })).not.toBeInTheDocument())
  })

  it('giữ hộp thoại mở khi lưu chỉnh sửa thất bại', async () => {
    documentApi.updateCandidate.mockRejectedValue({ response: { data: { message: 'Nội dung không hợp lệ' } } })
    await renderPage()
    await openEdit()
    fireEvent.click(screen.getByRole('button', { name: /Lưu chỉnh sửa/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Nội dung không hợp lệ', 'error'))
    expect(screen.getByRole('dialog', { name: /Sửa câu hỏi đề xuất/i })).toBeInTheDocument()
  })

  it('đóng hộp thoại bằng nút Hủy và click ra nền', async () => {
    await renderPage()
    await openEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Sửa câu hỏi đề xuất/i })).not.toBeInTheDocument())

    await openEdit()
    fireEvent.click(screen.getByRole('dialog', { name: /Sửa câu hỏi đề xuất/i }).parentElement)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Sửa câu hỏi đề xuất/i })).not.toBeInTheDocument())
  })

  it('không đóng khi bấm vào bên trong hộp thoại', async () => {
    await renderPage()
    await openEdit()
    fireEvent.click(screen.getByRole('dialog', { name: /Sửa câu hỏi đề xuất/i }))
    expect(screen.getByRole('dialog', { name: /Sửa câu hỏi đề xuất/i })).toBeInTheDocument()
  })
})

describe('DocumentQuestionJobReviewPage - đối chiếu câu trùng', () => {
  const duplicateCandidate = candidate({ duplicateMaxSimilarity: 0.95, duplicateNeedsReview: true })

  it('hiện cảnh báo nghi trùng và mở danh sách đối chiếu', async () => {
    documentApi.getPotentialDuplicates.mockResolvedValue({
      data: { data: [{
        sourceType: 'QUESTION_BANK', sourceId: 500, similarity: 0.96, strongDuplicate: false,
        stem: 'Câu trong ngân hàng', optionA: 'A1', optionB: 'B1', correctAnswer: 'A', sourceDocument: 'Tài liệu X',
      }] },
    })
    await renderPage({ candidates: [duplicateCandidate] })

    expect(screen.getByText('Có câu nghi vấn trùng')).toBeInTheDocument()
    expect(screen.getByText('Mức tương đồng cao nhất: 95%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Xem câu có khả năng trùng/ }))
    await waitFor(() => expect(documentApi.getPotentialDuplicates).toHaveBeenCalledWith(101))
    expect(await screen.findByText('Câu trong ngân hàng')).toBeInTheDocument()
    expect(screen.getByText('Ngân hàng #500')).toBeInTheDocument()
    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText('Tài liệu X')).toBeInTheDocument()
  })

  it('gắn nhãn trùng mạnh cho câu vượt ngưỡng', async () => {
    await renderPage({ candidates: [candidate({ duplicateMaxSimilarity: 0.99 })] })
    expect(screen.getByText('Phát hiện câu trùng mạnh')).toBeInTheDocument()
  })

  it('hiện nguồn là câu đề xuất khác và ghi chú thiếu nguồn', async () => {
    documentApi.getPotentialDuplicates.mockResolvedValue({
      data: { data: [{ sourceType: 'CANDIDATE', sourceId: 300, similarity: 0.94, strongDuplicate: true, stem: 'Câu đề xuất khác' }] },
    })
    await renderPage({ candidates: [duplicateCandidate] })
    fireEvent.click(screen.getByRole('button', { name: /Xem câu có khả năng trùng/ }))

    expect(await screen.findByText('Câu đề xuất #300')).toBeInTheDocument()
    expect(screen.getByText('Trùng mạnh')).toBeInTheDocument()
    expect(screen.getByText('Không rõ nguồn')).toBeInTheDocument()
  })

  it('hiện trạng thái đang tìm rồi danh sách rỗng', async () => {
    let resolveDuplicates
    documentApi.getPotentialDuplicates.mockReturnValue(new Promise((resolve) => { resolveDuplicates = resolve }))
    await renderPage({ candidates: [duplicateCandidate] })
    fireEvent.click(screen.getByRole('button', { name: /Xem câu có khả năng trùng/ }))

    expect(await screen.findByText('Đang tìm các câu tương đồng...')).toBeInTheDocument()
    await act(async () => { resolveDuplicates({ data: { data: [] } }) })
    expect(screen.getByText(/Không còn câu nào đạt ngưỡng nghi vấn trùng/)).toBeInTheDocument()
  })

  it('hiện lỗi khi tìm câu trùng thất bại', async () => {
    documentApi.getPotentialDuplicates.mockRejectedValue({ response: { data: { message: 'Dịch vụ embedding lỗi' } } })
    await renderPage({ candidates: [duplicateCandidate] })
    fireEvent.click(screen.getByRole('button', { name: /Xem câu có khả năng trùng/ }))

    expect(await screen.findByText('Dịch vụ embedding lỗi')).toBeInTheDocument()
  })

  it('đóng hộp thoại đối chiếu bằng nút Đóng và click ra nền', async () => {
    await renderPage({ candidates: [duplicateCandidate] })
    const open = async () => {
      fireEvent.click(screen.getByRole('button', { name: /Xem câu có khả năng trùng/ }))
      return screen.findByRole('dialog', { name: /Các câu có khả năng trùng/i })
    }

    await open()
    fireEvent.click(screen.getByLabelText('Đóng danh sách câu có khả năng trùng'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const dialog = await open()
    fireEvent.click(dialog.parentElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('không đóng đối chiếu khi bấm vào bên trong', async () => {
    await renderPage({ candidates: [duplicateCandidate] })
    fireEvent.click(screen.getByRole('button', { name: /Xem câu có khả năng trùng/ }))
    const dialog = await screen.findByRole('dialog', { name: /Các câu có khả năng trùng/i })
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('không hiện cảnh báo trùng khi backend báo không cần xem lại', async () => {
    await renderPage({ candidates: [candidate({ duplicateMaxSimilarity: 0.99, duplicateNeedsReview: false })] })
    expect(screen.queryByText(/nghi vấn trùng/)).not.toBeInTheDocument()
  })
})
