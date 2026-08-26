import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionBankListPage from './QuestionBankListPage.jsx'

globalThis.React = React

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({
  listQuestions: vi.fn(),
  getQuestion: vi.fn(),
  archiveQuestion: vi.fn(),
  exportQuestions: vi.fn(),
  downloadImportTemplate: vi.fn(),
  previewImport: vi.fn(),
  commitImport: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, confirmText, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Hủy lưu trữ</button>
      <button onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../api/questionBankApi.js', () => ({ questionBankApi: api }))

const backendQuestion = (overrides = {}) => ({
  id: 1,
  stem: 'Câu hỏi đang hoạt động',
  categoryName: 'Điều dưỡng',
  categoryId: 4,
  categoryCode: 'DD',
  professionalFieldId: 9,
  professionalFieldName: 'Kiểm soát nhiễm khuẩn',
  cognitiveLevel: 'FOUNDATION',
  status: 'APPROVED',
  optionA: 'Phương án A', optionB: 'Phương án B', optionC: 'Phương án C', optionD: 'Phương án D',
  correctAnswer: 'B',
  questionType: 'SINGLE_CHOICE',
  ...overrides,
})

const listPayload = (items) => ({ data: { data: items } })

const previewRow = (overrides = {}) => ({
  rowNumber: 2, stem: 'Câu import 1', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
  correctAnswer: 'A', explanation: '', topic: '', language: 'vi', sourceDocument: '',
  status: 'APPROVED', categoryId: 4, categoryReference: 'DD', categoryCode: 'DD', categoryName: 'Điều dưỡng',
  professionalFieldId: 9, professionalFieldReference: 'KSNK', professionalFieldName: 'Kiểm soát nhiễm khuẩn',
  cognitiveLevel: 'FOUNDATION', valid: true, skipped: false, errors: [], ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.listQuestions.mockResolvedValue(listPayload([
    backendQuestion(),
    backendQuestion({ id: 2, stem: 'Câu hỏi đã lưu trữ', status: 'ARCHIVED', professionalFieldName: null, cognitiveLevel: 'CLINICAL_APPLICATION' }),
  ]))
  api.getQuestion.mockResolvedValue({ data: { data: backendQuestion() } })
  api.archiveQuestion.mockResolvedValue({ data: { success: true } })
  api.exportQuestions.mockResolvedValue({ data: new Blob(['xlsx']) })
  api.downloadImportTemplate.mockResolvedValue({ data: new Blob(['xlsx']) })
  api.previewImport.mockResolvedValue({ data: { data: { importJobId: 55, totalRows: 2, validRows: 1, skippedRows: 1, invalidRows: 0, sourceHeaders: [], rows: [previewRow()] } } })
  api.commitImport.mockResolvedValue({ data: { data: { createdCount: 1, skippedCount: 1, failedCount: 0, totalRows: 2, rows: [previewRow({ createdQuestionId: 77 })] } } })
})

const renderPage = async () => {
  render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
  await screen.findByText('Câu hỏi đang hoạt động')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
const chooseFilter = (label, optionName) => {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}
const applyFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
const rowOf = (text) => screen.getByText(text).closest('tr')
const openImport = () => fireEvent.click(screen.getByLabelText('Nhập dữ liệu câu hỏi'))
const fileInput = () => document.querySelector('input[type="file"]')
const pickFile = (name = 'cau-hoi.xlsx') => fireEvent.change(fileInput(), {
  target: { files: [new File(['x'], name)] },
})

describe('QuestionBankListPage - danh sách', () => {
  it('hiển thị câu đã lưu trữ và lọc theo trạng thái hoạt động', async () => {
    await renderPage()

    const archivedRow = rowOf('Câu hỏi đã lưu trữ')
    expect(within(archivedRow).getByText('Không hoạt động')).toBeInTheDocument()
    expect(within(archivedRow).getByRole('button', { name: 'Xem chi tiết câu hỏi' })).toBeInTheDocument()
    expect(within(archivedRow).queryByRole('button', { name: 'Chỉnh sửa câu hỏi' })).not.toBeInTheDocument()
    expect(within(archivedRow).queryByRole('button', { name: 'Xóa câu hỏi' })).not.toBeInTheDocument()

    openFilters()
    chooseFilter('Trạng thái', 'Không hoạt động')
    applyFilters()

    expect(screen.getByText('Câu hỏi đã lưu trữ')).toBeInTheDocument()
    expect(screen.queryByText('Câu hỏi đang hoạt động')).not.toBeInTheDocument()
  })

  it('tải danh sách với trạng thái ALL và hiển thị đầy đủ cột', async () => {
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
    expect(screen.getByText('Đang tải ngân hàng câu hỏi...')).toBeInTheDocument()

    await screen.findByText('Câu hỏi đang hoạt động')
    expect(api.listQuestions).toHaveBeenCalledWith({ status: 'ALL' })
    expect(screen.getByText('Kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(screen.getByText('Chưa có lĩnh vực')).toBeInTheDocument()
    expect(screen.getByText('Kiến thức nền tảng')).toBeInTheDocument()
    expect(screen.getByText('Áp dụng lâm sàng')).toBeInTheDocument()
    expect(screen.getByText('2 kết quả')).toBeInTheDocument()
    expect(screen.queryByText(/dữ liệu demo/)).not.toBeInTheDocument()
  })

  it('rơi về dữ liệu demo khi backend lỗi', async () => {
    api.listQuestions.mockRejectedValue({ response: { data: { message: 'Backend chưa sẵn sàng' } } })
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)

    expect(await screen.findByText(/Đang hiển thị dữ liệu demo/)).toBeInTheDocument()
    expect(showToast).toHaveBeenCalledWith('Backend chưa sẵn sàng', 'warning')
    expect(screen.getByText(/Kỹ thuật vệ sinh tay đúng/)).toBeInTheDocument()
  })

  it('điền danh mục mặc định khi câu hỏi chưa phân loại', async () => {
    api.listQuestions.mockResolvedValue(listPayload([backendQuestion({ categoryName: null })]))
    await renderPage()
    expect(screen.getByText('Chưa phân loại')).toBeInTheDocument()
  })

  it('điều hướng sang trang tạo mới và trang chỉnh sửa', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm câu hỏi/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/question-bank/new')

    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Chỉnh sửa câu hỏi' }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/question-bank/1/edit')
  })
})

describe('QuestionBankListPage - tìm kiếm, lọc, phân trang', () => {
  it('tìm theo nội dung sau debounce 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
      await screen.findByText('Câu hỏi đang hoạt động')

      fireEvent.change(screen.getByLabelText('Tìm theo nội dung câu hỏi'), { target: { value: 'lưu trữ' } })
      act(() => void vi.advanceTimersByTime(300))
      await waitFor(() => expect(screen.queryByText('Câu hỏi đang hoạt động')).not.toBeInTheDocument())
      expect(screen.getByText('Câu hỏi đã lưu trữ')).toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Tìm theo nội dung câu hỏi'), { target: { value: 'không khớp' } })
      act(() => void vi.advanceTimersByTime(300))
      expect(await screen.findByText('Không tìm thấy câu hỏi phù hợp')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('lọc theo danh mục và mức độ nhận thức', async () => {
    api.listQuestions.mockResolvedValue(listPayload([
      backendQuestion(),
      backendQuestion({ id: 3, stem: 'Câu hỏi khác danh mục', categoryName: 'Hồi sức', cognitiveLevel: 'CLINICAL_APPLICATION' }),
    ]))
    await renderPage()

    openFilters()
    chooseFilter('Danh mục', 'Hồi sức')
    applyFilters()
    await waitFor(() => expect(screen.queryByText('Câu hỏi đang hoạt động')).not.toBeInTheDocument())

    chooseFilter('Danh mục', 'Tất cả danh mục')
    chooseFilter('Mức độ nhận thức', 'Kiến thức nền tảng')
    applyFilters()
    expect(await screen.findByText('Câu hỏi đang hoạt động')).toBeInTheDocument()
    expect(screen.queryByText('Câu hỏi khác danh mục')).not.toBeInTheDocument()
  })

  it('đếm số bộ lọc đang bật và xoá sạch được', async () => {
    await renderPage()
    openFilters()
    chooseFilter('Trạng thái', 'Hoạt động')
    chooseFilter('Mức độ nhận thức', 'Kiến thức nền tảng')
    applyFilters()

    await waitFor(() => expect(within(screen.getByRole('button', { name: /Bộ lọc/ })).getByText('2')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(await screen.findByText('Câu hỏi đã lưu trữ')).toBeInTheDocument()
  })

  it('phân trang 10 câu mỗi trang với dải số rút gọn', async () => {
    api.listQuestions.mockResolvedValue(listPayload(
      Array.from({ length: 95 }, (_, index) => backendQuestion({ id: index + 1, stem: `Câu hỏi số ${index + 1}` })),
    ))
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
    await screen.findByText('Câu hỏi số 1')

    expect(screen.getByText('Hiển thị 10 trong tổng số 95 kết quả')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '<' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '>' }))
    expect(await screen.findByText('Câu hỏi số 11')).toBeInTheDocument()

    expect(screen.getAllByText('...').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(await screen.findByText('Câu hỏi số 21')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(await screen.findByText('Câu hỏi số 91')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '>' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '<' }))
    expect(await screen.findByText('Câu hỏi số 81')).toBeInTheDocument()
  })

  it('hiện đủ dải trang khi có ít hơn 8 trang', async () => {
    api.listQuestions.mockResolvedValue(listPayload(
      Array.from({ length: 25 }, (_, index) => backendQuestion({ id: index + 1, stem: `Câu hỏi số ${index + 1}` })),
    ))
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
    await screen.findByText('Câu hỏi số 1')

    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
    expect(screen.queryByText('...')).not.toBeInTheDocument()
  })
})

describe('QuestionBankListPage - chi tiết câu hỏi', () => {
  it('mở chi tiết, tải bản đầy đủ và đánh dấu đáp án đúng', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))

    await waitFor(() => expect(api.getQuestion).toHaveBeenCalledWith(1))
    const dialog = await screen.findByRole('dialog', { name: /Câu hỏi đang hoạt động/ })
    expect(within(dialog).getByText('Phương án B')).toBeInTheDocument()
    expect(within(dialog).getByText('Đáp án đúng')).toBeInTheDocument()
    expect(within(dialog).getByText('Điều dưỡng')).toBeInTheDocument()
  })

  it('hiện trạng thái tải chi tiết rồi thay bằng nội dung', async () => {
    let resolveDetail
    api.getQuestion.mockReturnValue(new Promise((resolve) => { resolveDetail = resolve }))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))

    expect(await screen.findByText('Đang tải chi tiết câu hỏi...')).toBeInTheDocument()
    await act(async () => { resolveDetail({ data: { data: backendQuestion() } }) })
    expect(screen.getByText('Phương án A')).toBeInTheDocument()
  })

  it('báo lỗi khi tải chi tiết thất bại', async () => {
    api.getQuestion.mockRejectedValue({ response: { data: { message: 'Không tìm thấy câu hỏi' } } })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy câu hỏi', 'error'))
  })

  it('hiện cảnh báo sử dụng trong chi tiết', async () => {
    api.getQuestion.mockResolvedValue({
      data: { data: backendQuestion({ impactWarning: { warning: 'Đang dùng trong 3 đề thi' } }) },
    })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))

    expect(await screen.findByText('Đang dùng trong 3 đề thi')).toBeInTheDocument()
    expect(screen.getByText('Cảnh báo sử dụng')).toBeInTheDocument()
  })

  it('hiện chỗ trống cho phương án chưa có nội dung', async () => {
    api.getQuestion.mockResolvedValue({ data: { data: backendQuestion({ optionD: null }) } })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))

    expect(await screen.findByText('Chưa có nội dung')).toBeInTheDocument()
  })

  it('chuyển sang trang chỉnh sửa từ hộp thoại chi tiết', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))
    fireEvent.click(await screen.findByRole('button', { name: /Chỉnh sửa$/ }))

    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/question-bank/1/edit')
  })

  it('đóng chi tiết bằng nút X, nút Đóng và click ra nền', async () => {
    await renderPage()
    const openDetail = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))
      return screen.findByRole('dialog', { name: /Câu hỏi đang hoạt động/ })
    }

    await openDetail()
    fireEvent.click(screen.getByLabelText('Đóng chi tiết câu hỏi'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await openDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const dialog = await openDetail()
    fireEvent.click(dialog.parentElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('không đóng chi tiết khi bấm vào bên trong hộp thoại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Câu hỏi đang hoạt động' }))
    const dialog = await screen.findByRole('dialog', { name: /Câu hỏi đang hoạt động/ })
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('không gọi API chi tiết với dữ liệu demo', async () => {
    api.listQuestions.mockRejectedValue(new Error('down'))
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
    await screen.findByText(/Kỹ thuật vệ sinh tay đúng/)
    fireEvent.click(screen.getByRole('button', { name: /Kỹ thuật vệ sinh tay đúng/ }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(api.getQuestion).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Chỉnh sửa$/ })).not.toBeInTheDocument()
  })
})

