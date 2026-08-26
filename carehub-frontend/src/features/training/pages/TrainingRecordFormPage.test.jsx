import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingRecordFormPage from './TrainingRecordFormPage.jsx'

const navigate = vi.fn()
const route = { params: {} }
const api = vi.hoisted(() => ({
  getRecordOptions: vi.fn(),
  getRecord: vi.fn(),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  submitRecord: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
  useParams: () => route.params,
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange, required }) => (
    <input type="date" required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ label, value, onChange, options, helpText }) => (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {helpText && <small>{helpText}</small>}
    </label>
  ),
}))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, value, onChange, options }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const activityTypes = [
  { id: 1, name: 'Đào tạo trực tiếp', defaultDurationUnit: 'HOUR', requiresEvidence: false },
  { id: 2, name: 'Khoá tín chỉ', defaultDurationUnit: 'CREDIT', requiresEvidence: true },
]

const savedRecord = (overrides = {}) => ({
  id: 55, activityTypeId: 1, professionalFieldId: 9, title: 'Khoá cấp cứu',
  provider: 'Bệnh viện Việt Đức', description: 'Mô tả', startDate: '2026-08-01', endDate: '2026-08-02',
  durationValue: 8, durationUnit: 'HOUR', durationRawText: '8 giờ', declaredHours: 8,
  version: 3, workflowStatus: 'DRAFT', duplicateWarning: false, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = {}
  api.getRecordOptions.mockResolvedValue({
    data: { data: { activityTypes, professionalFields: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn' }] } },
  })
  api.getRecord.mockResolvedValue({ data: { data: savedRecord() } })
  api.createRecord.mockResolvedValue({ data: { data: savedRecord({ id: 77, version: 1 }) } })
  api.updateRecord.mockResolvedValue({ data: { data: savedRecord({ version: 4 }) } })
  api.submitRecord.mockResolvedValue({ data: { data: savedRecord({ workflowStatus: 'SUBMITTED', version: 5 }) } })
})

// Tiêu đề nằm ngoài nhánh loading nên phải chờ chính biểu mẫu xuất hiện.
const renderCreate = async () => {
  render(<TrainingRecordFormPage />)
  await screen.findByText('New Training Record')
  await screen.findByLabelText('Title')
}
const renderEdit = async () => {
  route.params = { id: '55' }
  render(<TrainingRecordFormPage />)
  await screen.findByText('Edit Training Record')
  await screen.findByLabelText('Title')
}
const titleInput = () => screen.getByLabelText('Title')
const submitForm = () => fireEvent.submit(titleInput().closest('form'))
const dateInputs = () => document.querySelectorAll('input[type="date"]')

describe('TrainingRecordFormPage - tạo mới', () => {
  it('nạp tuỳ chọn và chọn sẵn hình thức đầu tiên', async () => {
    render(<TrainingRecordFormPage />)
    expect(screen.getByText('Loading form...')).toBeInTheDocument()

    await screen.findByText('New Training Record')
    await screen.findByLabelText('Title')
    expect(api.getRecordOptions).toHaveBeenCalled()
    expect(api.getRecord).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Activity type')).toHaveValue('1')
    expect(screen.getByLabelText('Duration unit')).toHaveValue('HOUR')
  })

  it('đổi đơn vị thời lượng theo mặc định của hình thức đào tạo', async () => {
    await renderCreate()
    fireEvent.change(screen.getByLabelText('Activity type'), { target: { value: '2' } })

    expect(screen.getByLabelText('Duration unit')).toHaveValue('CREDIT')
    expect(screen.getByText('Evidence is required before submit.')).toBeInTheDocument()
  })

  it('giữ nguyên đơn vị khi hình thức không có mặc định', async () => {
    api.getRecordOptions.mockResolvedValue({
      data: { data: { activityTypes: [{ id: 3, name: 'Khác' }], professionalFields: [] } },
    })
    await renderCreate()
    expect(screen.getByLabelText('Duration unit')).toHaveValue('HOUR')
  })

  it('chịu được danh sách hình thức rỗng', async () => {
    api.getRecordOptions.mockResolvedValue({ data: { data: { activityTypes: [], professionalFields: [] } } })
    await renderCreate()
    expect(screen.getByLabelText('Activity type')).toHaveValue('')
  })

  it('tạo hồ sơ với payload đầy đủ rồi chuyển sang trang chỉnh sửa', async () => {
    await renderCreate()
    fireEvent.change(titleInput(), { target: { value: 'Khoá mới' } })
    fireEvent.change(dateInputs()[0], { target: { value: '2026-08-10' } })
    fireEvent.change(dateInputs()[1], { target: { value: '2026-08-11' } })
    fireEvent.change(screen.getByLabelText('Declared hours'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'Đơn vị A' } })
    fireEvent.change(screen.getByLabelText('Duration value'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Tìm và chọn lĩnh vực chuyên môn'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Duration raw text'), { target: { value: '6 giờ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Ghi chú' } })
    submitForm()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalledWith({
      activityTypeId: 1, professionalFieldId: 9, title: 'Khoá mới',
      provider: 'Đơn vị A', description: 'Ghi chú',
      startDate: '2026-08-10', endDate: '2026-08-11',
      durationValue: 6, durationUnit: 'HOUR', durationRawText: '6 giờ',
      declaredHours: 6, version: null,
    }))
    expect(navigate).toHaveBeenCalledWith('/training/records/77/edit', { replace: true })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('gửi null cho các trường tuỳ chọn còn trống', async () => {
    await renderCreate()
    fireEvent.change(titleInput(), { target: { value: 'Khoá tối giản' } })
    submitForm()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      provider: null, description: null, startDate: null, endDate: null,
      durationValue: null, durationRawText: null, declaredHours: null, professionalFieldId: null,
    })))
  })

  it('cảnh báo khi máy chủ phát hiện hồ sơ trùng', async () => {
    api.createRecord.mockResolvedValue({ data: { data: savedRecord({ id: 77, duplicateWarning: true }) } })
    await renderCreate()
    fireEvent.change(titleInput(), { target: { value: 'Khoá trùng' } })
    submitForm()

    expect(await screen.findByText('Saved. Duplicate warning detected.')).toBeInTheDocument()
  })

  it('hiện lỗi khi lưu thất bại', async () => {
    api.createRecord.mockRejectedValue({ response: { data: { message: 'Hồ sơ không hợp lệ' } } })
    await renderCreate()
    fireEvent.change(titleInput(), { target: { value: 'Khoá lỗi' } })
    submitForm()

    expect(await screen.findByText('Hồ sơ không hợp lệ')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('hiện lỗi khi nạp biểu mẫu thất bại', async () => {
    api.getRecordOptions.mockRejectedValue({ response: { data: { message: 'Không tải được tuỳ chọn' } } })
    render(<TrainingRecordFormPage />)
    expect(await screen.findByText('Không tải được tuỳ chọn')).toBeInTheDocument()
  })

  it('khoá nút lưu trong lúc đang gửi', async () => {
    let resolveCreate
    api.createRecord.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    await renderCreate()
    fireEvent.change(titleInput(), { target: { value: 'Đang lưu' } })
    submitForm()

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled()
    await act(async () => { resolveCreate({ data: { data: savedRecord({ id: 77 }) } }) })
  })

  it('ẩn nút nộp và liên kết minh chứng khi chưa có hồ sơ', async () => {
    await renderCreate()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Evidence' })).not.toBeInTheDocument()
  })
})

describe('TrainingRecordFormPage - chỉnh sửa', () => {
  it('nạp dữ liệu hồ sơ vào biểu mẫu', async () => {
    await renderEdit()

    expect(api.getRecord).toHaveBeenCalledWith('55')
    expect(titleInput()).toHaveValue('Khoá cấp cứu')
    expect(screen.getByLabelText('Provider')).toHaveValue('Bệnh viện Việt Đức')
    expect(screen.getByLabelText('Declared hours')).toHaveValue(8)
    expect(screen.getByLabelText('Tìm và chọn lĩnh vực chuyên môn')).toHaveValue('9')
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('điền chuỗi rỗng cho các trường máy chủ trả về null', async () => {
    api.getRecord.mockResolvedValue({
      data: { data: { id: 55, version: 1, workflowStatus: 'DRAFT', activityTypeId: null, professionalFieldId: null } },
    })
    await renderEdit()

    expect(titleInput()).toHaveValue('')
    expect(screen.getByLabelText('Activity type')).toHaveValue('')
    expect(screen.getByLabelText('Duration unit')).toHaveValue('HOUR')
  })

  it('cập nhật hồ sơ và không điều hướng', async () => {
    await renderEdit()
    fireEvent.change(titleInput(), { target: { value: 'Tên mới' } })
    submitForm()

    await waitFor(() => expect(api.updateRecord).toHaveBeenCalledWith('55', expect.objectContaining({
      title: 'Tên mới', version: 3,
    })))
    expect(navigate).not.toHaveBeenCalled()
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('hiện liên kết quản lý minh chứng khi đã có hồ sơ', async () => {
    await renderEdit()
    expect(screen.getByRole('link', { name: 'Manage Evidence' })).toHaveAttribute('href', '/training/records/55/evidence')
    expect(screen.getByRole('link', { name: 'Evidence' })).toBeInTheDocument()
  })

  it('nộp hồ sơ với số phiên bản hiện tại', async () => {
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(api.submitRecord).toHaveBeenCalledWith(55, { version: 3 }))
    expect(await screen.findByText('Đã nộp hồ sơ.')).toBeInTheDocument()
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument()
  })

  it('hiện lỗi khi nộp hồ sơ thất bại', async () => {
    api.submitRecord.mockRejectedValue({ response: { data: { message: 'Thiếu minh chứng' } } })
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Thiếu minh chứng')).toBeInTheDocument()
  })

  it('hiện lỗi khi cập nhật thất bại', async () => {
    api.updateRecord.mockRejectedValue({ response: { data: { message: 'Xung đột phiên bản' } } })
    await renderEdit()
    submitForm()

    expect(await screen.findByText('Xung đột phiên bản')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải hồ sơ để sửa thất bại', async () => {
    api.getRecord.mockRejectedValue(new Error('down'))
    route.params = { id: '55' }
    render(<TrainingRecordFormPage />)

    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })
})
