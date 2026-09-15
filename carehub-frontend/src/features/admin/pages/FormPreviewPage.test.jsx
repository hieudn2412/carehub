import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormPreviewPage from './FormPreviewPage.jsx'

const showToast = vi.fn()
const search = { current: new URLSearchParams() }
const api = vi.hoisted(() => ({ getFormPreviewById: vi.fn(), findFormSubject: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '7' }),
  useSearchParams: () => [search.current],
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Chọn ngày" type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../shared/components/DateTimePicker24h.jsx', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Chọn ngày giờ" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ value, onChange, options = [] }) => (
    <select aria-label="Danh sách thả xuống" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const question = (key, overrides = {}) => ({
  questionKey: key, title: `Câu ${key}`, fieldType: 'SHORT_TEXT',
  required: false, critical: false, excludeFromScore: false, weight: null,
  helpText: null, options: [], ...overrides,
})

const options = [
  { id: 1, optionKey: 'a', value: 'a', label: 'Lựa chọn A', displayOrder: 2 },
  { id: 2, optionKey: 'b', value: 'b', label: 'Lựa chọn B', displayOrder: 1 },
]

const preview = (overrides = {}) => ({
  form: { id: 7, code: 'HAND_HYGIENE_COMPLIANCE', title: 'Tuân thủ vệ sinh tay', description: 'Mô tả biểu mẫu' },
  version: {
    versionNumber: 2, status: 'PUBLISHED',
    settings: { subjectSelector: true },
    sections: [
      {
        id: 20, displayOrder: 2, title: 'Phần sau', description: null,
        items: [
          { id: 200, displayOrder: 1, itemType: 'INSTRUCTION', description: 'Hướng dẫn thực hiện' },
          { id: 201, displayOrder: 2, itemType: 'TITLE_DESCRIPTION', title: 'Tiêu đề phụ', description: 'Mô tả phụ' },
          { id: 202, displayOrder: 3, itemType: 'IMAGE', mediaUrl: 'https://cdn/anh.png', title: 'Ảnh minh hoạ' },
          { id: 203, displayOrder: 4, itemType: 'QUESTION', question: question('q-long', { fieldType: 'LONG_TEXT' }) },
          { id: 204, displayOrder: 5, itemType: 'QUESTION', question: question('q-number', { fieldType: 'NUMBER' }) },
          { id: 205, displayOrder: 6, itemType: 'QUESTION', question: question('q-date', { fieldType: 'DATE' }) },
          { id: 206, displayOrder: 7, itemType: 'QUESTION', question: question('q-datetime', { fieldType: 'DATETIME' }) },
          { id: 207, displayOrder: 8, itemType: 'QUESTION', question: question('q-unknown', { fieldType: 'RATING' }) },
        ],
      },
      {
        id: 10, displayOrder: 1, title: 'Phần đầu', description: 'Mô tả phần đầu',
        items: [
          {
            id: 100, displayOrder: 1, itemType: 'QUESTION',
            question: question('q-short', {
              title: 'Câu ngắn', required: true, critical: true, helpText: 'Gợi ý trả lời',
            }),
          },
          { id: 101, displayOrder: 2, itemType: 'QUESTION', question: question('q-bool', { fieldType: 'BOOLEAN', excludeFromScore: true }) },
          { id: 102, displayOrder: 3, itemType: 'QUESTION', question: question('q-single', { fieldType: 'SINGLE_CHOICE', weight: 2, options }) },
          { id: 103, displayOrder: 4, itemType: 'QUESTION', question: question('q-multi', { fieldType: 'MULTIPLE_CHOICE', options }) },
          { id: 104, displayOrder: 5, itemType: 'QUESTION', question: question('q-drop', { fieldType: 'DROPDOWN', options }) },
          { id: 105, displayOrder: 6, itemType: 'QUESTION', question: null },
        ],
      },
    ],
  },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  search.current = new URLSearchParams()
  api.getFormPreviewById.mockResolvedValue({ data: { data: preview() } })
  api.findFormSubject.mockResolvedValue({
    data: { data: { employeeCode: 'NV001', fullName: 'Nguyễn Văn A', position: 'Điều dưỡng', department: 'Khoa Ngoại' } },
  })
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async () => {
  render(<FormPreviewPage />)
  await screen.findByText('Tuân thủ vệ sinh tay')
}
const lookupInput = () => screen.getByPlaceholderText('Nhập mã nhân viên (ví dụ: NV001)...')
const doLookup = () => fireEvent.click(screen.getByRole('button', { name: /Tra cứu/ }))

describe('FormPreviewPage - tải bản xem trước', () => {
  it('tải và hiển thị thông tin biểu mẫu cùng banner phiên bản', async () => {
    render(<FormPreviewPage />)
    expect(screen.getByText(/Đang tải giao diện xem trước/)).toBeInTheDocument()

    await screen.findByText('Tuân thủ vệ sinh tay')
    expect(api.getFormPreviewById).toHaveBeenCalledWith('7', {})
    expect(screen.getByText('TUAN_THU_VE_SINH_TAY')).toBeInTheDocument()
    expect(screen.getByText('Mô tả biểu mẫu')).toBeInTheDocument()
    expect(screen.getByText('Phiên bản v2 (PUBLISHED)')).toBeInTheDocument()
  })

  it('gửi kèm versionId khi có trên query string', async () => {
    search.current = new URLSearchParams('versionId=99')
    render(<FormPreviewPage />)
    await screen.findByText('Tuân thủ vệ sinh tay')
    expect(api.getFormPreviewById).toHaveBeenCalledWith('7', { versionId: '99' })
  })

  it('ẩn mô tả khi biểu mẫu không có mô tả', async () => {
    const data = preview()
    data.form.description = null
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()
    expect(screen.queryByText('Mô tả biểu mẫu')).not.toBeInTheDocument()
  })

  it('hiện lỗi kèm nút tải lại khi phản hồi không hợp lệ', async () => {
    api.getFormPreviewById.mockResolvedValueOnce({ data: { data: { form: null } } })
    render(<FormPreviewPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải dữ liệu xem trước biểu mẫu.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    await screen.findByText('Tuân thủ vệ sinh tay')
  })

  it('hiện thông báo lỗi của máy chủ', async () => {
    api.getFormPreviewById.mockRejectedValue({ response: { data: { message: 'Phiên bản không tồn tại' } } })
    render(<FormPreviewPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên bản không tồn tại')
  })
})

describe('FormPreviewPage - tra cứu đối tượng đánh giá', () => {
  it('cảnh báo khi chưa nhập mã nhân viên', async () => {
    await renderPage()
    doLookup()

    expect(showToast).toHaveBeenCalledWith('Vui lòng nhập mã nhân viên để tra cứu.', 'warning')
    expect(api.findFormSubject).not.toHaveBeenCalled()
  })

  it('tra cứu thành công và hiển thị thông tin nhân viên', async () => {
    await renderPage()
    fireEvent.change(lookupInput(), { target: { value: '  NV001  ' } })
    doLookup()

    await waitFor(() => expect(api.findFormSubject).toHaveBeenCalledWith({ employeeCode: 'NV001' }))
    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Điều dưỡng')).toBeInTheDocument()
    expect(screen.getByText('Khoa Ngoại')).toBeInTheDocument()
  })

  it('báo không tìm thấy khi máy chủ trả về rỗng', async () => {
    api.findFormSubject.mockResolvedValue({ data: { data: null } })
    await renderPage()
    fireEvent.change(lookupInput(), { target: { value: 'NV404' } })
    doLookup()

    expect(await screen.findByText('Không tìm thấy nhân viên hoặc bạn không có quyền truy cập.')).toBeInTheDocument()
  })

  it('hiện lỗi của máy chủ khi tra cứu thất bại', async () => {
    api.findFormSubject.mockRejectedValue({ response: { data: { message: 'Không có quyền tra cứu' } } })
    await renderPage()
    fireEvent.change(lookupInput(), { target: { value: 'NV001' } })
    doLookup()

    expect(await screen.findByText('Không có quyền tra cứu')).toBeInTheDocument()
  })

  it('dùng thông báo mặc định khi lỗi không có nội dung', async () => {
    api.findFormSubject.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.change(lookupInput(), { target: { value: 'NV001' } })
    doLookup()

    expect(await screen.findByText('Không thể tra cứu nhân viên.')).toBeInTheDocument()
  })

  it('khoá nút trong lúc đang tra cứu', async () => {
    let resolveLookup
    api.findFormSubject.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
    await renderPage()
    fireEvent.change(lookupInput(), { target: { value: 'NV001' } })
    doLookup()

    await waitFor(() => expect(lookupInput().closest('.fpp-lookup-row').querySelector('button')).toBeDisabled())
    await act(async () => { resolveLookup({ data: { data: null } }) })
  })

  it('ẩn khối tra cứu khi phiên bản không bật chọn đối tượng', async () => {
    const data = preview()
    data.version.settings = { subjectSelector: false }
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()

    expect(screen.queryByText('I. Tra cứu đối tượng đánh giá')).not.toBeInTheDocument()
  })

  it('ẩn khối tra cứu khi phiên bản không có settings', async () => {
    const data = preview()
    delete data.version.settings
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()

    expect(screen.queryByText('I. Tra cứu đối tượng đánh giá')).not.toBeInTheDocument()
  })
})

describe('FormPreviewPage - hiển thị cấu trúc biểu mẫu', () => {
  it('sắp xếp phần và mục theo thứ tự hiển thị', async () => {
    await renderPage()
    const sections = screen.getAllByRole('heading', { level: 2 })
    expect(sections[0]).toHaveTextContent('Phần đầu')
    expect(sections[1]).toHaveTextContent('Phần sau')
    expect(screen.getByText('Mô tả phần đầu')).toBeInTheDocument()
  })

  it('hiển thị mục hướng dẫn, tiêu đề phụ và ảnh', async () => {
    await renderPage()
    expect(screen.getByText('Hướng dẫn thực hiện')).toBeInTheDocument()
    expect(screen.getByText('Tiêu đề phụ')).toBeInTheDocument()
    expect(screen.getByText('Mô tả phụ')).toBeInTheDocument()
    expect(screen.getByAltText('Ảnh minh hoạ')).toHaveAttribute('src', 'https://cdn/anh.png')
  })

  it('hiển thị huy hiệu bắt buộc, trọng yếu, hệ số và không tính điểm', async () => {
    await renderPage()
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText('Trọng yếu')).toBeInTheDocument()
    expect(screen.getByText('Không tính điểm')).toBeInTheDocument()
    expect(screen.getByText('Hệ số 2')).toBeInTheDocument()
    expect(screen.getByText('Gợi ý trả lời')).toBeInTheDocument()
  })

  it('sắp xếp lựa chọn theo thứ tự hiển thị', async () => {
    await renderPage()
    const radios = screen.getAllByRole('radio', { name: /Lựa chọn/ })
    expect(radios[0]).toHaveAttribute('value', 'b')
  })

  it('bỏ qua mục câu hỏi không có dữ liệu câu hỏi', async () => {
    await renderPage()
    expect(screen.queryByText('Câu q-null')).not.toBeInTheDocument()
  })

  it('chịu được phiên bản không có phần nào', async () => {
    const data = preview()
    data.version.sections = null
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('chịu được phần không có mục nào', async () => {
    const data = preview()
    data.version.sections = [{ id: 1, displayOrder: 1, title: 'Phần trống' }]
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()
    expect(screen.getByText('Phần trống')).toBeInTheDocument()
  })

  it('chịu được câu hỏi không có lựa chọn nào', async () => {
    const data = preview()
    data.version.sections = [{
      id: 1, displayOrder: 1, title: 'Phần A',
      items: [{ id: 1, displayOrder: 1, itemType: 'QUESTION', question: question('q', { fieldType: 'SINGLE_CHOICE', options: null }) }],
    }]
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('ẩn ảnh khi mục thiếu đường dẫn', async () => {
    const data = preview()
    data.version.sections = [{
      id: 1, displayOrder: 1, title: 'Phần A',
      items: [{ id: 1, displayOrder: 1, itemType: 'IMAGE', mediaUrl: null, title: null }],
    }]
    api.getFormPreviewById.mockResolvedValue({ data: { data } })
    await renderPage()
    expect(document.querySelector('.fpp-img')).toBeNull()
  })
})

describe('FormPreviewPage - nhập liệu thử nghiệm', () => {
  it('nhập được mọi loại trường', async () => {
    await renderPage()

    fireEvent.change(screen.getByPlaceholderText('Nhập câu trả lời ngắn...'), { target: { value: 'Trả lời ngắn' } })
    expect(screen.getByDisplayValue('Trả lời ngắn')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Nhập ý kiến nhận xét chi tiết...'), { target: { value: 'Nhận xét dài' } })
    expect(screen.getByDisplayValue('Nhận xét dài')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Nhập số...'), { target: { value: '12' } })
    expect(screen.getByDisplayValue('12')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-08-25' } })
    expect(screen.getByLabelText('Chọn ngày')).toHaveValue('2026-08-25')

    fireEvent.change(screen.getByLabelText('Chọn ngày giờ'), { target: { value: '2026-08-25 09:00' } })
    expect(screen.getByLabelText('Chọn ngày giờ')).toHaveValue('2026-08-25 09:00')

    fireEvent.change(screen.getByPlaceholderText('Trường nhập dữ liệu (RATING)'), { target: { value: '5' } })
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
  })

  it('chọn được đáp án Có/Không của câu boolean', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('radio', { name: /Có \(Đạt\)/ }))
    expect(screen.getByRole('radio', { name: /Có \(Đạt\)/ })).toBeChecked()

    fireEvent.click(screen.getByRole('radio', { name: /Không \(Không đạt\)/ }))
    expect(screen.getByRole('radio', { name: /Không \(Không đạt\)/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Có \(Đạt\)/ })).not.toBeChecked()
  })

  it('chọn một lựa chọn ở câu trắc nghiệm đơn', async () => {
    await renderPage()
    const radio = screen.getAllByRole('radio', { name: /Lựa chọn A/ })[0]
    fireEvent.click(radio)
    expect(radio).toBeChecked()
  })

  it('tích và bỏ tích nhiều lựa chọn', async () => {
    await renderPage()
    const [first, second] = screen.getAllByRole('checkbox')

    fireEvent.click(first)
    fireEvent.click(second)
    expect(first).toBeChecked()
    expect(second).toBeChecked()

    fireEvent.click(first)
    expect(first).not.toBeChecked()
    expect(second).toBeChecked()
  })

  it('chọn được giá trị trong danh sách thả xuống', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Danh sách thả xuống'), { target: { value: 'a' } })
    expect(screen.getByLabelText('Danh sách thả xuống')).toHaveValue('a')
  })

  it('nhắc rằng dữ liệu thử nghiệm không được lưu', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Gửi kết quả \(Thử nghiệm\)/ }))

    expect(showToast).toHaveBeenCalledWith(
      'Đây là chế độ xem trước (Preview). Kết quả đánh giá không thể lưu thực sự vào hệ thống.', 'info',
    )
  })
})
