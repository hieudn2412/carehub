import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionDocumentListPage from './QuestionDocumentListPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const documentApi = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  createQuestionJob: vi.fn(),
}))
const categoryApi = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/documentQuestionApi.js', () => ({ documentQuestionApi: documentApi }))
vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: categoryApi }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmDialog.jsx', () => ({
  default: ({ title, message, confirmLabel, cancelLabel, confirming, onConfirm, onCancel }) => (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>{cancelLabel || 'Hủy'}</button>
      <button disabled={confirming} onClick={onConfirm}>{confirmLabel}</button>
    </div>
  ),
}))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ value, onChange, options, disabled }) => (
    <select aria-label="Danh mục câu hỏi" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const readyDoc = {
  id: 1,
  filename: 'quy-trinh-tiem-truyen.pdf',
  status: 'READY',
  pageCount: 24,
  chunkCount: 8,
  createdAt: '2026-08-20T03:00:00Z',
  latestQuestionJob: null,
}
const ocrDoc = {
  id: 2,
  filename: 'ban-scan.pdf',
  status: 'OCR_REQUIRED',
  pageCount: null,
  chunkCount: 0,
  createdAt: '2026-08-19T03:00:00Z',
  latestQuestionJob: null,
}
const docWithJob = {
  id: 3,
  filename: 'cham-soc-vet-thuong.docx',
  status: 'READY',
  pageCount: 10,
  chunkCount: 5,
  createdAt: '2026-08-18T03:00:00Z',
  latestQuestionJob: { id: 90, candidateCount: 12, status: 'COMPLETED' },
}

const listResponse = (content) => ({ data: { data: { content } } })
const makeFile = (name) => new File(['noi dung'], name, { type: 'application/pdf' })

const selectFile = (name) => {
  const input = document.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [makeFile(name)] } })
  return input
}

beforeEach(() => {
  vi.clearAllMocks()
  documentApi.listDocuments.mockResolvedValue(listResponse([readyDoc, ocrDoc, docWithJob]))
  documentApi.uploadDocument.mockResolvedValue({ data: { data: { id: 9, status: 'READY' } } })
  documentApi.deleteDocument.mockResolvedValue({ data: { success: true } })
  documentApi.createQuestionJob.mockResolvedValue({ data: { data: { id: 77 } } })
  categoryApi.listCategories.mockResolvedValue({ data: { data: [{ id: 5, name: 'Kiểm soát nhiễm khuẩn' }] } })
  categoryApi.createCategory.mockResolvedValue({ data: { data: { id: 6, name: 'An toàn người bệnh' } } })
})

const renderPage = async () => {
  render(<QuestionDocumentListPage />)
  await screen.findByText('quy-trinh-tiem-truyen.pdf')
}

const openJobModal = async (docName = 'quy-trinh-tiem-truyen.pdf') => {
  fireEvent.click(screen.getByLabelText(`Tạo phiên câu hỏi từ ${docName}`))
  await screen.findByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })
}

