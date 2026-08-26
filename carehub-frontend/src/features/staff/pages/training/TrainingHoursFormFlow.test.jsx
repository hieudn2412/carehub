import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingHoursFormScreen from './TrainingHoursFormScreen.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const route = { params: {} }
const api = vi.hoisted(() => ({
  getRecordOptions: vi.fn(),
  getMyTrainingStatus: vi.fn(),
  getRecord: vi.fn(),
  createRecord: vi.fn(),
  updateRecord: vi.fn(),
  submitRecord: vi.fn(),
  listEvidence: vi.fn(),
  uploadEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
  createEvidencePreviewUrl: vi.fn(),
  createEvidenceDownloadUrl: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
}))
vi.mock('../../../../features/training/api/trainingApi', () => ({ trainingApi: api }))
vi.mock('../../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Ngày đào tạo" type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))

const TODAY = (() => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
})()

const activityTypes = [{ id: 1, name: 'Đào tạo trực tiếp' }, { id: 2, name: 'Hội thảo trực tuyến' }]
const professionalFields = [{ id: 9, name: 'Kiểm soát nhiễm khuẩn' }, { id: 10, name: 'Hồi sức cấp cứu' }]

const draftRecord = {
  id: 55, title: 'Khoá cấp cứu', startDate: '2026-08-01', declaredHours: 8,
  activityTypeId: 1, professionalFieldId: 9, description: 'Ghi chú cũ',
  workflowStatus: 'DRAFT', version: 3,
}

const makeFile = (name = 'minh-chung.pdf', type = 'application/pdf', size = 1024) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  route.params = {}
  api.getRecordOptions.mockResolvedValue({ data: { data: { activityTypes, professionalFields } } })
  api.getMyTrainingStatus.mockResolvedValue({ data: { data: { cycleYears: 5 } } })
  api.getRecord.mockResolvedValue({ data: { data: draftRecord } })
  api.createRecord.mockResolvedValue({ data: { data: { id: 77, version: 1 } } })
  api.updateRecord.mockResolvedValue({ data: { data: { id: 55, version: 4 } } })
  api.submitRecord.mockResolvedValue({ data: { data: {} } })
  api.listEvidence.mockResolvedValue({ data: { data: [] } })
  api.uploadEvidence.mockResolvedValue({ data: { data: {} } })
  api.deleteEvidence.mockResolvedValue({ data: { data: {} } })
  api.createEvidencePreviewUrl.mockResolvedValue({ data: { data: { downloadUrl: 'https://r2/preview' } } })
  api.createEvidenceDownloadUrl.mockResolvedValue({ data: { data: { downloadUrl: 'https://r2/download' } } })
})

afterEach(() => {
  console.error.mockRestore?.()
})

const renderCreate = async () => {
  render(<TrainingHoursFormScreen />)
  await screen.findByText('Thêm hồ sơ đào tạo')
}
const renderEdit = async () => {
  route.params = { id: '55' }
  render(<TrainingHoursFormScreen />)
  await screen.findByText('Chỉnh sửa hồ sơ đào tạo')
}

const nameInput = () => screen.getByPlaceholderText('Ví dụ: Hồi sức cấp cứu cơ bản')
const hoursInput = () => screen.getByPlaceholderText('Ví dụ: 1.5, 8, 12.5')
const notesInput = () => screen.getByPlaceholderText('Mô tả ngắn gọn về nội dung...')
const dateInput = () => screen.getByLabelText('Ngày đào tạo')
const dropdownTrigger = (placeholderOrLabel) => screen.getByText(placeholderOrLabel).closest('div[role="button"]')
const pickDropdown = (placeholder, optionName) => {
  fireEvent.click(dropdownTrigger(placeholder))
  fireEvent.click(screen.getByText(optionName))
}
const fillValidForm = () => {
  fireEvent.change(nameInput(), { target: { value: 'Khoá hồi sức' } })
  fireEvent.change(hoursInput(), { target: { value: '8' } })
  pickDropdown('Chọn hình thức', 'Đào tạo trực tiếp')
}
const saveDraft = () => fireEvent.click(screen.getByRole('button', { name: /Lưu nháp/ }))
const saveAndSubmit = () => fireEvent.click(screen.getByRole('button', { name: /Lưu và nộp/ }))
const fileInput = () => document.querySelector('input[type="file"]')