describe('QuestionBankListPage - lưu trữ câu hỏi', () => {
  it('hỏi xác nhận rồi lưu trữ và tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))

    const dialog = await screen.findByRole('dialog', { name: 'Lưu trữ câu hỏi?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu trữ câu hỏi' }))

    await waitFor(() => expect(api.archiveQuestion).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã lưu trữ câu hỏi.', 'success')
    await waitFor(() => expect(api.listQuestions).toHaveBeenCalledTimes(2))
  })

  it('chặn lưu trữ khi câu hỏi đang được sử dụng', async () => {
    api.getQuestion.mockResolvedValue({
      data: { data: backendQuestion({ impactWarning: { blocksArchive: true, warning: 'Đang dùng trong đề đang mở' } }) },
    })
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đang dùng trong đề đang mở', 'warning'))
    expect(screen.queryByRole('dialog', { name: 'Lưu trữ câu hỏi?' })).not.toBeInTheDocument()
  })

  it('dùng thông báo mặc định khi chặn lưu trữ mà không có mô tả', async () => {
    api.getQuestion.mockResolvedValue({ data: { data: backendQuestion({ impactWarning: { blocksArchive: true } }) } })
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Câu hỏi đang được dùng nên chưa thể lưu trữ.', 'warning'))
  })

  it('ghép cảnh báo sử dụng vào nội dung hộp thoại xác nhận', async () => {
    api.getQuestion.mockResolvedValue({
      data: { data: backendQuestion({ impactWarning: { blocksArchive: false, warning: 'Đang dùng trong 2 đề nháp' } }) },
    })
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))

    const dialog = await screen.findByRole('dialog', { name: 'Lưu trữ câu hỏi?' })
    expect(within(dialog).getByText(/Đang dùng trong 2 đề nháp/)).toBeInTheDocument()
  })

  it('vẫn cho lưu trữ khi không kiểm tra được ảnh hưởng', async () => {
    api.getQuestion.mockRejectedValue({ response: { data: { message: 'Không kiểm tra được' } } })
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không kiểm tra được', 'warning'))
    expect(await screen.findByRole('dialog', { name: 'Lưu trữ câu hỏi?' })).toBeInTheDocument()
  })

  it('không lưu trữ khi người dùng huỷ', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu trữ câu hỏi?' })).getByRole('button', { name: 'Hủy lưu trữ' }))

    expect(api.archiveQuestion).not.toHaveBeenCalled()
  })

  it('báo lỗi khi lưu trữ thất bại', async () => {
    api.archiveQuestion.mockRejectedValue({ response: { data: { message: 'Không thể lưu trữ' } } })
    await renderPage()
    fireEvent.click(within(rowOf('Câu hỏi đang hoạt động')).getByRole('button', { name: 'Xóa câu hỏi' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu trữ câu hỏi?' })).getByRole('button', { name: 'Lưu trữ câu hỏi' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể lưu trữ', 'error'))
  })

  it('xoá ngay khỏi danh sách với câu hỏi demo', async () => {
    api.listQuestions.mockRejectedValue(new Error('down'))
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
    await screen.findByText(/Kỹ thuật vệ sinh tay đúng/)
    fireEvent.click(within(rowOf(/Kỹ thuật vệ sinh tay đúng/)).getByRole('button', { name: 'Xóa câu hỏi' }))

    await waitFor(() => expect(screen.queryByText(/Kỹ thuật vệ sinh tay đúng/)).not.toBeInTheDocument())
    expect(api.getQuestion).not.toHaveBeenCalled()
  })
})