describe('QuestionDocumentListPage - danh sách tài liệu', () => {
  it('tải và hiển thị tài liệu kèm trạng thái, số trang, số câu đã sinh', async () => {
    render(<QuestionDocumentListPage />)
    expect(screen.getByText('Đang tải danh sách tài liệu...')).toBeInTheDocument()

    await screen.findByText('quy-trinh-tiem-truyen.pdf')
    expect(documentApi.listDocuments).toHaveBeenCalledWith({ page: 0, size: 100, sort: 'createdAt,desc' })
    expect(screen.getAllByText('Sẵn sàng')).toHaveLength(2)
    expect(screen.getByText('Cần OCR')).toBeInTheDocument()
    expect(screen.getByText('Tài liệu cần OCR trước khi tạo câu hỏi.')).toBeInTheDocument()
    expect(screen.getByText('12 câu')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa tạo')).toHaveLength(2)
    expect(screen.getByText('001')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 3 trong tổng số 3 tài liệu')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có tài liệu nào', async () => {
    documentApi.listDocuments.mockResolvedValue(listResponse([]))
    render(<QuestionDocumentListPage />)
    expect(await screen.findByText(/Chưa có tài liệu nào/)).toBeInTheDocument()
  })

  it('chịu được payload thiếu trường content', async () => {
    documentApi.listDocuments.mockResolvedValue({ data: { data: {} } })
    render(<QuestionDocumentListPage />)
    expect(await screen.findByText(/Chưa có tài liệu nào/)).toBeInTheDocument()
  })

  it('báo lỗi qua toast khi tải danh sách thất bại', async () => {
    documentApi.listDocuments.mockRejectedValue({ response: { data: { message: 'Hết phiên đăng nhập' } } })
    render(<QuestionDocumentListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Hết phiên đăng nhập', 'error'))
  })

  it('chỉ hiện nút duyệt câu hỏi khi phiên gần nhất đã có ứng viên', async () => {
    await renderPage()
    expect(screen.getByLabelText('Duyệt câu hỏi từ cham-soc-vet-thuong.docx')).toBeInTheDocument()
    expect(screen.queryByLabelText('Duyệt câu hỏi từ quy-trinh-tiem-truyen.pdf')).not.toBeInTheDocument()
  })

  it('chỉ cho xoá tài liệu chưa từng sinh câu hỏi', async () => {
    await renderPage()
    expect(screen.getByLabelText('Xóa tài liệu quy-trinh-tiem-truyen.pdf')).toBeInTheDocument()
    expect(screen.queryByLabelText('Xóa tài liệu cham-soc-vet-thuong.docx')).not.toBeInTheDocument()
  })

  it('khoá nút tạo phiên khi tài liệu chưa READY hoặc chưa có đoạn nội dung', async () => {
    await renderPage()
    expect(screen.getByLabelText('Tạo phiên câu hỏi từ quy-trinh-tiem-truyen.pdf')).toBeEnabled()
    expect(screen.getByLabelText('Tạo phiên câu hỏi từ ban-scan.pdf')).toBeDisabled()
  })

  it('hiện huy hiệu trạng thái riêng cho phiên đang chạy và phiên thất bại', async () => {
    documentApi.listDocuments.mockResolvedValue(listResponse([
      { ...docWithJob, id: 4, filename: 'dang-chay.pdf', latestQuestionJob: { id: 91, candidateCount: 3, status: 'GENERATING' } },
      { ...docWithJob, id: 5, filename: 'that-bai.pdf', latestQuestionJob: { id: 92, candidateCount: 1, status: 'FAILED' } },
    ]))
    render(<QuestionDocumentListPage />)
    await screen.findByText('dang-chay.pdf')
    expect(screen.getByText('Đang tạo')).toBeInTheDocument()
    expect(screen.getByText('Thất bại')).toBeInTheDocument()
  })

  it('điều hướng tới trang chi tiết tài liệu và trang duyệt câu hỏi', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'quy-trinh-tiem-truyen.pdf' }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/question-documents/1')

    fireEvent.click(screen.getByRole('button', { name: /12 câu/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/document-question-jobs/90')

    fireEvent.click(screen.getByLabelText('Duyệt câu hỏi từ cham-soc-vet-thuong.docx'))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/document-question-jobs/90')
  })
})

describe('QuestionDocumentListPage - tìm kiếm và phân trang', () => {
  it('lọc theo tên tài liệu không phân biệt hoa thường và dấu', async () => {
    await renderPage()
    const search = screen.getByPlaceholderText('Tìm theo tên tài liệu...')

    fireEvent.change(search, { target: { value: 'BAN-SCAN' } })
    await waitFor(() => expect(screen.queryByText('quy-trinh-tiem-truyen.pdf')).not.toBeInTheDocument())
    expect(screen.getByText('ban-scan.pdf')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'không tồn tại' } })
    expect(await screen.findByText(/Chưa có tài liệu nào/)).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    expect(await screen.findByText('quy-trinh-tiem-truyen.pdf')).toBeInTheDocument()
  })

  it('phân trang 10 tài liệu mỗi trang', async () => {
    const many = Array.from({ length: 23 }, (_, index) => ({
      ...readyDoc, id: index + 1, filename: `tai-lieu-${index + 1}.pdf`,
    }))
    documentApi.listDocuments.mockResolvedValue(listResponse(many))
    render(<QuestionDocumentListPage />)
    await screen.findByText('tai-lieu-1.pdf')

    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '<' })).toBeDisabled()
    expect(screen.queryByText('tai-lieu-11.pdf')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '>' }))
    expect(await screen.findByText('tai-lieu-11.pdf')).toBeInTheDocument()
    expect(screen.getByText('011')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '>' }))
    expect(await screen.findByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '>' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '<' }))
    expect(await screen.findByText('2 / 3')).toBeInTheDocument()
  })

  it('quay về trang đầu khi đổi từ khoá tìm kiếm', async () => {
    const many = Array.from({ length: 23 }, (_, index) => ({
      ...readyDoc, id: index + 1, filename: `tai-lieu-${index + 1}.pdf`,
    }))
    documentApi.listDocuments.mockResolvedValue(listResponse(many))
    render(<QuestionDocumentListPage />)
    await screen.findByText('tai-lieu-1.pdf')
    fireEvent.click(screen.getByRole('button', { name: '>' }))
    expect(await screen.findByText('2 / 3')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên tài liệu...'), { target: { value: 'tai-lieu' } })
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
  })
})

