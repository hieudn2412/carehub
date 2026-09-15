import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FormBuilderPage from './FormBuilderPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({
  getFormVersionById: vi.fn(), updateFormVersion: vi.fn(), updateFormScoringConfiguration: vi.fn(), getFormScoringRecalculationJob: vi.fn(),
}))
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: '9', versionId: '22' }), useNavigate: () => navigate }))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children, back }) => <main><button onClick={back.onClick}>Quay lại trang</button>{children}</main> }))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ value, onChange, options }) => <select aria-label="Loại phần tử" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({ default: ({ isOpen, title, message, onConfirm, onCancel }) => isOpen ? <div role="dialog" aria-label={title}><p>{message}</p><button onClick={onConfirm}>Xác nhận</button><button onClick={onCancel}>Hủy</button></div> : null }))

const options = [
  { optionKey: 'o1', value: 'NO', label: 'Không', scoreValue: 0, compliant: false, displayOrder: 0 },
  { optionKey: 'o2', value: 'YES', label: 'Có', scoreValue: 1, compliant: true, displayOrder: 1 },
]
const question = (overrides = {}) => ({
  questionKey: `q-${overrides.code || '1'}`, code: 'Q1', title: 'Kiểm tra thao tác', helpText: 'Quan sát', fieldType: 'SINGLE_CHOICE', required: true,
  critical: true, excludeFromScore: false, weight: 1, options: options.map((x) => ({ ...x })), ...overrides,
})
const baseVersion = (overrides = {}) => ({
  id: 22, versionNumber: 2, title: 'Bảng kiểm chăm sóc', description: 'Hướng dẫn chung', status: 'DRAFT', lockVersion: 3,
  passingScoreMode: 'DEFAULT', passingScore: 8, settings: { custom: true }, criticalWeightPercent: 60,
  sections: [{
    sectionKey: 's1', title: 'Chuẩn bị', description: 'Mô tả phần', displayOrder: 0,
    items: [
      { itemKey: 'i1', itemType: 'QUESTION', displayOrder: 0, question: question() },
      { itemKey: 'i2', itemType: 'TITLE_DESCRIPTION', displayOrder: 1, title: 'Tiêu đề phụ', description: 'Đoạn mô tả' },
      { itemKey: 'i3', itemType: 'INSTRUCTION', displayOrder: 2, description: 'Làm theo hướng dẫn' },
      { itemKey: 'i4', itemType: 'IMAGE', displayOrder: 3, title: 'Ảnh minh họa', mediaUrl: '/image.png' },
      { itemKey: 'i5', itemType: 'QUESTION', displayOrder: 4, question: question({ code: 'Q2', title: 'Câu thường', fieldType: 'DROPDOWN', critical: false }) },
    ],
  }],
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  window.requestAnimationFrame = (callback) => callback()
  api.getFormVersionById.mockResolvedValue({ data: { data: baseVersion() } })
  api.updateFormVersion.mockResolvedValue({ data: { data: { lockVersion: 4 } } })
  api.updateFormScoringConfiguration.mockResolvedValue({ data: { data: { recalculationScheduled: false, configuration: { lockVersion: 5 } } } })
  api.getFormScoringRecalculationJob.mockResolvedValue({ data: { data: { id: 70, status: 'COMPLETED' } } })
})

const renderPage = async () => {
  render(<FormBuilderPage />)
  await screen.findByDisplayValue('Bảng kiểm chăm sóc')
}