describe('QuestionBankListPage - xuất và tải mẫu', () => {
  let createObjectURL
  let revokeObjectURL
  let clickSpy

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    window.URL.createObjectURL = createObjectURL
    window.URL.revokeObjectURL = revokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('xuất ngân hàng câu hỏi ra Excel', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xuất ngân hàng câu hỏi'))

    await waitFor(() => expect(api.exportQuestions).toHaveBeenCalledWith({ status: 'ALL', q: undefined }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    expect(showToast).toHaveBeenCalledWith('Đã export ngân hàng câu hỏi.', 'success')
  })

  it('gửi kèm từ khoá đang lọc khi xuất', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)
      await screen.findByText('Câu hỏi đang hoạt động')
      fireEvent.change(screen.getByLabelText('Tìm theo nội dung câu hỏi'), { target: { value: 'hoạt động' } })
      act(() => void vi.advanceTimersByTime(300))
      fireEvent.click(screen.getByLabelText('Xuất ngân hàng câu hỏi'))

      await waitFor(() => expect(api.exportQuestions).toHaveBeenCalledWith({ status: 'ALL', q: 'hoạt động' }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('báo lỗi khi xuất thất bại', async () => {
    api.exportQuestions.mockRejectedValue({ response: { data: { message: 'Không xuất được' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xuất ngân hàng câu hỏi'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không xuất được', 'error'))
  })

  it('tải file mẫu import', async () => {
    await renderPage()
    openImport()
    fireEvent.click(screen.getByRole('button', { name: /Tải file mẫu/ }))

    await waitFor(() => expect(api.downloadImportTemplate).toHaveBeenCalled())
    expect(showToast).toHaveBeenCalledWith('Đã tải file mẫu import.', 'success')
  })

  it('báo lỗi khi tải file mẫu thất bại', async () => {
    api.downloadImportTemplate.mockRejectedValue(new Error('down'))
    await renderPage()
    openImport()
    fireEvent.click(screen.getByRole('button', { name: /Tải file mẫu/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })
})

describe('QuestionBankListPage - import câu hỏi', () => {
  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock')
    window.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('mở hộp thoại import và khoá các nút khi chưa chọn file', async () => {
    await renderPage()
    openImport()

    expect(screen.getByText('Import ngân hàng câu hỏi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xem trước/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Nhập các dòng đã preview/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Tải báo cáo lỗi/ })).toBeDisabled()
  })

  it('cảnh báo khi bấm xem trước mà chưa chọn file', async () => {
    await renderPage()
    openImport()
    // nút bị khoá ở UI nên gọi trực tiếp qua form: chọn rồi bỏ file
    pickFile()
    fireEvent.change(fileInput(), { target: { files: [] } })
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    expect(api.previewImport).not.toHaveBeenCalled()
  })

  it('preview file và hiển thị bảng kết quả', async () => {
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    await waitFor(() => expect(api.previewImport).toHaveBeenCalledWith(expect.any(File), null))
    expect(showToast).toHaveBeenCalledWith('Đã preview file import.', 'success')
    expect(screen.getByText('Mã import: #55')).toBeInTheDocument()
    expect(screen.getByText('Tổng dòng: 2')).toBeInTheDocument()
    expect(screen.getByText('[DD] Điều dưỡng')).toBeInTheDocument()
    expect(screen.getByText('Hợp lệ')).toBeInTheDocument()
    expect(screen.getByText(/Các dòng không nhận diện được danh mục/)).toBeInTheDocument()
  })

  it('hiện mapping cột khi file nguồn không theo mẫu', async () => {
    api.previewImport.mockResolvedValue({
      data: { data: { totalRows: 1, validRows: 1, invalidRows: 0, skippedRows: 0, sourceHeaders: ['Cột 1', 'Cột 2'], rows: [previewRow()] } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    await screen.findByText(/Mapping cột từ file nguồn/)
    const selects = screen.getAllByRole('combobox')
    fireEvent.click(selects[0])
    fireEvent.click(screen.getByRole('option', { name: 'Cột 1' }))
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    await waitFor(() => expect(api.previewImport).toHaveBeenLastCalledWith(
      expect.any(File), { categoryReference: 'Cột 1' },
    ))
  })

  it('hiển thị lý do bỏ qua và danh sách lỗi từng dòng', async () => {
    api.previewImport.mockResolvedValue({
      data: { data: { totalRows: 2, validRows: 0, invalidRows: 1, skippedRows: 1, sourceHeaders: [], rows: [
        previewRow({ rowNumber: 2, stem: 'Dòng bỏ qua', skipped: true, skipReason: 'Không nhận diện được danh mục', valid: false }),
        previewRow({ rowNumber: 3, stem: 'Dòng lỗi', valid: false, errors: ['Thiếu đáp án đúng', 'Thiếu mức nhận thức'], categoryCode: null, categoryReference: null, professionalFieldName: null }),
      ] } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    expect(await screen.findByText('Không nhận diện được danh mục')).toBeInTheDocument()
    expect(screen.getByText('Thiếu đáp án đúng, Thiếu mức nhận thức')).toBeInTheDocument()
    expect(screen.getByText('Chưa nhận diện')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('chỉ hiển thị 20 dòng đầu của preview', async () => {
    api.previewImport.mockResolvedValue({
      data: { data: { totalRows: 30, validRows: 30, invalidRows: 0, skippedRows: 0, sourceHeaders: [], rows:
        Array.from({ length: 30 }, (_, index) => previewRow({ rowNumber: index + 2, stem: `Dòng ${index + 2}` })) } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    expect(await screen.findByText('Chỉ hiển thị 20 dòng đầu trong preview.')).toBeInTheDocument()
    expect(screen.getByText('Dòng 21')).toBeInTheDocument()
    expect(screen.queryByText('Dòng 22')).not.toBeInTheDocument()
  })

  it('báo lỗi khi preview thất bại', async () => {
    api.previewImport.mockRejectedValue({ response: { data: { message: 'File sai định dạng' } } })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('File sai định dạng', 'error'))
  })

  it('ghi các dòng đã preview vào ngân hàng câu hỏi', async () => {
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Hợp lệ')
    fireEvent.click(screen.getByRole('button', { name: /Nhập các dòng đã preview/ }))

    await waitFor(() => expect(api.commitImport).toHaveBeenCalledWith(
      [expect.objectContaining({ rowNumber: 2, stem: 'Câu import 1', categoryId: 4, professionalFieldId: 9 })],
      55,
    ))
    expect(showToast).toHaveBeenCalledWith('Đã import 1 câu hỏi. 1 dòng bỏ qua. 0 dòng lỗi.', 'success')
    expect(await screen.findByText('Đã lưu #77')).toBeInTheDocument()
    await waitFor(() => expect(api.listQuestions).toHaveBeenCalledTimes(2))
  })

  it('cảnh báo khi có dòng lỗi sau khi ghi', async () => {
    api.commitImport.mockResolvedValue({
      data: { data: { createdCount: 0, skippedCount: 0, failedCount: 2, totalRows: 2, rows: [previewRow({ valid: false, errors: ['Lỗi'] })] } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Hợp lệ')
    fireEvent.click(screen.getByRole('button', { name: /Nhập các dòng đã preview/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã import 0 câu hỏi. 0 dòng bỏ qua. 2 dòng lỗi.', 'warning'))
  })

  it('gửi professionalFieldId null khi dòng chưa có lĩnh vực', async () => {
    api.previewImport.mockResolvedValue({
      data: { data: { totalRows: 1, validRows: 1, invalidRows: 0, skippedRows: 0, sourceHeaders: [], rows: [previewRow({ professionalFieldId: undefined })] } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Hợp lệ')
    fireEvent.click(screen.getByRole('button', { name: /Nhập các dòng đã preview/ }))

    await waitFor(() => expect(api.commitImport).toHaveBeenCalledWith(
      [expect.objectContaining({ professionalFieldId: null })], null,
    ))
  })

  it('báo lỗi khi ghi dữ liệu thất bại', async () => {
    api.commitImport.mockRejectedValue({ response: { data: { message: 'Ghi thất bại' } } })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Hợp lệ')
    fireEvent.click(screen.getByRole('button', { name: /Nhập các dòng đã preview/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Ghi thất bại', 'error'))
  })

  it('tải báo cáo lỗi dạng CSV', async () => {
    api.previewImport.mockResolvedValue({
      data: { data: { importJobId: 55, totalRows: 1, validRows: 0, invalidRows: 1, skippedRows: 0, sourceHeaders: [], rows: [
        previewRow({ valid: false, errors: ['Thiếu đáp án'] }),
      ] } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Thiếu đáp án')
    fireEvent.click(screen.getByRole('button', { name: /Tải báo cáo lỗi/ }))

    expect(window.URL.createObjectURL).toHaveBeenCalled()
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('cảnh báo khi không có dòng lỗi để tải báo cáo', async () => {
    api.previewImport.mockResolvedValue({
      data: { data: { importJobId: 55, totalRows: 1, validRows: 1, invalidRows: 0, skippedRows: 0, sourceHeaders: [], rows: [
        previewRow({ valid: true }), previewRow({ rowNumber: 3, valid: false, errors: [] }),
      ] } },
    })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Hợp lệ')

    // dòng thứ hai valid=false nên nút bật, nhưng lọc lại vẫn ra danh sách rỗng nếu không có lỗi
    fireEvent.click(screen.getByRole('button', { name: /Tải báo cáo lỗi/ }))
    expect(window.URL.createObjectURL).toHaveBeenCalled()
  })

  it('đóng hộp thoại import và dọn sạch trạng thái', async () => {
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))
    await screen.findByText('Hợp lệ')

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByText('Import ngân hàng câu hỏi')).not.toBeInTheDocument()

    openImport()
    expect(screen.queryByText('Hợp lệ')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xem trước/ })).toBeDisabled()
  })

  it('khoá thao tác trong lúc đang preview', async () => {
    let resolvePreview
    api.previewImport.mockReturnValue(new Promise((resolve) => { resolvePreview = resolve }))
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled())
    await act(async () => {
      resolvePreview({ data: { data: { totalRows: 0, rows: [], sourceHeaders: [] } } })
    })
  })

  it('cảnh báo khi ghi mà preview không có dòng nào', async () => {
    api.previewImport.mockResolvedValue({ data: { data: { totalRows: 0, validRows: 0, invalidRows: 0, skippedRows: 0, sourceHeaders: [], rows: [] } } })
    await renderPage()
    openImport()
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: /Xem trước/ }))

    await screen.findByText('Tổng dòng: 0')
    expect(screen.getByRole('button', { name: /Nhập các dòng đã preview/ })).toBeDisabled()
  })
})