describe('TrainingHoursFormScreen - khởi tạo', () => {
  it('nạp hình thức, lĩnh vực và chu kỳ đào tạo', async () => {
    render(<TrainingHoursFormScreen />)
    expect(screen.getByText('Đang tải thông tin biểu mẫu...')).toBeInTheDocument()

    await screen.findByText('Thêm hồ sơ đào tạo')
    expect(api.getRecordOptions).toHaveBeenCalled()
    expect(api.getMyTrainingStatus).toHaveBeenCalled()
    expect(dateInput()).toHaveValue(TODAY)
  })

  it('vẫn hiển thị biểu mẫu khi nạp tuỳ chọn thất bại', async () => {
    api.getRecordOptions.mockRejectedValue(new Error('down'))
    await renderCreate()
    expect(screen.getByText('Chọn hình thức')).toBeInTheDocument()
  })

  it('bỏ qua chu kỳ đào tạo không hợp lệ', async () => {
    api.getMyTrainingStatus.mockResolvedValue({ data: { data: { cycleYears: 0 } } })
    await renderCreate()
    fillValidForm()
    fireEvent.change(dateInput(), { target: { value: '2000-01-01' } })
    saveAndSubmit()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalled())
  })

  it('bỏ qua lỗi khi lấy chu kỳ đào tạo', async () => {
    api.getMyTrainingStatus.mockRejectedValue(new Error('down'))
    await renderCreate()
    expect(screen.getByText('Thêm hồ sơ đào tạo')).toBeInTheDocument()
  })

  it('quay lại danh sách khi bấm Huỷ bỏ và nút quay lại di động', async () => {
    await renderCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ bỏ' }))
    expect(navigate).toHaveBeenCalledWith('/staff/training')

    fireEvent.click(screen.getByLabelText('Quay lại danh sách giờ đào tạo'))
    expect(navigate).toHaveBeenCalledWith('/staff/training')
  })
})

