import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailTemplateFormPage from './EmailTemplateFormPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const route = { params: { id: 'new' } }
const api = vi.hoisted(() => ({
  getNotificationEvents: vi.fn(),
  getEmailTemplateById: vi.fn(),
  createEmailTemplate: vi.fn(),
  updateEmailTemplate: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ value, onChange, options = [], disabled, ariaLabelledBy }) => (
    <select
      aria-label={ariaLabelledBy}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const template = (overrides = {}) => ({
  id: 5, code: 'CUSTOM_NHAC_HAN', name: 'Nhắc hạn đào tạo',
  eventType: 'EXAM_ASSIGNED', category: 'EVALUATION', audience: 'EMPLOYEE',
  active: true, subject: 'Tiêu đề cũ', body: 'Nội dung cũ',
  systemManaged: false, version: 3, allowedVariables: ['recipient_name', 'exam_name'],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  route.params = { id: 'new' }
  api.getNotificationEvents.mockResolvedValue({ data: { data: [] } })
  api.getEmailTemplateById.mockResolvedValue({ data: { data: template() } })
  api.createEmailTemplate.mockResolvedValue({ data: { success: true } })
  api.updateEmailTemplate.mockResolvedValue({ data: { success: true } })
})

afterEach(() => { console.error.mockRestore?.() })

const renderCreate = async () => {
  render(<EmailTemplateFormPage />)
  await screen.findByText('Tạo mới biểu mẫu')
}
const renderEdit = async () => {
  route.params = { id: '5' }
  render(<EmailTemplateFormPage />)
  await waitFor(() => expect(nameInput()).toHaveValue('Nhắc hạn đào tạo'))
}

const fields = () => document.querySelectorAll('.etf-input')
const nameInput = () => fields()[0]
const codeInput = () => fields()[1]
const categoryInput = () => fields()[2]
const subjectInput = () => fields()[3]
const bodyInput = () => document.querySelector('.etf-textarea')
const submitForm = () => fireEvent.submit(nameInput().closest('form'))
const fillRequired = () => {
  fireEvent.change(nameInput(), { target: { value: 'Nhắc hạn' } })
  fireEvent.change(subjectInput(), { target: { value: 'Tiêu đề' } })
  fireEvent.change(bodyInput(), { target: { value: 'Nội dung' } })
}

describe('EmailTemplateFormPage - tạo mới', () => {
  it('hiển thị biểu mẫu trống với sự kiện mặc định', async () => {
    await renderCreate()

    expect(api.getEmailTemplateById).not.toHaveBeenCalled()
    expect(screen.getByLabelText('eventType-label')).toHaveValue('CME_HOURS_BELOW_REQUIREMENT')
    expect(categoryInput()).toHaveValue('Đào tạo')
    expect(screen.getByLabelText('active-label')).toHaveValue('ACTIVE')
  })

  it('tự sinh mã biểu mẫu từ tên có dấu tiếng Việt', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Nhắc hạn đào tạo định kỳ' } })

    expect(codeInput()).toHaveValue('CUSTOM_NHAC_HAN_DAO_TAO_DINH_KY')
  })

  it('để trống mã khi tên chỉ gồm ký tự đặc biệt', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: '@@@' } })
    expect(codeInput()).toHaveValue('')
  })

  it('chuẩn hoá mã khi người dùng tự nhập', async () => {
    await renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ma-moi 01' } })
    expect(codeInput()).toHaveValue('MA_MOI_01')
  })

  it('đổi danh mục và đối tượng theo sự kiện được chọn', async () => {
    await renderCreate()
    fireEvent.change(screen.getByLabelText('eventType-label'), { target: { value: 'QUALITY_COMPLIANCE_BELOW_TARGET' } })

    expect(categoryInput()).toHaveValue('Chất lượng')
    expect(screen.getByLabelText('audience-label')).toHaveValue('MANAGER')
    // sự kiện chỉ có một đối tượng nhận nên ô chọn bị khoá
    expect(screen.getByLabelText('audience-label')).toBeDisabled()
  })

  it('cho chọn đối tượng khi sự kiện hỗ trợ nhiều nhóm', async () => {
    await renderCreate()
    const audience = screen.getByLabelText('audience-label')
    expect(audience).toBeEnabled()

    fireEvent.change(audience, { target: { value: 'MANAGER' } })
    expect(audience).toHaveValue('MANAGER')
  })

  it('đổi trạng thái hoạt động', async () => {
    await renderCreate()
    fireEvent.change(screen.getByLabelText('active-label'), { target: { value: 'INACTIVE' } })
    expect(screen.getByLabelText('active-label')).toHaveValue('INACTIVE')
  })

  it('chặn lưu khi thiếu thông tin bắt buộc', async () => {
    await renderCreate()
    submitForm()

    expect(showToast).toHaveBeenCalledWith('Vui lòng điền đầy đủ các thông tin bắt buộc (*).', 'warning')
    expect(api.createEmailTemplate).not.toHaveBeenCalled()
  })

  it('tạo biểu mẫu với payload đã chuẩn hoá', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: '  Nhắc hạn  ' } })
    fireEvent.change(subjectInput(), { target: { value: '  Tiêu đề  ' } })
    fireEvent.change(bodyInput(), { target: { value: 'Nội dung email' } })
    submitForm()

    await waitFor(() => expect(api.createEmailTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Nhắc hạn', subject: 'Tiêu đề', body: 'Nội dung email',
      eventType: 'CME_HOURS_BELOW_REQUIREMENT', category: 'TRAINING', audience: 'EMPLOYEE',
      active: true, version: null,
    })))
    expect(showToast).toHaveBeenCalledWith('Tạo biểu mẫu email thành công!', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/notifications/email-templates')
  })

  it('báo lỗi khi tạo thất bại', async () => {
    api.createEmailTemplate.mockRejectedValue({ response: { data: { message: 'Mã đã tồn tại' } } })
    await renderCreate()
    fillRequired()
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mã đã tồn tại', 'error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('dùng thông báo mặc định khi lỗi không có nội dung', async () => {
    api.createEmailTemplate.mockRejectedValue(new Error('down'))
    await renderCreate()
    fillRequired()
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể lưu biểu mẫu email.', 'error'))
  })

  it('khoá nút trong lúc đang lưu', async () => {
    let resolveCreate
    api.createEmailTemplate.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    await renderCreate()
    fillRequired()
    submitForm()

    expect(await screen.findByRole('button', { name: 'Đang lưu...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Huỷ bỏ' })).toBeDisabled()
    await act(async () => { resolveCreate({ data: {} }) })
  })

  it('huỷ và quay lại danh sách', async () => {
    await renderCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ bỏ' }))
    expect(navigate).toHaveBeenCalledWith('/admin/notifications/email-templates')
  })
})

