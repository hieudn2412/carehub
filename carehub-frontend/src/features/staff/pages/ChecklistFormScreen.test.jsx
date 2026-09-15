import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChecklistFormScreen from './ChecklistFormScreen.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({
  getAssignedForm: vi.fn(),
  getFormSubmissions: vi.fn(),
  createFormSubmission: vi.fn(),
  updateFormSubmission: vi.fn(),
  submitFormSubmission: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: '30' }),
}))
vi.mock('../api/staffApi.js', () => ({ staffApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Chọn ngày" type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ value, onChange, options = [], placeholder }) => (
    <select aria-label={placeholder} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))
vi.mock('../../../shared/components/ConfirmDialog.jsx', () => ({
  default: ({ title, message, confirmLabel, onConfirm, onCancel }) => (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Xem lại</button>
      <button onClick={onConfirm}>{confirmLabel}</button>
    </div>
  ),
}))

const question = (key, overrides = {}) => ({
  questionKey: key, stem: `Câu ${key}`, fieldType: 'SHORT_TEXT', required: false, options: [], ...overrides,
})

const options = [
  { optionKey: 'yes', label: 'Có', displayOrder: 1 },
  { optionKey: 'no', label: null, displayOrder: 2 },
]

const assignedForm = (overrides = {}) => ({
  formName: 'Phiếu vệ sinh tay',
  description: 'Mô tả phiếu',
  version: {
    sections: [
      {
        id: 20, displayOrder: 2, title: 'Phần sau', description: null,
        items: [
          { itemType: 'QUESTION', displayOrder: 1, question: question('q-number', { fieldType: 'NUMBER', minValue: 0, maxValue: 10 }) },
          { itemType: 'QUESTION', displayOrder: 2, question: question('q-date', { fieldType: 'DATE' }) },
          { itemType: 'QUESTION', displayOrder: 3, question: question('q-time', { fieldType: 'TIME' }) },
          { itemType: 'QUESTION', displayOrder: 4, question: question('q-text', { stem: null, questionText: 'Ghi chú thêm' }) },
        ],
      },
      {
        id: 10, displayOrder: 1, title: null, description: 'Mô tả phần đầu',
        items: [
          { itemType: 'QUESTION', displayOrder: 1, question: question('q-single', { fieldType: 'SINGLE_CHOICE', required: true, options }) },
          { itemType: 'QUESTION', displayOrder: 2, question: question('q-multi', { fieldType: 'MULTIPLE_CHOICE', options }) },
          { itemType: 'QUESTION', displayOrder: 3, question: question('q-drop', { fieldType: 'DROPDOWN', options }) },
          { itemType: 'SECTION_NOTE', displayOrder: 4 },
          { itemType: 'QUESTION', displayOrder: 5, question: null },
        ],
      },
    ],
  },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.getAssignedForm.mockResolvedValue({ data: { data: assignedForm() } })
  api.getFormSubmissions.mockResolvedValue({ data: { data: { content: [] } } })
  api.createFormSubmission.mockResolvedValue({ data: { data: { id: 900, status: 'DRAFT' } } })
  api.updateFormSubmission.mockResolvedValue({ data: { data: { id: 900 } } })
  api.submitFormSubmission.mockResolvedValue({ data: { data: { id: 900 } } })
})

const renderPage = async () => {
  render(<ChecklistFormScreen />)
  await screen.findByText('Phiếu vệ sinh tay')
}
const saveDraft = () => fireEvent.click(screen.getByRole('button', { name: /Lưu nháp/ }))
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Nộp phiếu$/ }))