describe('TrainingHoursFormScreen - kiểm tra dữ liệu', () => {
  it('báo lỗi khi bỏ trống các trường bắt buộc', async () => {
    await renderCreate()
    saveDraft()

    expect(screen.getAllByText('Bắt buộc nhập').length).toBeGreaterThan(0)
    expect(screen.getByText('Bắt buộc chọn hình thức')).toBeInTheDocument()
    expect(api.createRecord).not.toHaveBeenCalled()
  })

  it('chặn ngày đào tạo trong tương lai', async () => {
    await renderCreate()
    fillValidForm()
    fireEvent.change(dateInput(), { target: { value: '2099-01-01' } })
    saveDraft()

    expect(screen.getByText('Ngày đào tạo không được vượt quá ngày hôm nay')).toBeInTheDocument()
    expect(api.createRecord).not.toHaveBeenCalled()
  })

  it('chặn nộp hồ sơ quá chu kỳ đào tạo', async () => {
    await renderCreate()
    fillValidForm()
    fireEvent.change(dateInput(), { target: { value: '2000-01-01' } })
    saveAndSubmit()

    expect(screen.getByText('Hồ sơ đào tạo quá 5 năm không được phép nộp.')).toBeInTheDocument()
    expect(api.createRecord).not.toHaveBeenCalled()
  })

  it('vẫn cho lưu nháp hồ sơ cũ hơn chu kỳ', async () => {
    await renderCreate()
    fillValidForm()
    fireEvent.change(dateInput(), { target: { value: '2000-01-01' } })
    saveDraft()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalled())
  })

  it('xoá lỗi số giờ ngay khi người dùng sửa lại hợp lệ', async () => {
    await renderCreate()
    fireEvent.change(hoursInput(), { target: { value: '-2' } })
    saveDraft()
    expect(screen.getByRole('alert')).toHaveTextContent('Số giờ đào tạo không được là số âm.')

    fireEvent.change(hoursInput(), { target: { value: '4' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('giữ lỗi khi sửa số giờ sang giá trị vẫn sai', async () => {
    await renderCreate()
    fireEvent.change(hoursInput(), { target: { value: '-2' } })
    saveDraft()
    fireEvent.change(hoursInput(), { target: { value: '-5' } })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('TrainingHoursFormScreen - lĩnh vực chuyên môn tự đề xuất', () => {
  const openCustomModal = () => {
    fireEvent.click(dropdownTrigger('Chọn lĩnh vực chuyên môn'))
    fireEvent.click(screen.getByText('+ Khác (Tự đề xuất lĩnh vực mới)'))
  }

  it('mở hộp thoại đề xuất và bắt buộc nhập tên', async () => {
    await renderCreate()
    openCustomModal()

    expect(screen.getByText('Đề xuất lĩnh vực chuyên môn mới')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(screen.getByText('Vui lòng nhập tên lĩnh vực chuyên môn mới')).toBeInTheDocument()
  })

  it('chặn tên lĩnh vực dài quá 255 ký tự', async () => {
    await renderCreate()
    openCustomModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Chăm sóc giảm nhẹ nhi khoa...'), { target: { value: 'x'.repeat(256) } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

    expect(screen.getByText('Lĩnh vực chuyên môn không được vượt quá 255 ký tự')).toBeInTheDocument()
  })

  it('lưu lĩnh vực đề xuất và gửi kèm khi tạo hồ sơ', async () => {
    await renderCreate()
    openCustomModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Chăm sóc giảm nhẹ nhi khoa...'), { target: { value: '  Chăm sóc giảm nhẹ  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

    expect(screen.getByText(/Lĩnh vực đề xuất:/)).toBeInTheDocument()
    fillValidForm()
    saveDraft()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      professionalFieldId: null,
      customProfessionalField: 'Chăm sóc giảm nhẹ',
    })))
  })

  it('đóng hộp thoại khi bấm Hủy bỏ', async () => {
    await renderCreate()
    openCustomModal()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))

    expect(screen.queryByText('Đề xuất lĩnh vực chuyên môn mới')).not.toBeInTheDocument()
  })

  it('nạp lại tên đã đề xuất khi mở lại hộp thoại', async () => {
    await renderCreate()
    openCustomModal()
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Chăm sóc giảm nhẹ nhi khoa...'), { target: { value: 'Lần đầu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))

    fireEvent.click(dropdownTrigger('Khác: Lần đầu'))
    fireEvent.click(screen.getByText('+ Khác (Tự đề xuất lĩnh vực mới)'))
    expect(screen.getByPlaceholderText('Ví dụ: Chăm sóc giảm nhẹ nhi khoa...')).toHaveValue('Lần đầu')
  })

  it('gửi id lĩnh vực khi chọn từ danh sách có sẵn', async () => {
    await renderCreate()
    fillValidForm()
    pickDropdown('Chọn lĩnh vực chuyên môn', 'Kiểm soát nhiễm khuẩn')
    saveDraft()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      professionalFieldId: 9, customProfessionalField: null,
    })))
  })

  it('tìm kiếm trong danh sách lĩnh vực và báo khi không có kết quả', async () => {
    await renderCreate()
    fireEvent.click(dropdownTrigger('Chọn lĩnh vực chuyên môn'))
    const search = screen.getByPlaceholderText('Tìm kiếm...')

    fireEvent.change(search, { target: { value: 'hồi sức' } })
    expect(screen.getByText('Hồi sức cấp cứu')).toBeInTheDocument()
    expect(screen.queryByText('Kiểm soát nhiễm khuẩn')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'không có' } })
    expect(screen.getByText('Không tìm thấy kết quả')).toBeInTheDocument()
  })

  it('đóng danh sách khi bấm ra ngoài', async () => {
    await renderCreate()
    fireEvent.click(dropdownTrigger('Chọn hình thức'))
    expect(screen.getByPlaceholderText('Tìm kiếm...')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByPlaceholderText('Tìm kiếm...')).not.toBeInTheDocument())
  })

  it('mở danh sách bằng bàn phím', async () => {
    await renderCreate()
    fireEvent.keyDown(dropdownTrigger('Chọn hình thức'), { key: 'Enter' })
    expect(screen.getByPlaceholderText('Tìm kiếm...')).toBeInTheDocument()
  })
})

