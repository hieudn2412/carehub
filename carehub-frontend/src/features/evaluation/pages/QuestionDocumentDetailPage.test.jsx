import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionDocumentDetailPage from './QuestionDocumentDetailPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const documentApi = vi.hoisted(() => ({
  getDocument: vi.fn(),
  listQuestionJobs: vi.fn(),
  createQuestionJob: vi.fn(),
}))
const categoryApi = vi.hoisted(() => ({ listCategories: vi.fn(), createCategory: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ documentId: '12' }),
}))
vi.mock('../api/documentQuestionApi.js', () => ({ documentQuestionApi: documentApi }))
vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: categoryApi }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/AdminFilterDisclosure.jsx', () => ({
  default: ({ activeCount, children }) => <div data-testid="filter-disclosure" data-active={activeCount}>{children}</div>,
}))
vi.mock('../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset }) => (
    <>
      <button onClick={onApply}>Áp dụng</button>
      <button onClick={onReset}>Xóa bộ lọc</button>
    </>
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
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ value, onChange, options, disabled }) => (
    <select aria-label="Danh mục câu hỏi" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const documentDetail = {
  id: 12,
  filename: 'quy-trinh-vo-khuan.pdf',
  status: 'READY',
  contentType: 'application/pdf',
  pageCount: 30,
  createdAt: '2026-08-20T03:00:00Z',
  updatedAt: '2026-08-21T03:00:00Z',
  errorMessage: null,
  chunks: [
    { id: 1, qualityFlags: [] },
    { id: 2, qualityFlags: ['HEADING_ONLY'] },
    { id: 3, qualityFlags: ['SOMETHING_ELSE'] },
  ],
}

const jobs = [
  {
    id: 71, status: 'COMPLETED', pipelineVersion: 'GROUNDED_V4', promptVersion: 'docgen-v4',
    candidateCount: 18, completedChunkCount: 8, chunkCount: 8, failedChunkCount: 0, createdAt: '2026-08-21T03:00:00Z',
  },
  {
    id: 72, status: 'FAILED', pipelineVersion: null, promptVersion: null,
    candidateCount: 0, completedChunkCount: 2, chunkCount: 8, failedChunkCount: 6, createdAt: '2026-08-22T03:00:00Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  documentApi.getDocument.mockResolvedValue({ data: { data: documentDetail } })
  documentApi.listQuestionJobs.mockResolvedValue({ data: { data: jobs } })
  documentApi.createQuestionJob.mockResolvedValue({ data: { data: { id: 88 } } })
  categoryApi.listCategories.mockResolvedValue({ data: { data: [{ id: 5, name: 'Kiểm soát nhiễm khuẩn' }] } })
  categoryApi.createCategory.mockResolvedValue({ data: { data: { id: 6, name: 'An toàn người bệnh' } } })
})

const renderPage = async () => {
  render(<QuestionDocumentDetailPage />)
  await screen.findByRole('heading', { name: 'quy-trinh-vo-khuan.pdf' })
}
const openJobs = () => fireEvent.click(screen.getByRole('button', { name: 'Phiên tạo câu hỏi' }))
const openJobModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi/ }))
  await screen.findByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })
  await waitFor(() => expect(screen.queryByText('Đang tải danh mục câu hỏi...')).not.toBeInTheDocument())
}
const mixInput = (label) => screen.getByLabelText(new RegExp(`^Tỷ lệ mức ${label}`))

