import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClassificationRuleFormPage from './ClassificationRuleFormPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const route = { params: {} }
const ruleApi = vi.hoisted(() => ({
  getRule: vi.fn(), createRule: vi.fn(), updateRule: vi.fn(), testRule: vi.fn(),
}))
const categoryApi = vi.hoisted(() => ({ listCategories: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
}))
vi.mock('../api/classificationRuleApi.js', () => ({ classificationRuleApi: ruleApi }))
vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: categoryApi }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ value, onChange, options, disabled }) => (
    <select
      aria-label={options[0]?.label === 'Chọn danh mục' ? 'Danh mục câu hỏi' : 'Trạng thái quy tắc'}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const rule = (overrides = {}) => ({
  id: 12, name: 'Nhận diện người bệnh', enabled: true, categoryId: 4,
  keywords: 'nhận diện, vòng tay', sourcePattern: 'an toàn người bệnh', priority: 5, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = {}
  categoryApi.listCategories.mockResolvedValue({
    data: { data: [{ id: 4, name: 'An toàn người bệnh' }, { id: 5, name: 'Kiểm soát nhiễm khuẩn' }] },
  })
  ruleApi.getRule.mockResolvedValue({ data: { data: rule() } })
  ruleApi.createRule.mockResolvedValue({ data: { success: true } })
  ruleApi.updateRule.mockResolvedValue({ data: { success: true } })
  ruleApi.testRule.mockResolvedValue({
    data: { data: { categoryName: 'An toàn người bệnh', ruleName: 'Nhận diện người bệnh', confidence: 0.865, reason: 'Khớp từ khoá "vòng tay"' } },
  })
})

const renderCreate = async () => {
  render(<ClassificationRuleFormPage />)
  await screen.findByText('Thêm quy tắc phân loại')
  await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('4'))
}
const renderEdit = async () => {
  route.params = { id: '12' }
  render(<ClassificationRuleFormPage />)
  await screen.findByText('Cập nhật quy tắc phân loại')
  await waitFor(() => expect(nameInput()).toHaveValue('Nhận diện người bệnh'))
}

const nameInput = () => screen.getByPlaceholderText('Ví dụ: Nhận diện người bệnh')
const keywordsInput = () => screen.getByPlaceholderText(/Mỗi dòng hoặc dấu phẩy là một từ khóa/)
const sourceInput = () => screen.getByPlaceholderText('Ví dụ: an toàn người bệnh, quy trình nhận diện')
const priorityInput = () => screen.getByPlaceholderText('Số lớn hơn được ưu tiên trước')
const submitForm = () => fireEvent.submit(nameInput().closest('form'))