describe('TrainingHoursFormScreen - lưu nháp và nộp hồ sơ', () => {
  it('tạo hồ sơ nháp mới với payload đầy đủ', async () => {
    await renderCreate()
    fillValidForm()
    fireEvent.change(notesInput(), { target: { value: 'Ghi chú' } })
    saveDraft()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalledWith({
      title: 'Khoá hồi sức',
      startDate: TODAY,
      declaredHours: 8,
      activityTypeId: 1,
      professionalFieldId: null,
      customProfessionalField: null,
      description: 'Ghi chú',
      durationValue: 8,
      durationUnit: 'HOUR',
      version: undefined,
    }))
    expect(showToast).toHaveBeenCalledWith('Lưu bản nháp thành công!', 'success')
    expect(navigate).toHaveBeenCalledWith('/staff/training')
  })

  it('gửi description null khi bỏ trống ghi chú', async () => {
    await renderCreate()
    fillValidForm()
    saveDraft()

    await waitFor(() => expect(api.createRecord).toHaveBeenCalledWith(expect.objectContaining({ description: null })))
  })

  it('báo lỗi và không điều hướng khi lưu thất bại', async () => {
    api.createRecord.mockRejectedValue({ response: { data: { message: 'Trùng hồ sơ' } } })
    await renderCreate()
    fillValidForm()
    saveDraft()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Trùng hồ sơ', 'error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('nộp hồ sơ sau khi lưu nháp thành công', async () => {
    await renderCreate()
    fillValidForm()
    saveAndSubmit()

    await waitFor(() => expect(api.submitRecord).toHaveBeenCalledWith(77, { version: 3 }))
    expect(showToast).toHaveBeenCalledWith('Nộp hồ sơ thành công!', 'success')
    expect(navigate).toHaveBeenCalledWith('/staff/training')
  })

  it('báo rõ khi lưu được nháp nhưng nộp thất bại', async () => {
    api.submitRecord.mockRejectedValue({ response: { data: { message: 'Hết hạn nộp' } } })
    await renderCreate()
    fillValidForm()
    saveAndSubmit()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Đã lưu bản nháp nhưng nộp hồ sơ thất bại: Hết hạn nộp'), 'error',
    ))
    expect(navigate).toHaveBeenCalledWith('/staff/training')
  })

  it('khoá nút trong lúc đang lưu', async () => {
    let resolveCreate
    api.createRecord.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    await renderCreate()
    fillValidForm()
    saveDraft()

    expect(await screen.findAllByText('Đang lưu...')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Huỷ bỏ' })).toBeDisabled()
    await act(async () => { resolveCreate({ data: { data: { id: 1, version: 1 } } }) })
  })
})