describe('QuestionDocumentListPage - tải tài liệu lên', () => {
  it('từ chối phần mở rộng không hỗ trợ và không giữ tệp', async () => {
    await renderPage()
    const input = selectFile('bang-luong.xlsx')

    expect(showToast).toHaveBeenCalledWith('Chỉ hỗ trợ PDF, DOCX, TXT hoặc MD.', 'warning')
    expect(input.value).toBe('')
    expect(screen.queryByText('bang-luong.xlsx')).not.toBeInTheDocument()
  })

  it('bỏ qua khi hộp thoại chọn tệp bị huỷ', async () => {
    await renderPage()
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [] } })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('cảnh báo khi bấm tải lên mà chưa chọn tệp', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tải lên/ }))
    expect(showToast).toHaveBeenCalledWith('Vui lòng chọn tệp tài liệu trước khi tải lên.', 'warning')
    expect(documentApi.uploadDocument).not.toHaveBeenCalled()
  })

  it('tải lên thành công rồi làm mới danh sách và xoá tệp đã chọn', async () => {
    await renderPage()
    selectFile('tai-lieu-moi.docx')
    expect(await screen.findByText('tai-lieu-moi.docx')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Tải lên/ }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tải tài liệu thành công.', 'success'))
    expect(documentApi.uploadDocument).toHaveBeenCalledWith(expect.any(File))
    expect(documentApi.listDocuments).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('tai-lieu-moi.docx')).not.toBeInTheDocument()
  })

  it('cảnh báo riêng khi máy chủ trả về tài liệu cần OCR', async () => {
    documentApi.uploadDocument.mockResolvedValue({ data: { data: { id: 9, status: 'OCR_REQUIRED' } } })
    await renderPage()
    selectFile('scan.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Tải lên/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tài liệu cần OCR trước khi tạo câu hỏi.', 'warning'))
  })

  it('báo lỗi và giữ nguyên tệp khi tải lên thất bại', async () => {
    documentApi.uploadDocument.mockRejectedValue({ response: { data: { message: 'Tệp vượt quá 20MB' } } })
    await renderPage()
    selectFile('qua-lon.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Tải lên/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tệp vượt quá 20MB', 'error'))
    expect(screen.getByText('qua-lon.pdf')).toBeInTheDocument()
  })

  it('khoá thao tác trong lúc đang tải lên', async () => {
    let resolveUpload
    documentApi.uploadDocument.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve }))
    await renderPage()
    selectFile('cho-tai.pdf')
    fireEvent.click(screen.getByRole('button', { name: /Tải lên/ }))

    expect(await screen.findByText('Đang tải và phân tích tài liệu...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bỏ chọn/ })).toBeDisabled()
    await act(async () => { resolveUpload({ data: { data: { status: 'READY' } } }) })
  })

  it('bỏ chọn tệp và dọn sạch ô input', async () => {
    await renderPage()
    const input = selectFile('bo-chon.pdf')
    expect(await screen.findByText('bo-chon.pdf')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bỏ chọn/ }))
    await waitFor(() => expect(screen.queryByText('bo-chon.pdf')).not.toBeInTheDocument())
    expect(input.value).toBe('')
  })
})