describe('QuestionDocumentDetailPage - tải chi tiết', () => {
  it('tải tài liệu và danh sách phiên rồi hiển thị chỉ số', async () => {
    render(<QuestionDocumentDetailPage />)
    expect(screen.getByText('Đang tải chi tiết tài liệu...')).toBeInTheDocument()

    await screen.findByRole('heading', { name: 'quy-trinh-vo-khuan.pdf' })
    expect(documentApi.getDocument).toHaveBeenCalledWith('12')
    expect(documentApi.listQuestionJobs).toHaveBeenCalledWith('12')
    expect(screen.getAllByText('Sẵn sàng')).toHaveLength(2)
    expect(screen.getAllByText('application/pdf')).toHaveLength(2)
    expect(screen.getByText('30')).toBeInTheDocument()
    // tổng candidateCount của mọi phiên
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('hiện thông báo khi không tìm thấy tài liệu', async () => {
    documentApi.getDocument.mockResolvedValue({ data: { data: null } })
    render(<QuestionDocumentDetailPage />)
    expect(await screen.findByText('Không tìm thấy tài liệu.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải chi tiết thất bại', async () => {
    documentApi.getDocument.mockRejectedValue({ response: { data: { message: 'Tài liệu đã bị xoá' } } })
    render(<QuestionDocumentDetailPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tài liệu đã bị xoá', 'error'))
  })

  it('hiện cảnh báo OCR và khoá nút tạo câu hỏi', async () => {
    documentApi.getDocument.mockResolvedValue({ data: { data: { ...documentDetail, status: 'OCR_REQUIRED' } } })
    await renderPage()

    expect(screen.getByText(/Tài liệu cần OCR trước khi tạo câu hỏi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tạo câu hỏi/ })).toBeDisabled()
  })

  it('hiện thông báo lỗi xử lý của tài liệu', async () => {
    documentApi.getDocument.mockResolvedValue({ data: { data: { ...documentDetail, errorMessage: 'Không đọc được nội dung' } } })
    await renderPage()
    expect(screen.getByText('Không đọc được nội dung')).toBeInTheDocument()
  })

  it('khoá nút tạo câu hỏi khi không còn đoạn nội dung đủ điều kiện', async () => {
    documentApi.getDocument.mockResolvedValue({
      data: { data: { ...documentDetail, chunks: [{ id: 1, qualityFlags: ['DUPLICATE_TEXT'] }] } },
    })
    await renderPage()
    expect(screen.getByRole('button', { name: /Tạo câu hỏi/ })).toBeDisabled()
  })

  it('hiện giá trị mặc định khi thiếu loại tệp', async () => {
    documentApi.getDocument.mockResolvedValue({ data: { data: { ...documentDetail, contentType: null } } })
    await renderPage()
    expect(screen.getByText('Không rõ loại tệp')).toBeInTheDocument()
    expect(screen.getByText('Không rõ')).toBeInTheDocument()
  })
})

describe('QuestionDocumentDetailPage - tab và danh sách phiên', () => {
  it('mặc định mở tab tổng quan với các dòng thông tin', async () => {
    await renderPage()
    expect(screen.getByText('Tên tài liệu')).toBeInTheDocument()
    expect(screen.getByText('Ngày cập nhật')).toBeInTheDocument()
    expect(screen.queryByText('Pipeline / prompt')).not.toBeInTheDocument()
  })

  it('chuyển sang tab phiên và hiển thị đầy đủ cột', async () => {
    await renderPage()
    openJobs()

    expect(screen.getByText('#71')).toBeInTheDocument()
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument()
    expect(screen.getByText('GROUNDED_V4')).toBeInTheDocument()
    expect(screen.getByText('docgen-v4')).toBeInTheDocument()
    // thiếu pipeline/prompt thì rơi về giá trị mặc định
    expect(screen.getByText('LEGACY_V3')).toBeInTheDocument()
    expect(screen.getByText('---')).toBeInTheDocument()
    expect(screen.getByText('Lỗi 6')).toBeInTheDocument()
  })

  it('không hiện huy hiệu lỗi khi phiên không có đoạn lỗi', async () => {
    documentApi.listQuestionJobs.mockResolvedValue({ data: { data: [jobs[0]] } })
    await renderPage()
    openJobs()
    expect(screen.queryByText(/^Lỗi /)).not.toBeInTheDocument()
  })

  it('lọc phiên theo trạng thái và xoá bộ lọc', async () => {
    await renderPage()
    openJobs()

    fireEvent.change(screen.getByLabelText('Trạng thái phiên'), { target: { value: 'FAILED' } })
    await waitFor(() => expect(screen.queryByText('#71')).not.toBeInTheDocument())
    expect(screen.getByText('#72')).toBeInTheDocument()
    expect(screen.getByTestId('filter-disclosure')).toHaveAttribute('data-active', '1')

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByText('#72')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(await screen.findByText('#71')).toBeInTheDocument()
    expect(screen.getByTestId('filter-disclosure')).toHaveAttribute('data-active', '0')
  })

  it('hiện thông báo rỗng khi không có phiên phù hợp', async () => {
    documentApi.listQuestionJobs.mockResolvedValue({ data: { data: [] } })
    await renderPage()
    openJobs()
    expect(screen.getByText('Không có phiên tạo câu hỏi phù hợp.')).toBeInTheDocument()
  })

  it('mở trang duyệt câu hỏi của phiên', async () => {
    await renderPage()
    openJobs()
    fireEvent.click(screen.getAllByTitle('Mở review')[0])
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/document-question-jobs/71')
  })
})

describe('QuestionDocumentDetailPage - tạo phiên sinh câu hỏi', () => {
  it('mở hộp thoại, nạp danh mục và thống kê đoạn nội dung', async () => {
    await renderPage()
    await openJobModal()

    expect(categoryApi.listCategories).toHaveBeenCalledWith({ status: 'ACTIVE' })
    const dialog = screen.getByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })
    expect(within(dialog).getByText('Tổng đoạn nội dung')).toBeInTheDocument()
    // 3 đoạn, 1 bị chặn bởi HEADING_ONLY -> 2 đủ điều kiện, 1 bỏ qua
    expect(within(dialog).getByText('Đủ điều kiện').nextSibling).toHaveTextContent('2')
    expect(within(dialog).getByText('Bỏ qua').nextSibling).toHaveTextContent('1')
    expect(screen.getByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
  })

  it('báo lỗi khi nạp danh mục thất bại nhưng vẫn mở hộp thoại', async () => {
    categoryApi.listCategories.mockRejectedValue({ response: { data: { message: 'Không tải được danh mục' } } })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tải được danh mục', 'error'))
    expect(screen.getByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).toBeInTheDocument()
  })

  it('hiển thị tỷ lệ mức nhận thức mặc định cộng đúng 100%', async () => {
    await renderPage()
    await openJobModal()

    expect(mixInput('Dễ')).toHaveValue(20)
    expect(mixInput('Trung bình')).toHaveValue(50)
    expect(mixInput('Khó')).toHaveValue(30)
    expect(screen.getByText(/Tổng: 100%/)).toBeInTheDocument()
  })

  it('kẹp tỷ lệ trong khoảng 0-100 và cảnh báo khi tổng khác 100', async () => {
    await renderPage()
    await openJobModal()

    fireEvent.change(mixInput('Dễ'), { target: { value: '150' } })
    expect(mixInput('Dễ')).toHaveValue(100)

    fireEvent.change(mixInput('Dễ'), { target: { value: '-20' } })
    expect(mixInput('Dễ')).toHaveValue(0)
    expect(screen.getByText(/— phải bằng 100%/)).toBeInTheDocument()

    fireEvent.change(mixInput('Dễ'), { target: { value: 'abc' } })
    expect(mixInput('Dễ')).toHaveValue(0)
  })

  it('bôi đen sẵn nội dung ô tỷ lệ khi được focus', async () => {
    await renderPage()
    await openJobModal()
    const select = vi.spyOn(mixInput('Dễ'), 'select')
    fireEvent.focus(mixInput('Dễ'))
    expect(select).toHaveBeenCalled()
  })

  it('chặn tạo phiên khi tổng tỷ lệ khác 100%', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.change(mixInput('Dễ'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    expect(showToast).toHaveBeenCalledWith('Tổng tỷ lệ ba mức nhận thức phải bằng 100%.', 'warning')
    expect(documentApi.createQuestionJob).not.toHaveBeenCalled()
  })

  it('chặn số câu mỗi đoạn ngoài khoảng 1-3', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    expect(showToast).toHaveBeenCalledWith('Số câu mỗi đoạn nội dung chỉ được từ 1 đến 3.', 'warning')
    expect(documentApi.createQuestionJob).not.toHaveBeenCalled()
  })

  it('tạo phiên thành công rồi chuyển sang trang duyệt', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '2' } })
    await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi').querySelector('option[value="5"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    await waitFor(() => expect(documentApi.createQuestionJob).toHaveBeenCalledWith(12, {
      questionsPerChunk: 2,
      categoryId: 5,
      pipelineVersion: 'GROUNDED_V4',
      targetCognitiveLevel: 'AUTO',
      cognitiveMixFoundation: 20,
      cognitiveMixApplication: 50,
      cognitiveMixReasoning: 30,
    }))
    expect(showToast).toHaveBeenCalledWith('Tạo phiên sinh câu hỏi thành công.', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/document-question-jobs/88')
  })

  it('gửi categoryId null khi không chọn danh mục', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    await waitFor(() => expect(documentApi.createQuestionJob)
      .toHaveBeenCalledWith(12, expect.objectContaining({ categoryId: null })))
  })

  it('báo lỗi và giữ hộp thoại khi tạo phiên thất bại', async () => {
    documentApi.createQuestionJob.mockRejectedValue({ response: { data: { message: 'Đã có phiên đang chạy' } } })
    await renderPage()
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã có phiên đang chạy', 'error'))
    expect(screen.getByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('khoá thao tác và không cho đóng khi đang tạo phiên', async () => {
    let resolveJob
    documentApi.createQuestionJob.mockReturnValue(new Promise((resolve) => { resolveJob = resolve }))
    await renderPage()
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    expect(await screen.findByText('Đang tạo câu hỏi từ tài liệu...')).toBeInTheDocument()
    expect(mixInput('Dễ')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.getByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).toBeInTheDocument()

    await act(async () => { resolveJob({ data: { data: { id: 1 } } }) })
  })

  it('đóng hộp thoại bằng nút Hủy', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).not.toBeInTheDocument()
  })
})

describe('QuestionDocumentDetailPage - thêm nhanh danh mục', () => {
  const openCategoryModal = async () => {
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: /Thêm mới/ }))
    await screen.findByText('Thêm danh mục câu hỏi')
  }

  it('bắt buộc nhập tên danh mục', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tên danh mục không được để trống.', 'warning'))
    expect(categoryApi.createCategory).not.toHaveBeenCalled()
  })

  it('tạo danh mục, chọn sẵn và đóng hộp thoại phụ', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Kiểm soát nhiễm khuẩn'), { target: { value: '  An toàn người bệnh  ' } })
    fireEvent.change(screen.getByPlaceholderText('Tự sinh nếu bỏ trống'), { target: { value: ' ATNB ' } })
    fireEvent.change(screen.getByPlaceholderText('Mô tả ngắn về chủ đề câu hỏi'), { target: { value: ' Mô tả ' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(categoryApi.createCategory).toHaveBeenCalledWith({
      name: 'An toàn người bệnh', code: 'ATNB', description: 'Mô tả', status: 'ACTIVE',
    }))
    expect(showToast).toHaveBeenCalledWith('Đã thêm danh mục câu hỏi.', 'success')
    await waitFor(() => expect(screen.queryByText('Thêm danh mục câu hỏi')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('6')
  })

  it('gửi null cho mã và mô tả khi bỏ trống', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Kiểm soát nhiễm khuẩn'), { target: { value: 'Chỉ có tên' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(categoryApi.createCategory)
      .toHaveBeenCalledWith(expect.objectContaining({ code: null, description: null })))
  })

  it('không chọn danh mục mới khi máy chủ trả về rỗng', async () => {
    categoryApi.createCategory.mockResolvedValue({ data: { data: null } })
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Kiểm soát nhiễm khuẩn'), { target: { value: 'Không id' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã thêm danh mục câu hỏi.', 'success'))
    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('')
  })

  it('giữ hộp thoại mở khi tạo danh mục thất bại', async () => {
    categoryApi.createCategory.mockRejectedValue({ response: { data: { message: 'Tên đã tồn tại' } } })
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Kiểm soát nhiễm khuẩn'), { target: { value: 'Trùng' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tên đã tồn tại', 'error'))
    expect(screen.getByText('Thêm danh mục câu hỏi')).toBeInTheDocument()
  })

  it('đóng hộp thoại danh mục bằng nút X và nút Hủy', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.click(screen.getByLabelText('Đóng'))
    await waitFor(() => expect(screen.queryByText('Thêm danh mục câu hỏi')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Thêm mới/ }))
    await screen.findByText('Thêm danh mục câu hỏi')
    fireEvent.click(screen.getAllByRole('button', { name: 'Hủy' })[1])
    await waitFor(() => expect(screen.queryByText('Thêm danh mục câu hỏi')).not.toBeInTheDocument())
  })
})