describe('TrainingHoursFormScreen - chế độ chỉnh sửa', () => {
  it('nạp dữ liệu hồ sơ nháp vào biểu mẫu', async () => {
    await renderEdit()

    expect(api.getRecord).toHaveBeenCalledWith('55')
    expect(nameInput()).toHaveValue('Khoá cấp cứu')
    expect(hoursInput()).toHaveValue(8)
    expect(dateInput()).toHaveValue('2026-08-01')
    expect(screen.getByText('Đào tạo trực tiếp')).toBeInTheDocument()
    expect(screen.getByText('Kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(notesInput()).toHaveValue('Ghi chú cũ')
  })

  it('chặn sửa hồ sơ đã nộp', async () => {
    api.getRecord.mockResolvedValue({ data: { data: { ...draftRecord, workflowStatus: 'SUBMITTED' } } })
    route.params = { id: '55' }
    render(<TrainingHoursFormScreen />)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Chỉ có thể chỉnh sửa hồ sơ ở trạng thái Bản nháp.', 'warning'))
    expect(navigate).toHaveBeenCalledWith('/staff/training')
  })

  it('báo lỗi khi không tải được hồ sơ', async () => {
    api.getRecord.mockRejectedValue(new Error('down'))
    route.params = { id: '55' }
    render(<TrainingHoursFormScreen />)

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể tải thông tin hồ sơ để chỉnh sửa.', 'error'))
  })

  it('chịu được hồ sơ thiếu trường và phản hồi rỗng', async () => {
    api.getRecord.mockResolvedValue({ data: { data: { id: 55, workflowStatus: 'DRAFT' } } })
    await renderEdit()
    expect(nameInput()).toHaveValue('')
    expect(hoursInput()).toHaveValue(null)
  })

  it('cập nhật hồ sơ kèm số phiên bản', async () => {
    await renderEdit()
    fireEvent.change(nameInput(), { target: { value: 'Tên mới' } })
    saveDraft()

    await waitFor(() => expect(api.updateRecord).toHaveBeenCalledWith('55', expect.objectContaining({
      title: 'Tên mới', version: 3,
    })))
    expect(showToast).toHaveBeenCalledWith('Cập nhật bản nháp thành công!', 'success')
  })

  it('nút quay lại trỏ về trang chi tiết hồ sơ', async () => {
    await renderEdit()
    fireEvent.click(screen.getByLabelText('Quay lại danh sách giờ đào tạo'))
    expect(navigate).toHaveBeenCalledWith('/staff/training/55')
  })
})

describe('TrainingHoursFormScreen - minh chứng', () => {
  it('chọn tệp hợp lệ và hiển thị thẻ xem trước', async () => {
    await renderCreate()
    fireEvent.change(fileInput(), { target: { files: [makeFile()] } })

    expect(await screen.findByText('File sẽ tải lên (1):')).toBeInTheDocument()
    expect(screen.getByText('minh-chung.pdf')).toBeInTheDocument()
    expect(screen.getByText('1.0 KB')).toBeInTheDocument()
  })

  it('hiển thị ảnh xem trước cho tệp ảnh', async () => {
    window.URL.createObjectURL = vi.fn(() => 'blob:preview')
    window.URL.revokeObjectURL = vi.fn()
    await renderCreate()
    fireEvent.change(fileInput(), { target: { files: [makeFile('anh.png', 'image/png', 2048)] } })

    expect(await screen.findByAltText('Ảnh minh chứng anh.png')).toHaveAttribute('src', 'blob:preview')
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('từ chối tệp sai định dạng và hiện lỗi', async () => {
    await renderCreate()
    fireEvent.change(fileInput(), { target: { files: [makeFile('bang-luong.xlsx', 'application/vnd.ms-excel')] } })

    expect(await screen.findByText('Tệp "bang-luong.xlsx" không đúng định dạng PDF, JPG hoặc PNG.')).toBeInTheDocument()
    expect(screen.queryByText('File sẽ tải lên (1):')).not.toBeInTheDocument()
  })

  it('xoá tệp đã chọn khỏi danh sách', async () => {
    window.URL.createObjectURL = vi.fn(() => 'blob:preview')
    window.URL.revokeObjectURL = vi.fn()
    await renderCreate()
    fireEvent.change(fileInput(), { target: { files: [makeFile('anh.png', 'image/png')] } })
    await screen.findByText('File sẽ tải lên (1):')

    fireEvent.click(screen.getByLabelText('Xóa tệp anh.png'))
    await waitFor(() => expect(screen.queryByText('File sẽ tải lên (1):')).not.toBeInTheDocument())
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('nhận tệp qua kéo thả và bỏ trạng thái kéo khi rời vùng', async () => {
    await renderCreate()
    const dropzone = screen.getByLabelText('Chọn tệp minh chứng')

    fireEvent.dragOver(dropzone)
    expect(dropzone.className).toContain('evidence-dropzone--active')
    fireEvent.dragLeave(dropzone)
    expect(dropzone.className).not.toContain('evidence-dropzone--active')

    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } })
    expect(await screen.findByText('File sẽ tải lên (1):')).toBeInTheDocument()
  })

  it('mở hộp chọn tệp bằng chuột và bàn phím', async () => {
    await renderCreate()
    const clickSpy = vi.spyOn(fileInput(), 'click').mockImplementation(() => {})
    const dropzone = screen.getByLabelText('Chọn tệp minh chứng')

    fireEvent.click(dropzone)
    fireEvent.keyDown(dropzone, { key: 'Enter' })
    fireEvent.keyDown(dropzone, { key: ' ' })
    fireEvent.keyDown(dropzone, { key: 'Tab' })

    expect(clickSpy).toHaveBeenCalledTimes(3)
  })

  it('tải minh chứng lên sau khi lưu hồ sơ', async () => {
    await renderCreate()
    fillValidForm()
    fireEvent.change(fileInput(), { target: { files: [makeFile()] } })
    await screen.findByText('File sẽ tải lên (1):')
    saveDraft()

    await waitFor(() => expect(api.uploadEvidence).toHaveBeenCalledWith(77, expect.any(File)))
    expect(showToast).toHaveBeenCalledWith('Lưu bản nháp thành công!', 'success')
  })

  it('cảnh báo khi có tệp tải lên thất bại', async () => {
    api.uploadEvidence.mockRejectedValue(new Error('down'))
    await renderCreate()
    fillValidForm()
    fireEvent.change(fileInput(), { target: { files: [makeFile()] } })
    await screen.findByText('File sẽ tải lên (1):')
    saveDraft()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã lưu bản nháp (0 file tải lên, 1 thất bại)', 'warning'))
  })

  it('cảnh báo tệp lỗi khi nộp hồ sơ', async () => {
    api.uploadEvidence.mockRejectedValue(new Error('down'))
    await renderCreate()
    fillValidForm()
    fireEvent.change(fileInput(), { target: { files: [makeFile()] } })
    await screen.findByText('File sẽ tải lên (1):')
    saveAndSubmit()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      'Nộp hồ sơ thành công! (1 file minh chứng tải lên thất bại)', 'warning',
    ))
  })
})

describe('TrainingHoursFormScreen - minh chứng đã có (chỉnh sửa)', () => {
  const existing = [{ id: 900, originalFilename: 'giay-chung-nhan.pdf', storedSize: 2048, originalSize: 4096 }]

  beforeEach(() => {
    api.listEvidence.mockResolvedValue({ data: { data: existing } })
  })

  it('hiển thị minh chứng đã tải lên', async () => {
    await renderEdit()
    expect(await screen.findByText('File đã tải lên (1):')).toBeInTheDocument()
    expect(screen.getByText('giay-chung-nhan.pdf')).toBeInTheDocument()
  })

  it('bỏ qua lỗi khi không tải được danh sách minh chứng', async () => {
    api.listEvidence.mockRejectedValue(new Error('down'))
    await renderEdit()
    expect(screen.queryByText('File đã tải lên (1):')).not.toBeInTheDocument()
  })

  it('mở minh chứng ở tab mới', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => {})
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Xem minh chứng'))

    await waitFor(() => expect(api.createEvidencePreviewUrl).toHaveBeenCalledWith('55', 900))
    expect(open).toHaveBeenCalledWith('https://r2/preview', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })

  it('báo lỗi khi máy chủ không trả về liên kết xem', async () => {
    api.createEvidencePreviewUrl.mockResolvedValue({ data: { data: {} } })
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Xem minh chứng'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể mở minh chứng.', 'error'))
  })

  it('báo lỗi khi gọi liên kết xem thất bại', async () => {
    api.createEvidencePreviewUrl.mockRejectedValue(new Error('down'))
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Xem minh chứng'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể mở minh chứng.', 'error'))
  })

  it('tải minh chứng về máy', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => {})
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Tải về'))

    await waitFor(() => expect(api.createEvidenceDownloadUrl).toHaveBeenCalledWith('55', 900))
    expect(open).toHaveBeenCalledWith('https://r2/download', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })

  it('báo lỗi khi tải minh chứng thất bại', async () => {
    api.createEvidenceDownloadUrl.mockRejectedValue(new Error('down'))
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Tải về'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể tải minh chứng.', 'error'))
  })

  it('báo lỗi khi máy chủ không trả về liên kết tải', async () => {
    api.createEvidenceDownloadUrl.mockResolvedValue({ data: { data: { downloadUrl: null } } })
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Tải về'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể tải minh chứng.', 'error'))
  })

  it('xoá minh chứng cũ khi lưu lại hồ sơ', async () => {
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Xoá'))
    expect(screen.queryByText('File đã tải lên (1):')).not.toBeInTheDocument()

    saveDraft()
    await waitFor(() => expect(api.deleteEvidence).toHaveBeenCalledWith(55, 900))
  })

  it('cảnh báo khi xoá minh chứng thất bại', async () => {
    api.deleteEvidence.mockRejectedValue(new Error('down'))
    await renderEdit()
    await screen.findByText('File đã tải lên (1):')
    fireEvent.click(screen.getByTitle('Xoá'))
    saveDraft()

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã lưu bản nháp (0 file tải lên, 1 thất bại)', 'warning'))
  })
})