describe('EmailTemplateFormPage - danh mục sự kiện từ máy chủ', () => {
  it('thay danh sách sự kiện bằng cấu hình backend', async () => {
    api.getNotificationEvents.mockResolvedValue({
      data: { data: [
        { eventType: 'CME_HOURS_BELOW_REQUIREMENT', displayName: 'Cảnh báo thiếu giờ đào tạo', category: 'TRAINING', audiences: ['EMPLOYEE'], allowedVariables: ['recipient_name'] },
        { eventType: 'CUSTOM_EVENT', displayName: 'Sự kiện tuỳ chỉnh', category: 'QUALITY', audiences: ['MANAGER', 'EMPLOYEE'], allowedVariables: ['bien_tuy_chinh'] },
      ] },
    })
    await renderCreate()

    expect(await screen.findByRole('option', { name: 'Sự kiện tuỳ chỉnh' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('eventType-label'), { target: { value: 'CUSTOM_EVENT' } })
    expect(categoryInput()).toHaveValue('Chất lượng')
    expect(screen.getByRole('button', { name: '{{bien_tuy_chinh}}' })).toBeInTheDocument()
  })

  it('giữ danh sách mặc định khi backend trả về rỗng', async () => {
    await renderCreate()
    expect(screen.getByRole('option', { name: 'Cảnh báo thiếu giờ đào tạo' })).toBeInTheDocument()
  })

  it('vẫn dùng danh sách mặc định khi gọi API thất bại', async () => {
    api.getNotificationEvents.mockRejectedValue(new Error('down'))
    await renderCreate()
    expect(screen.getByRole('option', { name: 'Thông báo giao bài thi' })).toBeInTheDocument()
  })
})

describe('EmailTemplateFormPage - chèn biến', () => {
  it('chèn biến vào đúng vị trí con trỏ', async () => {
    await renderCreate()
    fireEvent.change(bodyInput(), { target: { value: 'Xin chào , bạn ơi' } })
    fireEvent.click(screen.getByRole('button', { name: '{{recipient_name}}' }))

    expect(bodyInput().value).toContain('{{recipient_name}}')
    expect(bodyInput().value).toContain('Xin chào')
  })

  it('thay thế phần văn bản đang bôi đen', async () => {
    await renderCreate()
    fireEvent.change(bodyInput(), { target: { value: 'AAA BBB' } })
    const textarea = bodyInput()
    textarea.selectionStart = 0
    textarea.selectionEnd = 3
    fireEvent.click(screen.getByRole('button', { name: '{{employee_name}}' }))

    expect(bodyInput()).toHaveValue('{{employee_name}} BBB')
  })

  it('hiển thị bộ biến theo sự kiện đang chọn', async () => {
    await renderCreate()
    expect(screen.getByRole('button', { name: '{{missing_hours}}' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('eventType-label'), { target: { value: 'EXAM_ASSIGNED' } })
    expect(screen.getByRole('button', { name: '{{exam_name}}' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '{{missing_hours}}' })).not.toBeInTheDocument()
  })
})

describe('EmailTemplateFormPage - chỉnh sửa', () => {
  it('nạp dữ liệu biểu mẫu và bộ biến được phép', async () => {
    await renderEdit()

    expect(api.getEmailTemplateById).toHaveBeenCalledWith('5')
    expect(codeInput()).toHaveValue('CUSTOM_NHAC_HAN')
    expect(subjectInput()).toHaveValue('Tiêu đề cũ')
    expect(bodyInput()).toHaveValue('Nội dung cũ')
    expect(categoryInput()).toHaveValue('Đánh giá')
    expect(screen.getByRole('button', { name: '{{exam_name}}' })).toBeInTheDocument()
  })

  it('không tự sinh lại mã khi sửa tên', async () => {
    await renderEdit()
    fireEvent.change(nameInput(), { target: { value: 'Tên hoàn toàn mới' } })
    expect(codeInput()).toHaveValue('CUSTOM_NHAC_HAN')
  })

  it('khoá mã, sự kiện và đối tượng với biểu mẫu hệ thống', async () => {
    api.getEmailTemplateById.mockResolvedValue({ data: { data: template({ systemManaged: true }) } })
    await renderEdit()

    expect(codeInput()).toBeDisabled()
    expect(screen.getByLabelText('eventType-label')).toBeDisabled()
    expect(screen.getByLabelText('audience-label')).toBeDisabled()
  })

  it('rơi về giá trị mặc định của sự kiện khi máy chủ thiếu dữ liệu', async () => {
    api.getEmailTemplateById.mockResolvedValue({
      data: { data: { id: 5, name: 'Thiếu dữ liệu', eventType: null, category: null, audience: null, code: null, subject: null, body: null, allowedVariables: null, version: null } },
    })
    route.params = { id: '5' }
    render(<EmailTemplateFormPage />)
    await waitFor(() => expect(nameInput()).toHaveValue('Thiếu dữ liệu'))

    expect(screen.getByLabelText('eventType-label')).toHaveValue('CME_HOURS_BELOW_REQUIREMENT')
    expect(categoryInput()).toHaveValue('Đào tạo')
    expect(screen.getByLabelText('audience-label')).toHaveValue('EMPLOYEE')
  })

  it('đổi sự kiện sẽ bỏ bộ biến riêng của biểu mẫu', async () => {
    await renderEdit()
    fireEvent.change(screen.getByLabelText('eventType-label'), { target: { value: 'CME_HOURS_BELOW_REQUIREMENT' } })

    expect(screen.getByRole('button', { name: '{{missing_hours}}' })).toBeInTheDocument()
  })

  it('đổi đối tượng nhận cũng bỏ bộ biến riêng', async () => {
    api.getEmailTemplateById.mockResolvedValue({
      data: { data: template({ eventType: 'CME_HOURS_BELOW_REQUIREMENT', category: 'TRAINING' }) },
    })
    await renderEdit()
    fireEvent.change(screen.getByLabelText('audience-label'), { target: { value: 'MANAGER' } })

    expect(screen.getByRole('button', { name: '{{missing_hours}}' })).toBeInTheDocument()
  })

  it('cập nhật biểu mẫu kèm số phiên bản', async () => {
    await renderEdit()
    fireEvent.change(subjectInput(), { target: { value: 'Tiêu đề mới' } })
    submitForm()

    await waitFor(() => expect(api.updateEmailTemplate).toHaveBeenCalledWith('5', expect.objectContaining({
      subject: 'Tiêu đề mới', version: 3,
    })))
    expect(showToast).toHaveBeenCalledWith('Cập nhật biểu mẫu email thành công!', 'success')
  })

  it('quay lại danh sách khi không tìm thấy biểu mẫu', async () => {
    api.getEmailTemplateById.mockResolvedValue({ data: { data: null } })
    route.params = { id: '5' }
    render(<EmailTemplateFormPage />)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy biểu mẫu email.', 'error'))
    expect(navigate).toHaveBeenCalledWith('/admin/notifications/email-templates')
  })

  it('quay lại danh sách khi tải biểu mẫu thất bại', async () => {
    api.getEmailTemplateById.mockRejectedValue(new Error('down'))
    route.params = { id: '5' }
    render(<EmailTemplateFormPage />)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/notifications/email-templates'))
  })

  it('hiện trạng thái đang tải dữ liệu biểu mẫu', async () => {
    let resolveTemplate
    api.getEmailTemplateById.mockReturnValue(new Promise((resolve) => { resolveTemplate = resolve }))
    route.params = { id: '5' }
    render(<EmailTemplateFormPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu biểu mẫu...')
    await act(async () => { resolveTemplate({ data: { data: template() } }) })
  })
})