describe('ClassificationRuleFormPage - tạo mới', () => {
  it('nạp danh mục và chọn sẵn danh mục đầu tiên', async () => {
    await renderCreate()

    expect(categoryApi.listCategories).toHaveBeenCalledWith({ status: 'ACTIVE' })
    expect(ruleApi.getRule).not.toHaveBeenCalled()
    expect(screen.getByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    expect(screen.getByLabelText('Trạng thái quy tắc')).toHaveValue('true')
  })

  it('để trống danh mục khi hệ thống chưa có danh mục nào', async () => {
    categoryApi.listCategories.mockResolvedValue({ data: { data: [] } })
    render(<ClassificationRuleFormPage />)
    await screen.findByText('Thêm quy tắc phân loại')

    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('')
  })

  it.each([
    ['tên quy tắc', () => fireEvent.change(nameInput(), { target: { value: '   ' } }), 'Vui lòng nhập tên quy tắc.'],
    ['danh mục', () => fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '' } }), 'Vui lòng chọn danh mục câu hỏi.'],
  ])('chặn lưu khi thiếu %s', async (_label, mutate, message) => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Quy tắc A' } })
    fireEvent.change(keywordsInput(), { target: { value: 'từ khoá' } })
    mutate()
    submitForm()

    expect(showToast).toHaveBeenCalledWith(message, 'warning')
    expect(ruleApi.createRule).not.toHaveBeenCalled()
  })

  it('chặn lưu khi thiếu từ khoá phân loại', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Quy tắc A' } })
    fireEvent.change(keywordsInput(), { target: { value: '   ' } })
    submitForm()

    expect(showToast).toHaveBeenCalledWith('Vui lòng nhập từ khóa phân loại.', 'warning')
    expect(ruleApi.createRule).not.toHaveBeenCalled()
  })

  it('tạo quy tắc với payload đã chuẩn hoá', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: '  Quy tắc mới  ' } })
    fireEvent.change(keywordsInput(), { target: { value: '  vòng tay, mã bệnh nhân  ' } })
    fireEvent.change(sourceInput(), { target: { value: '  quy trình  ' } })
    fireEvent.change(priorityInput(), { target: { value: '7' } })
    await waitFor(() => expect(screen.getByLabelText('Danh mục câu hỏi').querySelector('option[value="5"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Danh mục câu hỏi'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Trạng thái quy tắc'), { target: { value: 'false' } })
    submitForm()

    await waitFor(() => expect(ruleApi.createRule).toHaveBeenCalledWith({
      name: 'Quy tắc mới', categoryId: 5, keywords: 'vòng tay, mã bệnh nhân',
      sourcePattern: 'quy trình', priority: 7, enabled: false,
    }))
    expect(showToast).toHaveBeenCalledWith('Đã tạo quy tắc phân loại.', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/classification-rules')
  })

  it('coi ưu tiên không phải số là 0', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Quy tắc A' } })
    fireEvent.change(keywordsInput(), { target: { value: 'từ khoá' } })
    fireEvent.change(priorityInput(), { target: { value: '' } })
    submitForm()

    await waitFor(() => expect(ruleApi.createRule).toHaveBeenCalledWith(expect.objectContaining({ priority: 0 })))
  })

  it('báo lỗi khi tạo quy tắc thất bại', async () => {
    ruleApi.createRule.mockRejectedValue({ response: { data: { message: 'Tên quy tắc đã tồn tại' } } })
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Trùng tên' } })
    fireEvent.change(keywordsInput(), { target: { value: 'từ khoá' } })
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tên quy tắc đã tồn tại', 'error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('khoá biểu mẫu trong lúc đang lưu', async () => {
    let resolveCreate
    ruleApi.createRule.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Đang lưu' } })
    fireEvent.change(keywordsInput(), { target: { value: 'từ khoá' } })
    submitForm()

    expect(await screen.findByRole('button', { name: 'Đang lưu...' })).toBeDisabled()
    expect(nameInput()).toBeDisabled()
    await act(async () => { resolveCreate({ data: {} }) })
  })

  it('huỷ và quay lại danh sách quy tắc', async () => {
    await renderCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/classification-rules')
  })

  it('báo lỗi khi nạp dữ liệu ban đầu thất bại', async () => {
    categoryApi.listCategories.mockRejectedValue({ response: { data: { message: 'Không tải được danh mục' } } })
    render(<ClassificationRuleFormPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tải được danh mục', 'error'))
  })
})

describe('ClassificationRuleFormPage - chỉnh sửa', () => {
  it('nạp dữ liệu quy tắc vào biểu mẫu', async () => {
    await renderEdit()

    expect(ruleApi.getRule).toHaveBeenCalledWith('12')
    expect(keywordsInput()).toHaveValue('nhận diện, vòng tay')
    expect(sourceInput()).toHaveValue('an toàn người bệnh')
    expect(priorityInput()).toHaveValue(5)
    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('4')
  })

  it('điền giá trị mặc định cho các trường máy chủ trả về rỗng', async () => {
    ruleApi.getRule.mockResolvedValue({
      data: { data: { id: 12, name: 'Quy tắc trống', enabled: false, categoryId: null, keywords: null, sourcePattern: null, priority: null } },
    })
    route.params = { id: '12' }
    render(<ClassificationRuleFormPage />)
    await waitFor(() => expect(nameInput()).toHaveValue('Quy tắc trống'))

    expect(keywordsInput()).toHaveValue('')
    expect(priorityInput()).toHaveValue(0)
    expect(screen.getByLabelText('Trạng thái quy tắc')).toHaveValue('false')
    expect(screen.getByLabelText('Danh mục câu hỏi')).toHaveValue('')
  })

  it('cập nhật quy tắc rồi quay lại danh sách', async () => {
    await renderEdit()
    fireEvent.change(nameInput(), { target: { value: 'Tên đã sửa' } })
    submitForm()

    await waitFor(() => expect(ruleApi.updateRule).toHaveBeenCalledWith('12', expect.objectContaining({ name: 'Tên đã sửa' })))
    expect(showToast).toHaveBeenCalledWith('Đã cập nhật quy tắc phân loại.', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/classification-rules')
  })

  it('báo lỗi khi cập nhật thất bại', async () => {
    ruleApi.updateRule.mockRejectedValue(new Error('down'))
    await renderEdit()
    submitForm()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })
})

describe('ClassificationRuleFormPage - kiểm tra nhanh', () => {
  const testTextInput = () => screen.getByPlaceholderText('Dán nội dung câu hỏi hoặc trích đoạn nguồn...')
  const testSourceInput = () => screen.getByPlaceholderText('Tên tài liệu hoặc section')
  const runTest = () => fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }))

  it('cảnh báo khi chưa nhập nội dung lẫn nguồn', async () => {
    await renderCreate()
    runTest()

    expect(showToast).toHaveBeenCalledWith('Nhập nội dung hoặc nguồn tài liệu để kiểm tra.', 'warning')
    expect(ruleApi.testRule).not.toHaveBeenCalled()
  })

  it('gửi nội dung và nguồn rồi hiển thị kết quả', async () => {
    await renderCreate()
    fireEvent.change(testTextInput(), { target: { value: 'Kiểm tra vòng tay người bệnh' } })
    fireEvent.change(testSourceInput(), { target: { value: 'Quy trình A' } })
    runTest()

    await waitFor(() => expect(ruleApi.testRule).toHaveBeenCalledWith({
      stem: 'Kiểm tra vòng tay người bệnh', sourceDocument: 'Quy trình A',
    }))
    expect(await screen.findByText('Kết quả: An toàn người bệnh')).toBeInTheDocument()
    expect(screen.getByText('Nhận diện người bệnh')).toBeInTheDocument()
    expect(screen.getByText(/Độ tin cậy: 87%/)).toBeInTheDocument()
  })

  it('chỉ cần một trong hai ô để chạy kiểm tra', async () => {
    await renderCreate()
    fireEvent.change(testSourceInput(), { target: { value: 'Chỉ có nguồn' } })
    runTest()

    await waitFor(() => expect(ruleApi.testRule).toHaveBeenCalled())
  })

  it('hiện nhãn mặc định khi không khớp quy tắc nào', async () => {
    ruleApi.testRule.mockResolvedValue({ data: { data: { categoryName: null, ruleName: null, confidence: null, reason: 'Không có quy tắc phù hợp' } } })
    await renderCreate()
    fireEvent.change(testTextInput(), { target: { value: 'Nội dung lạ' } })
    runTest()

    expect(await screen.findByText('Kết quả: Chưa phân loại')).toBeInTheDocument()
    expect(screen.getByText('Không khớp')).toBeInTheDocument()
    expect(screen.getByText(/Độ tin cậy: 0%/)).toBeInTheDocument()
  })

  it('báo lỗi khi kiểm tra thất bại', async () => {
    ruleApi.testRule.mockRejectedValue({ response: { data: { message: 'Dịch vụ phân loại lỗi' } } })
    await renderCreate()
    fireEvent.change(testTextInput(), { target: { value: 'Nội dung' } })
    runTest()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Dịch vụ phân loại lỗi', 'error'))
    expect(screen.queryByText(/Kết quả:/)).not.toBeInTheDocument()
  })

  it('khoá nút trong lúc đang kiểm tra', async () => {
    let resolveTest
    ruleApi.testRule.mockReturnValue(new Promise((resolve) => { resolveTest = resolve }))
    await renderCreate()
    fireEvent.change(testTextInput(), { target: { value: 'Nội dung' } })
    runTest()

    expect(await screen.findByRole('button', { name: 'Đang kiểm tra...' })).toBeDisabled()
    await act(async () => { resolveTest({ data: { data: {} } }) })
  })
})