describe('TrainingHoursFormScreen - luồng nhiều bước trên di động', () => {
  const nextStep = () => fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))
  const prevStep = () => fireEvent.click(screen.getByRole('button', { name: /Trước/ }))

  it('chặn sang bước 2 khi thiếu thông tin bước 1', async () => {
    await renderCreate()
    nextStep()

    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getAllByText('Bắt buộc nhập').length).toBeGreaterThan(0)
  })

  it('chặn sang bước 2 khi ngày vượt quá hôm nay', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Khoá A' } })
    fireEvent.change(hoursInput(), { target: { value: '4' } })
    fireEvent.change(dateInput(), { target: { value: '2099-01-01' } })
    nextStep()

    expect(screen.getByText('Ngày đào tạo không được vượt quá ngày hôm nay')).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('đi hết ba bước rồi quay lại', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Khoá A' } })
    fireEvent.change(hoursInput(), { target: { value: '4' } })
    nextStep()
    expect(screen.getByText('2/3')).toBeInTheDocument()

    pickDropdown('Chọn hình thức', 'Đào tạo trực tiếp')
    nextStep()
    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nộp/ })).toBeInTheDocument()

    prevStep()
    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trước/ })).toBeEnabled()
  })

  it('chặn sang bước 3 khi chưa chọn hình thức', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Khoá A' } })
    fireEvent.change(hoursInput(), { target: { value: '4' } })
    nextStep()
    nextStep()

    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(screen.getByText('Bắt buộc chọn hình thức')).toBeInTheDocument()
  })

  it('nhảy thẳng tới bước qua thanh chỉ dẫn', async () => {
    await renderCreate()
    fireEvent.click(within(screen.getByLabelText('Các bước thêm hồ sơ đào tạo')).getByText('Minh chứng'))
    expect(screen.getByText('3/3')).toBeInTheDocument()
  })

  it('lưu nháp và nộp được từ bước cuối', async () => {
    await renderCreate()
    fillValidForm()
    fireEvent.click(within(screen.getByLabelText('Các bước thêm hồ sơ đào tạo')).getByText('Minh chứng'))
    fireEvent.click(screen.getByRole('button', { name: /Nháp/ }))

    await waitFor(() => expect(api.createRecord).toHaveBeenCalled())
  })

  it('đưa về đúng bước có lỗi khi lưu từ bước khác', async () => {
    await renderCreate()
    fireEvent.change(nameInput(), { target: { value: 'Khoá A' } })
    fireEvent.change(hoursInput(), { target: { value: '4' } })
    fireEvent.click(within(screen.getByLabelText('Các bước thêm hồ sơ đào tạo')).getByText('Minh chứng'))
    saveDraft()

    // thiếu hình thức đào tạo -> quay về bước 2
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })
})