describe('QuestionDocumentListPage - xoá tài liệu', () => {
  it('xoá khỏi danh sách sau khi xác nhận', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa tài liệu quy-trinh-tiem-truyen.pdf'))

    const dialog = screen.getByRole('dialog', { name: 'Xóa tài liệu' })
    expect(within(dialog).getByText(/"quy-trinh-tiem-truyen.pdf"/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa tài liệu' }))

    await waitFor(() => expect(documentApi.deleteDocument).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã xóa tài liệu.', 'success')
    await waitFor(() => expect(screen.queryByText('quy-trinh-tiem-truyen.pdf')).not.toBeInTheDocument())
  })

  it('đóng hộp thoại mà không gọi API khi bấm Hủy', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa tài liệu quy-trinh-tiem-truyen.pdf'))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Xóa tài liệu' })).getByRole('button', { name: 'Hủy' }))

    expect(screen.queryByRole('dialog', { name: 'Xóa tài liệu' })).not.toBeInTheDocument()
    expect(documentApi.deleteDocument).not.toHaveBeenCalled()
  })

  it('giữ tài liệu lại và báo lỗi khi máy chủ từ chối xoá', async () => {
    documentApi.deleteDocument.mockRejectedValue({ response: { data: { message: 'Tài liệu đang được sử dụng' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xóa tài liệu quy-trinh-tiem-truyen.pdf'))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Xóa tài liệu' })).getByRole('button', { name: 'Xóa tài liệu' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tài liệu đang được sử dụng', 'error'))
    expect(screen.getByRole('button', { name: 'quy-trinh-tiem-truyen.pdf' })).toBeInTheDocument()
  })
})

describe('QuestionDocumentListPage - tạo phiên sinh câu hỏi', () => {
  it('mở hộp thoại và nạp danh mục đang hoạt động', async () => {
    await renderPage()
    await openJobModal()

    expect(categoryApi.listCategories).toHaveBeenCalledWith({ status: 'ACTIVE' })
    expect(await screen.findByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    expect(screen.getAllByText('quy-trinh-tiem-truyen.pdf').length).toBeGreaterThan(1)
  })

  it('vẫn mở được hộp thoại khi nạp danh mục thất bại', async () => {
    categoryApi.listCategories.mockRejectedValue(new Error('down'))
    await renderPage()
    await openJobModal()

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    expect(screen.getByRole('option', { name: '-- Chọn danh mục --' })).toBeInTheDocument()
  })

  it('bỏ qua payload danh mục không phải mảng', async () => {
    categoryApi.listCategories.mockResolvedValue({ data: { data: { content: [] } } })
    await renderPage()
    await openJobModal()
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
  })

  it('bắt buộc chọn danh mục trước khi tạo phiên', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    expect(showToast).toHaveBeenCalledWith('Vui lòng chọn danh mục câu hỏi.', 'warning')
    expect(documentApi.createQuestionJob).not.toHaveBeenCalled()
  })

  it('chặn số câu mỗi đoạn ngoài khoảng 1-3', async () => {
    await renderPage()
    await openJobModal()
    expect(await screen.findByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi').querySelector('option[value="5"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '5' } })

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))
    expect(showToast).toHaveBeenCalledWith('Số câu mỗi đoạn nội dung chỉ được từ 1 đến 3.', 'warning')

    showToast.mockClear()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))
    // 0 rơi về mặc định 1 nên hợp lệ và được gửi đi
    await waitFor(() => expect(documentApi.createQuestionJob).toHaveBeenCalledWith(1, expect.objectContaining({ questionsPerChunk: 1 })))
  })

  it('tạo phiên thành công rồi chuyển sang trang duyệt', async () => {
    await renderPage()
    await openJobModal()
    expect(await screen.findByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi').querySelector('option[value="5"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '5' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    await waitFor(() => expect(documentApi.createQuestionJob).toHaveBeenCalledWith(1, {
      questionsPerChunk: 3,
      categoryId: 5,
      pipelineVersion: 'GROUNDED_V4',
    }))
    expect(showToast).toHaveBeenCalledWith('Tạo phiên sinh câu hỏi thành công.', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/document-question-jobs/77')
  })

  it('giữ hộp thoại mở khi máy chủ từ chối tạo phiên', async () => {
    documentApi.createQuestionJob.mockRejectedValue({ response: { data: { message: 'Đã có phiên đang chạy' } } })
    await renderPage()
    await openJobModal()
    expect(await screen.findByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi').querySelector('option[value="5"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã có phiên đang chạy', 'error'))
    expect(screen.getByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('khoá toàn bộ thao tác trong lúc đang tạo phiên', async () => {
    let resolveJob
    documentApi.createQuestionJob.mockReturnValue(new Promise((resolve) => { resolveJob = resolve }))
    await renderPage()
    await openJobModal()
    expect(await screen.findByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi').querySelector('option[value="5"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo phiên$/ }))

    expect(await screen.findByText('Đang tạo câu hỏi từ tài liệu...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
    expect(screen.getByLabelText('Đóng')).toBeDisabled()
    expect(screen.getByRole('spinbutton')).toBeDisabled()
    await act(async () => { resolveJob({ data: { data: { id: 1 } } }) })
  })

  it('đóng hộp thoại bằng nút X và nút Hủy', async () => {
    await renderPage()
    await openJobModal()
    fireEvent.click(screen.getByLabelText('Đóng'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).not.toBeInTheDocument())

    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Tạo phiên sinh câu hỏi/i })).not.toBeInTheDocument())
  })
})

describe('QuestionDocumentListPage - thêm nhanh danh mục', () => {
  const openCategoryModal = async () => {
    await openJobModal()
    fireEvent.click(screen.getByRole('button', { name: /Thêm mới/ }))
    await screen.findByText('Thêm danh mục câu hỏi')
  }

  it('bắt buộc nhập tên danh mục', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Vui lòng nhập tên danh mục.', 'warning'))
    expect(categoryApi.createCategory).not.toHaveBeenCalled()
  })

  it('tạo danh mục, chọn sẵn nó và đóng hộp thoại', async () => {
    await renderPage()
    await openCategoryModal()

    const nameInput = screen.getByLabelText(/Tên danh mục/)
    const codeInput = screen.getByLabelText(/Mã danh mục/)
    fireEvent.change(nameInput, { target: { value: '  An toàn người bệnh  ' } })
    fireEvent.change(codeInput, { target: { value: '  ATNB  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(categoryApi.createCategory).toHaveBeenCalledWith(expect.objectContaining({
      name: 'An toàn người bệnh',
      code: 'ATNB',
      status: 'ACTIVE',
    })))
    expect(showToast).toHaveBeenCalledWith('Đã thêm danh mục câu hỏi.', 'success')
    await waitFor(() => expect(screen.queryByText('Thêm danh mục câu hỏi')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('6')
  })

  it('gửi null cho mã và mô tả khi bỏ trống', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByLabelText(/Tên danh mục/), { target: { value: 'Chỉ có tên' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(categoryApi.createCategory).toHaveBeenCalledWith({
      name: 'Chỉ có tên', code: null, description: null, status: 'ACTIVE',
    }))
  })

  it('không chọn danh mục mới khi máy chủ không trả về id', async () => {
    categoryApi.createCategory.mockResolvedValue({ data: { data: null } })
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByLabelText(/Tên danh mục/), { target: { value: 'Không id' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã thêm danh mục câu hỏi.', 'success'))
    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('')
  })

  it('giữ hộp thoại mở và báo lỗi khi tạo danh mục thất bại', async () => {
    categoryApi.createCategory.mockRejectedValue({ response: { data: { message: 'Tên danh mục đã tồn tại' } } })
    await renderPage()
    await openCategoryModal()
    fireEvent.change(screen.getByLabelText(/Tên danh mục/), { target: { value: 'Trùng tên' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục$/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tên danh mục đã tồn tại', 'error'))
    expect(screen.getByText('Thêm danh mục câu hỏi')).toBeInTheDocument()
  })

  it('đóng hộp thoại danh mục bằng nút X và nút Hủy', async () => {
    await renderPage()
    await openCategoryModal()
    fireEvent.click(screen.getAllByLabelText('Đóng')[1])
    await waitFor(() => expect(screen.queryByText('Thêm danh mục câu hỏi')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Thêm mới/ }))
    await screen.findByText('Thêm danh mục câu hỏi')
    fireEvent.click(screen.getAllByRole('button', { name: 'Hủy' })[1])
    await waitFor(() => expect(screen.queryByText('Thêm danh mục câu hỏi')).not.toBeInTheDocument())
  })
})