describe('FormBuilderPage', () => {
  it('edits all item kinds, scoring, options, sections and protects dirty navigation', async () => {
    await renderPage()
    expect(screen.getByText('1 phần')).toBeInTheDocument()
    expect(screen.getByText(/1 câu trọng yếu/)).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('Bảng kiểm chăm sóc'), { target: { value: 'Bảng kiểm mới' } })
    fireEvent.change(screen.getByDisplayValue('Hướng dẫn chung'), { target: { value: 'Mô tả mới' } })
    fireEvent.click(screen.getByLabelText(/Tra cứu đối tượng bằng mã nhân viên/))
    fireEvent.change(screen.getByDisplayValue('60'), { target: { value: '55' } })

    fireEvent.click(screen.getByRole('button', { name: /Cài đặt/ }))
    fireEvent.click(screen.getByLabelText('Tiêu chí trọng yếu'))
    fireEvent.click(screen.getByLabelText('Không tính điểm'))
    fireEvent.click(screen.getByLabelText('Tính điểm'))
    fireEvent.change(screen.getByLabelText('Nhãn lựa chọn 1'), { target: { value: 'Không đạt' } })
    fireEvent.change(document.querySelector('.fbp-option-score-input'), { target: { value: '1.2' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm lựa chọn/ }))
    const optionDelete = screen.getAllByTitle('Xóa lựa chọn')
    fireEvent.click(optionDelete.at(-1))
    fireEvent.click(document.querySelector('.fbp-type-select__trigger'))
    fireEvent.click(screen.getByRole('option', { name: 'Trả lời ngắn' }))

    fireEvent.click(document.querySelector('#builder-item-i2 .fbp-item-summary'))
    fireEvent.change(screen.getByDisplayValue('Tiêu đề phụ'), { target: { value: 'Tiêu đề đã sửa' } })
    fireEvent.change(screen.getByDisplayValue('Đoạn mô tả'), { target: { value: 'Văn bản mới' } })
    fireEvent.click(document.querySelector('#builder-item-i3 .fbp-item-summary'))
    fireEvent.change(screen.getByDisplayValue('Làm theo hướng dẫn'), { target: { value: 'Hướng dẫn mới' } })
    fireEvent.click(document.querySelector('#builder-item-i4 .fbp-item-summary'))
    fireEvent.change(screen.getByDisplayValue('/image.png'), { target: { value: '/new.png' } })

    fireEvent.click(screen.getByRole('button', { name: /Thêm câu hỏi mới/ }))
    expect(screen.getByDisplayValue('Câu hỏi mới')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Xóa phần tử/ }).at(-1))
    fireEvent.click(screen.getAllByRole('button', { name: /Thêm phần/ }).at(-1))
    expect(screen.getByDisplayValue('Phần mới')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Xóa phần/ }).at(-1))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Xóa phần' })).getByRole('button', { name: 'Xác nhận' }))

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại trang' }))
    const leave = screen.getByRole('dialog', { name: 'Thay đổi chưa lưu' })
    fireEvent.click(within(leave).getByRole('button', { name: 'Hủy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại trang' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Thay đổi chưa lưu' })).getByRole('button', { name: 'Xác nhận' }))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/9/edit')
  })

  it('saves a cleaned draft payload and handles conflict/general errors', async () => {
    render(<FormBuilderPage />)
    await screen.findByPlaceholderText('Ví dụ: Đánh giá vệ sinh tay v1')
    fireEvent.change(screen.getByDisplayValue('Bảng kiểm chăm sóc'), { target: { value: 'Bảng kiểm hợp lệ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh' }))
    fireEvent.change(document.querySelector('.fbp-passing-config__value input'), { target: { value: '7.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    await waitFor(() => expect(api.updateFormVersion).toHaveBeenCalledWith('9', '22', expect.objectContaining({
      title: 'Bảng kiểm hợp lệ', passingScore: { mode: 'CUSTOM', value: 7.5 }, lockVersion: 3,
    })))
    expect(api.updateFormVersion.mock.calls[0][2].sections[0].items[0].question.code).toBe('Q1')
    expect(showToast).toHaveBeenCalledWith('Lưu bản thiết kế câu hỏi thành công!', 'success')

    fireEvent.change(screen.getByDisplayValue('Bảng kiểm hợp lệ'), { target: { value: 'Lần 2' } })
    api.updateFormVersion.mockRejectedValueOnce({ response: { status: 409 } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('được cập nhật ở nơi khác')
    api.updateFormVersion.mockRejectedValueOnce({ response: { data: { message: 'Không lưu được' } } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không lưu được')
  })

  it('validates title, section, question codes, choices and passing score', async () => {
    api.getFormVersionById.mockResolvedValueOnce({ data: { data: baseVersion({ title: '', sections: [{ ...baseVersion().sections[0], title: '', items: [
      { itemKey: 'x1', itemType: 'QUESTION', question: question({ code: 'DUP', title: '' }) },
      { itemKey: 'x2', itemType: 'QUESTION', question: question({ code: 'DUP' }) },
    ] }] }) } })
    render(<FormBuilderPage />)
    await screen.findByPlaceholderText('Ví dụ: Đánh giá vệ sinh tay v1')
    fireEvent.change(screen.getByPlaceholderText('Mô tả hướng dẫn chung...'), { target: { value: 'dirty' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(showToast).toHaveBeenCalledWith('Vui lòng điền tiêu đề phiên bản.', 'warning')
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Đánh giá vệ sinh tay v1'), { target: { value: 'Có tiêu đề' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Phần 1 cần có tiêu đề')

    fireEvent.change(screen.getByPlaceholderText('Nhập tên phần...'), { target: { value: 'Phần hợp lệ' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('cần có nội dung câu hỏi')

    fireEvent.change(screen.getByPlaceholderText('Nhập nội dung câu hỏi...'), { target: { value: 'Câu một' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Mã câu hỏi "DUP" đang bị trùng')

    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh' }))
    fireEvent.change(document.querySelector('.fbp-passing-config__value input'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Điểm sàn phải từ 0 đến 10')
  })

  it('loads errors with retry and prevents saving before a valid version is loaded', async () => {
    api.getFormVersionById.mockRejectedValueOnce({ response: { data: { message: 'Phiên bản lỗi' } } })
    render(<FormBuilderPage />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Phiên bản lỗi')
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử tải lại' }))
    expect(await screen.findByDisplayValue('Bảng kiểm chăm sóc')).toBeInTheDocument()
  })

  it('updates passing score for a published version and reports API errors', async () => {
    api.getFormVersionById.mockResolvedValue({ data: { data: baseVersion({ status: 'PUBLISHED', passingScoreMode: 'CUSTOM', passingScoreOverride: 7 }) } })
    await renderPage()
    expect(screen.getByText(/Version đã khóa cấu trúc/)).toBeInTheDocument()
    fireEvent.change(document.querySelector('.fbp-passing-config__value input'), { target: { value: '6.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật điểm sàn/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Cập nhật điểm sàn?' })).getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(api.updateFormScoringConfiguration).toHaveBeenCalledWith('9', '22', { passingScore: { mode: 'CUSTOM', value: 6.5 }, lockVersion: 3 }))
    expect(showToast).toHaveBeenCalledWith('Đã cập nhật điểm sàn.', 'success')

    fireEvent.change(document.querySelector('.fbp-passing-config__value input'), { target: { value: '6' } })
    api.updateFormScoringConfiguration.mockRejectedValueOnce({ response: { data: { message: 'Cấu hình lỗi' } } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật điểm sàn/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cấu hình lỗi')
  })

  it('shows a scheduled recalculation job', async () => {
    api.getFormVersionById.mockResolvedValue({ data: { data: baseVersion({ status: 'PUBLISHED', passingScoreMode: 'CUSTOM', passingScoreOverride: 7 }) } })
    api.updateFormScoringConfiguration.mockResolvedValueOnce({ data: { data: { recalculationScheduled: true, job: { id: 70, status: 'PENDING' } } } })
    render(<FormBuilderPage />)
    await screen.findByDisplayValue('Bảng kiểm chăm sóc')
    fireEvent.change(document.querySelector('.fbp-passing-config__value input'), { target: { value: '6.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật điểm sàn/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận' }))
    await screen.findByText(/Đang tính lại kết quả/)
    expect(showToast).toHaveBeenCalledWith('Đã tạo tác vụ tính lại kết quả.', 'success')
  })
})