describe('TrainingHoursFormScreen - bộ chọn ngày trên di động', () => {
  const openSheet = () => fireEvent.click(screen.getByLabelText(new RegExp('^Chọn ngày đào tạo')))

  it('mở bảng chọn ngày với ngày hiện tại', async () => {
    await renderCreate()
    openSheet()

    const dialog = screen.getByRole('dialog')
    const [year, month, day] = TODAY.split('-')
    expect(within(dialog).getByText('Ngày đào tạo liên tục')).toBeInTheDocument()
    expect(within(dialog).getByText(`Tháng ${Number(month)}`)).toBeInTheDocument()
    expect(within(dialog).getByText(year)).toBeInTheDocument()
    expect(within(dialog).getByText(day)).toBeInTheDocument()
  })

  it('chọn ngày mới rồi áp dụng vào biểu mẫu', async () => {
    await renderCreate()
    fireEvent.change(dateInput(), { target: { value: '2026-03-15' } })
    openSheet()

    const yearSelect = screen.getByText('Năm').parentElement
    fireEvent.click(within(yearSelect).getByRole('button'))
    fireEvent.click(within(yearSelect).getByRole('option', { name: String(new Date().getFullYear() - 1) }))

    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(dateInput()).toHaveValue(`${new Date().getFullYear() - 1}-03-15`)
  })

  it('nút Hôm nay đưa bản nháp về ngày hiện tại', async () => {
    await renderCreate()
    fireEvent.change(dateInput(), { target: { value: '2026-01-05' } })
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày' }))

    await waitFor(() => expect(dateInput()).toHaveValue(TODAY))
  })

  it('đóng bảng bằng nút X và bằng nền', async () => {
    await renderCreate()
    openSheet()
    fireEvent.click(screen.getByLabelText('Đóng bộ chọn ngày'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    openSheet()
    fireEvent.click(screen.getByRole('dialog').parentElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('không đóng khi bấm vào bên trong bảng', async () => {
    await renderCreate()
    openSheet()
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('đóng danh sách chọn khi bấm ra ngoài', async () => {
    await renderCreate()
    openSheet()
    const daySelect = screen.getByText('Ngày').parentElement
    fireEvent.click(within(daySelect).getByRole('button'))
    expect(within(daySelect).getByRole('listbox')).toBeInTheDocument()

    fireEvent.click(document.body)
    await waitFor(() => expect(within(daySelect).queryByRole('listbox')).not.toBeInTheDocument())
  })
})