describe('ChecklistFormScreen - tải phiếu', () => {
  it('tải phiếu và hiển thị các phần, câu hỏi theo thứ tự', async () => {
    render(<ChecklistFormScreen />)
    expect(screen.getByText('Đang tải phiếu kiểm tra...')).toBeInTheDocument()

    await screen.findByText('Phiếu vệ sinh tay')
    expect(api.getAssignedForm).toHaveBeenCalledWith('30')
    expect(screen.getByText('Mô tả phiếu')).toBeInTheDocument()
    const sectionTitles = screen.getAllByRole('heading', { level: 3 })
    expect(sectionTitles[0]).toHaveTextContent('Phần 1')
    expect(sectionTitles[1]).toHaveTextContent('Phần sau')
    expect(screen.getByText('Mô tả phần đầu')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú thêm')).toBeInTheDocument()
  })

  it('hiển thị dấu bắt buộc cho câu hỏi bắt buộc', async () => {
    await renderPage()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('dùng mã lựa chọn khi thiếu nhãn', async () => {
    await renderPage()
    expect(screen.getAllByText('no').length).toBeGreaterThan(0)
  })

  it.each([
    [403, 'Bạn không có quyền truy cập phiếu này.'],
    [404, 'Không tìm thấy phiếu kiểm tra.'],
  ])('hiện thông báo riêng cho lỗi %i', async (status, message) => {
    api.getAssignedForm.mockRejectedValue({ response: { status } })
    render(<ChecklistFormScreen />)
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('hiện thông báo của máy chủ cho lỗi khác', async () => {
    api.getAssignedForm.mockRejectedValue({ response: { status: 500, data: { message: 'Lỗi hệ thống' } } })
    render(<ChecklistFormScreen />)
    expect(await screen.findByText('Lỗi hệ thống')).toBeInTheDocument()
  })

  it('hiện thông báo mặc định khi phản hồi thiếu phiên bản', async () => {
    api.getAssignedForm.mockResolvedValue({ data: { data: {} } })
    render(<ChecklistFormScreen />)
    expect(await screen.findByText('Không thể tải phiếu kiểm tra.')).toBeInTheDocument()
  })

  it('hiện thông báo khi phiếu chưa có câu hỏi', async () => {
    api.getAssignedForm.mockResolvedValue({ data: { data: { formName: null, version: { sections: [] } } } })
    render(<ChecklistFormScreen />)
    expect(await screen.findByText('Phiếu kiểm tra này chưa có câu hỏi nào.')).toBeInTheDocument()
    expect(screen.getByText('Phiếu #30')).toBeInTheDocument()
  })
})

describe('ChecklistFormScreen - khôi phục bài đã lưu', () => {
  it('khôi phục câu trả lời từ bản nộp trước', async () => {
    api.getFormSubmissions.mockResolvedValue({
      data: { data: { content: [{
        id: 900, status: 'DRAFT',
        answers: [
          { questionKey: 'q-single', optionKey: 'yes' },
          { questionKey: 'q-multi', optionKeys: ['yes', 'no'] },
          { questionKey: 'q-number', numberValue: 5 },
          { questionKey: 'q-date', dateValue: '2026-08-01' },
          { questionKey: 'q-time', timeValue: '09:00' },
          { questionKey: 'q-text', textValue: 'ghi chú cũ' },
        ],
      }] } },
    })
    await renderPage()

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Có' })).toBeChecked())
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByLabelText('Chọn ngày')).toHaveValue('2026-08-01')
    expect(screen.getByDisplayValue('ghi chú cũ')).toBeInTheDocument()
  })

  it('chịu được phản hồi bản nộp dạng mảng phẳng', async () => {
    api.getFormSubmissions.mockResolvedValue({
      data: { data: [{ id: 901, status: 'DRAFT', answers: [{ questionKey: 'q-text', textValue: 'từ mảng' }] }] },
    })
    await renderPage()
    expect(await screen.findByDisplayValue('từ mảng')).toBeInTheDocument()
  })

  it('bỏ qua lỗi khi không lấy được bản nộp trước', async () => {
    api.getFormSubmissions.mockRejectedValue(new Error('down'))
    await renderPage()
    expect(screen.getByRole('button', { name: /Lưu nháp/ })).toBeInTheDocument()
  })

  it('chuyển sang chế độ chỉ đọc khi phiếu đã nộp', async () => {
    api.getFormSubmissions.mockResolvedValue({
      data: { data: { content: [{ id: 900, status: 'SUBMITTED', answers: [
        { questionKey: 'q-single', optionKey: 'yes' },
        { questionKey: 'q-multi', optionKeys: ['yes', 'no'] },
      ] }] } },
    })
    await renderPage()

    expect(await screen.findByText('Đã nộp')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lưu nháp/ })).not.toBeInTheDocument()
    expect(screen.getByText('yes, no')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa trả lời').length).toBeGreaterThan(0)
  })

  it('coi trạng thái COMPLETED cũng là chỉ đọc', async () => {
    api.getFormSubmissions.mockResolvedValue({
      data: { data: { content: [{ id: 900, status: 'COMPLETED', answers: [] }] } },
    })
    await renderPage()
    expect(await screen.findByText('Đã nộp')).toBeInTheDocument()
  })
})

describe('ChecklistFormScreen - trả lời câu hỏi', () => {
  it('trả lời được mọi loại trường', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    expect(screen.getByRole('radio', { name: 'Có' })).toBeChecked()

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).not.toBeChecked()
    expect(checkboxes[1]).toBeChecked()

    fireEvent.change(screen.getByLabelText('-- Chọn --'), { target: { value: 'yes' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-08-25' } })
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '10:30' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập câu trả lời...'), { target: { value: 'Ghi chú' } })

    expect(screen.getByRole('spinbutton')).toHaveValue(7)
    expect(document.querySelectorAll('.cfs-question--answered')).toHaveLength(7)
  })

  it('đánh dấu câu đã trả lời bằng dấu tích', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})

describe('ChecklistFormScreen - lưu nháp', () => {
  it('tạo bản nháp rồi gửi đúng kiểu dữ liệu từng câu', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.change(screen.getByLabelText('-- Chọn --'), { target: { value: 'no' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-08-25' } })
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '10:30' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập câu trả lời...'), { target: { value: 'Ghi chú' } })
    saveDraft()

    await waitFor(() => expect(api.createFormSubmission).toHaveBeenCalledWith({ assignmentItemId: 30 }))
    expect(api.updateFormSubmission).toHaveBeenCalledWith(900, {
      answers: [
        { questionKey: 'q-single', optionKey: 'yes' },
        { questionKey: 'q-multi', optionKeys: ['yes'] },
        { questionKey: 'q-drop', optionKey: 'no' },
        { questionKey: 'q-number', numberValue: 7 },
        { questionKey: 'q-date', dateValue: '2026-08-25' },
        { questionKey: 'q-time', timeValue: '10:30' },
        { questionKey: 'q-text', textValue: 'Ghi chú' },
      ],
    })
    expect(showToast).toHaveBeenCalledWith('Đã lưu câu trả lời', 'success')
  })

  it('dùng lại bản nháp đã có thay vì tạo mới', async () => {
    api.getFormSubmissions.mockResolvedValue({ data: { data: { content: [{ id: 800, status: 'DRAFT', answers: [] }] } } })
    await renderPage()
    await waitFor(() => expect(api.getFormSubmissions).toHaveBeenCalled())
    saveDraft()

    await waitFor(() => expect(api.updateFormSubmission).toHaveBeenCalledWith(800, expect.anything()))
    expect(api.createFormSubmission).not.toHaveBeenCalled()
  })

  it('bỏ qua các câu chưa trả lời khi gửi', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    saveDraft()

    await waitFor(() => expect(api.updateFormSubmission).toHaveBeenCalledWith(900, {
      answers: [{ questionKey: 'q-single', optionKey: 'yes' }],
    }))
  })

  it('báo lỗi khi lưu thất bại', async () => {
    api.updateFormSubmission.mockRejectedValue({ response: { data: { message: 'Phiếu đã đóng' } } })
    await renderPage()
    saveDraft()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Phiếu đã đóng', 'error'))
  })

  it('dùng thông báo mặc định khi lỗi lưu không có nội dung', async () => {
    api.createFormSubmission.mockRejectedValue(new Error('down'))
    await renderPage()
    saveDraft()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể lưu', 'error'))
  })

  it('khoá nút trong lúc đang lưu', async () => {
    let resolveCreate
    api.createFormSubmission.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    await renderPage()
    saveDraft()

    expect(await screen.findByRole('button', { name: /Đang lưu.../ })).toBeDisabled()
    await act(async () => { resolveCreate({ data: { data: { id: 900 } } }) })
  })
})

describe('ChecklistFormScreen - nộp phiếu', () => {
  const answerAll = () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.change(screen.getByLabelText('-- Chọn --'), { target: { value: 'yes' } })
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-08-25' } })
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '10:30' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập câu trả lời...'), { target: { value: 'Ghi chú' } })
  }

  it('nộp thẳng khi đã trả lời hết', async () => {
    await renderPage()
    answerAll()
    submit()

    await waitFor(() => expect(api.submitFormSubmission).toHaveBeenCalledWith(900))
    expect(showToast).toHaveBeenCalledWith('Đã nộp phiếu kiểm tra!', 'success')
    expect(navigate).toHaveBeenCalledWith('/staff/checklists')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hỏi xác nhận khi còn câu chưa trả lời', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    submit()

    const dialog = screen.getByRole('dialog', { name: 'Nộp phiếu kiểm tra' })
    expect(within(dialog).getByText('Còn 6 câu chưa trả lời. Bạn có chắc muốn nộp?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nộp phiếu' }))

    await waitFor(() => expect(api.submitFormSubmission).toHaveBeenCalled())
  })

  it('huỷ nộp khi người dùng chọn xem lại', async () => {
    await renderPage()
    submit()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.submitFormSubmission).not.toHaveBeenCalled()
  })

  it('báo lỗi khi nộp thất bại', async () => {
    api.submitFormSubmission.mockRejectedValue({ response: { data: { message: 'Đợt đã kết thúc' } } })
    await renderPage()
    answerAll()
    submit()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đợt đã kết thúc', 'error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('dùng thông báo mặc định khi lỗi nộp không có nội dung', async () => {
    api.submitFormSubmission.mockRejectedValue(new Error('down'))
    await renderPage()
    answerAll()
    submit()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể nộp phiếu', 'error'))
  })

  it('khoá nút trong lúc đang nộp', async () => {
    let resolveSubmit
    api.submitFormSubmission.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve }))
    await renderPage()
    answerAll()
    submit()

    expect(await screen.findByRole('button', { name: /Đang nộp.../ })).toBeDisabled()
    await act(async () => { resolveSubmit({ data: { data: {} } }) })
  })
})
