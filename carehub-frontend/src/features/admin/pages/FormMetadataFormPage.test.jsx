import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormMetadataFormPage from './FormMetadataFormPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const routeParams = { current: { id: '7' } }
const api = vi.hoisted(() => ({
  getFormById: vi.fn(),
  getFormVersions: vi.fn(),
  createForm: vi.fn(),
  updateForm: vi.fn(),
  createFormVersion: vi.fn(),
  publishFormVersion: vi.fn(),
  deleteFormVersion: vi.fn(),
  getFormScoringConfiguration: vi.fn(),
  updateFormScoringConfiguration: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => routeParams.current,
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Hủy xác nhận</button>
      <button onClick={onConfirm}>Đồng ý</button>
    </div>
  ) : null,
}))

const draftVersion = {
  id: 21, versionNumber: 2, status: 'DRAFT',
  createdAt: '2026-08-01T03:00:00Z', publishedAt: null, publishedBy: null,
}
const publishedVersion = {
  id: 20, versionNumber: 1, status: 'PUBLISHED',
  createdAt: '2026-07-01T03:00:00Z', publishedAt: '2026-07-05T03:00:00Z',
  publishedBy: { name: 'Nguyễn Quản Trị' },
  passingScore: 7, passingScoreOverride: null,
}
const retiredVersion = {
  id: 19, versionNumber: 0, status: 'RETIRED',
  createdAt: null, publishedAt: null, publishedBy: null, passingScore: 5,
}

const scoringConfiguration = {
  versionId: 20,
  criticalWeightPercent: 60,
  normalWeightPercent: 40,
  passingScore: 7,
  passingScoreOverride: null,
  lockVersion: 3,
}

const formPayload = {
  data: { data: { id: 7, code: 'HAND_HYGIENE_COMPLIANCE', title: 'Tuân thủ vệ sinh tay', description: 'Mô tả quy trình' } },
}
const versionsPayload = (content) => ({ data: { data: { content } } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  routeParams.current = { id: '7' }
  api.getFormById.mockResolvedValue(formPayload)
  api.getFormVersions.mockResolvedValue(versionsPayload([publishedVersion, draftVersion]))
  api.createForm.mockResolvedValue({ data: { data: { id: 99 } } })
  api.updateForm.mockResolvedValue({ data: { success: true } })
  api.createFormVersion.mockResolvedValue({ data: { data: { id: 22 } } })
  api.publishFormVersion.mockResolvedValue({ data: { success: true } })
  api.deleteFormVersion.mockResolvedValue({ data: { success: true } })
  api.getFormScoringConfiguration.mockResolvedValue({ data: { data: scoringConfiguration } })
  api.updateFormScoringConfiguration.mockResolvedValue({ data: { data: { recalculationScheduled: false } } })
})

afterEach(() => vi.restoreAllMocks())

const renderEdit = async () => {
  render(<FormMetadataFormPage />)
  await screen.findByDisplayValue('Tuân thủ vệ sinh tay')
}
const renderCreate = () => {
  routeParams.current = { id: 'new' }
  render(<FormMetadataFormPage />)
}

const codeInput = () => screen.getByPlaceholderText('Ví dụ: VE_SINH_TAY_LAM_SANG')
const titleInput = () => screen.getByPlaceholderText('Nhập tiêu đề đầy đủ của quy trình...')
const rowOfVersion = (label) => screen.getByText(label).closest('tr')

const openScoring = async () => {
  fireEvent.click(within(rowOfVersion('v1')).getByTitle('Thay đổi điểm sàn'))
  await screen.findByRole('dialog')
  expect(await screen.findByText('60%')).toBeInTheDocument()
}
const enableScoring = () => fireEvent.click(screen.getByRole('switch'))

describe('FormMetadataFormPage - chế độ tạo mới', () => {
  it('hiện tiêu đề đăng ký mới, không tải dữ liệu và ẩn khối phiên bản', () => {
    renderCreate()
    expect(screen.getByText('Đăng ký biểu mẫu mới')).toBeInTheDocument()
    expect(api.getFormById).not.toHaveBeenCalled()
    expect(api.getFormVersions).not.toHaveBeenCalled()
    expect(screen.queryByText('Danh sách phiên bản câu hỏi')).not.toBeInTheDocument()
    expect(codeInput()).toBeEnabled()
  })

  it('chuẩn hoá mã tiếng Việt thành chữ hoa không dấu khi rời ô nhập', () => {
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'Vệ sinh tay lâm sàng' } })
    fireEvent.blur(codeInput())
    expect(codeInput()).toHaveValue('VE_SINH_TAY_LAM_SANG')
  })

  it('cảnh báo khi thiếu mã hoặc tiêu đề', () => {
    renderCreate()
    fireEvent.submit(codeInput().closest('form'))
    expect(showToast).toHaveBeenCalledWith('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'warning')
    expect(api.createForm).not.toHaveBeenCalled()
  })

  it('cảnh báo khi mã sau chuẩn hoá ngắn hơn 2 ký tự', () => {
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: '@' } })
    fireEvent.change(titleInput(), { target: { value: 'Tiêu đề' } })
    fireEvent.submit(codeInput().closest('form'))

    expect(showToast).toHaveBeenCalledWith('Mã biểu mẫu cần có ít nhất 2 ký tự.', 'warning')
    expect(api.createForm).not.toHaveBeenCalled()
  })

  it('tạo biểu mẫu rồi chuyển sang trang chỉnh sửa của biểu mẫu mới', async () => {
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'Rửa tay ngoại khoa' } })
    fireEvent.change(titleInput(), { target: { value: 'Rửa tay ngoại khoa' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mục đích hoặc hướng dẫn áp dụng biểu mẫu...'), { target: { value: 'Ghi chú' } })
    fireEvent.submit(codeInput().closest('form'))

    await waitFor(() => expect(api.createForm).toHaveBeenCalledWith({
      code: 'RUA_TAY_NGOAI_KHOA',
      title: 'Rửa tay ngoại khoa',
      description: 'Ghi chú',
      subjectType: 'USER',
      ownerDepartmentId: null,
    }))
    expect(showToast).toHaveBeenCalledWith('Tạo biểu mẫu thành công!', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/99/edit')
  })

  it('gửi description null khi bỏ trống mô tả', async () => {
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Không mô tả' } })
    fireEvent.submit(codeInput().closest('form'))

    await waitFor(() => expect(api.createForm).toHaveBeenCalledWith(expect.objectContaining({ description: null })))
  })

  it('quay về danh sách khi máy chủ không trả về id biểu mẫu mới', async () => {
    api.createForm.mockResolvedValue({ data: { data: {} } })
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Không id' } })
    fireEvent.submit(codeInput().closest('form'))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists'))
  })

  it('hiện lỗi khi tạo biểu mẫu thất bại', async () => {
    api.createForm.mockRejectedValue({ response: { data: { message: 'Mã đã tồn tại' } } })
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Trùng mã' } })
    fireEvent.submit(codeInput().closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mã đã tồn tại')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('ghép chi tiết lỗi kiểm duyệt vào thông báo', async () => {
    api.createForm.mockRejectedValue({
      response: { data: { message: 'Dữ liệu không hợp lệ', details: [{ field: 'code', message: 'đã tồn tại' }] } },
    })
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Sai dữ liệu' } })
    fireEvent.submit(codeInput().closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu không hợp lệ: code: đã tồn tại')
  })

  it('dùng trường error khi phản hồi không có message', async () => {
    api.createForm.mockRejectedValue({ response: { data: { error: 'INTERNAL' } } })
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Lỗi hệ thống' } })
    fireEvent.submit(codeInput().closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent('INTERNAL')
  })

  it('rơi về thông báo mặc định khi lỗi không có response', async () => {
    api.createForm.mockRejectedValue(new Error('offline'))
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Mất mạng' } })
    fireEvent.submit(codeInput().closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra khi tạo mới biểu mẫu.')
  })

  it('khoá nút lưu trong lúc gửi', async () => {
    let resolveCreate
    api.createForm.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(titleInput(), { target: { value: 'Đang gửi' } })
    fireEvent.submit(codeInput().closest('form'))

    await waitFor(() => expect(codeInput().closest('form').querySelector('button[type="submit"]')).toBeDisabled())
    await act(async () => { resolveCreate({ data: { data: { id: 1 } } }) })
  })

  it('huỷ bỏ và quay lại danh sách checklist', () => {
    renderCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists')
  })
})

describe('FormMetadataFormPage - chế độ chỉnh sửa', () => {
  it('hiện trạng thái đang tải rồi đổ dữ liệu biểu mẫu vào form', async () => {
    render(<FormMetadataFormPage />)
    expect(screen.getByText('Đang tải thông tin biểu mẫu...')).toBeInTheDocument()

    await screen.findByDisplayValue('Tuân thủ vệ sinh tay')
    expect(api.getFormById).toHaveBeenCalledWith('7')
    expect(api.getFormVersions).toHaveBeenCalledWith('7', { page: 0, size: 100 })
    // mã legacy được đổi sang mã hiển thị tiếng Việt
    expect(codeInput()).toHaveValue('TUAN_THU_VE_SINH_TAY')
    expect(codeInput()).toBeDisabled()
    expect(screen.getByDisplayValue('Mô tả quy trình')).toBeInTheDocument()
    expect(screen.getByText('Thông tin cấu hình biểu mẫu')).toBeInTheDocument()
  })

  it('hiện lỗi khi phản hồi biểu mẫu rỗng', async () => {
    api.getFormById.mockResolvedValue({ data: { data: null } })
    render(<FormMetadataFormPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải thông tin biểu mẫu.')
  })

  it('hiện lỗi khi tải biểu mẫu thất bại', async () => {
    api.getFormById.mockRejectedValue({ response: { data: { message: 'Không tìm thấy biểu mẫu' } } })
    render(<FormMetadataFormPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy biểu mẫu')
  })

  it('để trống mô tả khi máy chủ trả về null', async () => {
    api.getFormById.mockResolvedValue({ data: { data: { id: 7, code: 'ABC', title: 'Không mô tả', description: null } } })
    render(<FormMetadataFormPage />)
    await screen.findByDisplayValue('Không mô tả')
    expect(screen.getByPlaceholderText('Nhập mục đích hoặc hướng dẫn áp dụng biểu mẫu...')).toHaveValue('')
  })

  it('cập nhật biểu mẫu rồi quay lại danh sách', async () => {
    await renderEdit()
    fireEvent.change(titleInput(), { target: { value: 'Tiêu đề đã sửa' } })
    fireEvent.submit(titleInput().closest('form'))

    await waitFor(() => expect(api.updateForm).toHaveBeenCalledWith('7', {
      title: 'Tiêu đề đã sửa',
      description: 'Mô tả quy trình',
      subjectType: 'USER',
      ownerDepartmentId: null,
    }))
    expect(showToast).toHaveBeenCalledWith('Cập nhật thông tin biểu mẫu thành công!', 'success')
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists')
  })

  it('hiện lỗi khi cập nhật thất bại', async () => {
    api.updateForm.mockRejectedValue({ response: { data: { message: 'Biểu mẫu đang khoá' } } })
    await renderEdit()
    fireEvent.submit(titleInput().closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Biểu mẫu đang khoá')
  })
})

describe('FormMetadataFormPage - danh sách phiên bản', () => {
  it('sắp xếp phiên bản giảm dần và hiển thị đầy đủ cột', async () => {
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('v2')).toBeInTheDocument()
    expect(within(rows[1]).getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('Bản nháp')).toBeInTheDocument()
    expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Quản Trị')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('hiện nhãn Lịch sử và mã trạng thái lạ', async () => {
    api.getFormVersions.mockResolvedValue(versionsPayload([retiredVersion, { ...draftVersion, id: 30, versionNumber: 9, status: 'UNKNOWN' }]))
    await renderEdit()
    expect(await screen.findByText('Lịch sử')).toBeInTheDocument()
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })

  it('hiện thông báo khi biểu mẫu chưa có phiên bản', async () => {
    api.getFormVersions.mockResolvedValue(versionsPayload([]))
    await renderEdit()
    expect(await screen.findByText(/Biểu mẫu chưa có phiên bản nào/)).toBeInTheDocument()
  })

  it('hiện lỗi khi phản hồi phiên bản không phải mảng', async () => {
    api.getFormVersions.mockResolvedValue({ data: { data: { content: null } } })
    await renderEdit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách phiên bản.')
  })

  it('hiện lỗi khi tải phiên bản thất bại', async () => {
    api.getFormVersions.mockRejectedValue({ response: { data: { message: 'Lỗi tải phiên bản' } } })
    await renderEdit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi tải phiên bản')
  })

  it('chỉ cho thiết kế, công bố, xoá với bản nháp', async () => {
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()

    const draftRow = rowOfVersion('v2')
    expect(within(draftRow).getByTitle('Thiết kế câu hỏi')).toBeInTheDocument()
    expect(within(draftRow).getByTitle('Công bố chính thức')).toBeInTheDocument()
    expect(within(draftRow).getByTitle('Xóa bản nháp')).toBeInTheDocument()

    const publishedRow = rowOfVersion('v1')
    expect(within(publishedRow).getByTitle('Thay đổi điểm sàn')).toBeInTheDocument()
    expect(within(publishedRow).getByTitle('Xem trước cấu trúc form')).toBeInTheDocument()
    expect(within(publishedRow).queryByTitle('Công bố chính thức')).not.toBeInTheDocument()
  })

  it('điều hướng sang trang thiết kế và trang xem trước', async () => {
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()

    fireEvent.click(within(rowOfVersion('v2')).getByTitle('Thiết kế câu hỏi'))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/7/builder/21')

    fireEvent.click(within(rowOfVersion('v1')).getByTitle('Xem trước cấu trúc form'))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/7/preview?versionId=20')
  })
})

describe('FormMetadataFormPage - thao tác phiên bản', () => {
  it('tạo bản nháp mới rồi tải lại danh sách', async () => {
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: /Tạo bản nháp mới/ }))

    await waitFor(() => expect(api.createFormVersion).toHaveBeenCalledWith('7', {}))
    expect(showToast).toHaveBeenCalledWith('Tạo bản nháp phiên bản mới thành công!', 'success')
    await waitFor(() => expect(api.getFormVersions).toHaveBeenCalledTimes(2))
  })

  it('hiện thông báo riêng khi đã có bản nháp chưa công bố', async () => {
    api.createFormVersion.mockRejectedValue({ response: { status: 409 } })
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: /Tạo bản nháp mới/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Biểu mẫu đang có một bản nháp chưa công bố')
  })

  it('hiện lỗi chung khi tạo bản nháp thất bại vì lý do khác', async () => {
    api.createFormVersion.mockRejectedValue({ response: { status: 500, data: { message: 'Lỗi máy chủ' } } })
    await renderEdit()
    fireEvent.click(screen.getByRole('button', { name: /Tạo bản nháp mới/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ')
  })

  it('công bố phiên bản sau khi xác nhận', async () => {
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v2')).getByTitle('Công bố chính thức'))

    const dialog = screen.getByRole('dialog', { name: 'Công bố phiên bản' })
    expect(within(dialog).getByText(/KHÔNG THỂ chỉnh sửa/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý' }))

    await waitFor(() => expect(api.publishFormVersion).toHaveBeenCalledWith('7', 21))
    expect(showToast).toHaveBeenCalledWith('Công bố phiên bản thành công!', 'success')
  })

  it('không công bố khi người dùng huỷ xác nhận', async () => {
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v2')).getByTitle('Công bố chính thức'))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy xác nhận' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.publishFormVersion).not.toHaveBeenCalled()
  })

  it('hiện lỗi khi công bố thất bại', async () => {
    api.publishFormVersion.mockRejectedValue({ response: { data: { message: 'Thiếu câu hỏi trọng yếu' } } })
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v2')).getByTitle('Công bố chính thức'))
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Thiếu câu hỏi trọng yếu')
  })

  it('xoá bản nháp sau khi xác nhận', async () => {
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v2')).getByTitle('Xóa bản nháp'))

    const dialog = screen.getByRole('dialog', { name: 'Xóa bản nháp' })
    expect(within(dialog).getByText(/xóa vĩnh viễn cấu trúc câu hỏi nháp/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý' }))

    await waitFor(() => expect(api.deleteFormVersion).toHaveBeenCalledWith('7', 21))
    expect(showToast).toHaveBeenCalledWith('Đã xóa bản nháp thành công!', 'success')
  })

  it('hiện lỗi khi xoá bản nháp thất bại', async () => {
    api.deleteFormVersion.mockRejectedValue(new Error('boom'))
    await renderEdit()
    expect(await screen.findByText('v2')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v2')).getByTitle('Xóa bản nháp'))
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xóa bản nháp.')
  })
})

describe('FormMetadataFormPage - cấu hình điểm sàn', () => {
  it('mở hộp thoại, nạp cấu hình và hiển thị tỷ lệ, điểm hiện tại', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()

    expect(api.getFormScoringConfiguration).toHaveBeenCalledWith('7', 20)
    expect(screen.getByText('Tuân thủ vệ sinh tay · v1')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('7.0/10')).toBeInTheDocument()
    // chưa bật cấu hình thì chưa có ô nhập điểm mới
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('hiện lỗi khi nạp cấu hình điểm thất bại', async () => {
    api.getFormScoringConfiguration.mockRejectedValue({ response: { data: { message: 'Không đọc được cấu hình' } } })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v1')).getByTitle('Thay đổi điểm sàn'))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Không đọc được cấu hình'))
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('hiện lỗi khi phản hồi cấu hình rỗng', async () => {
    api.getFormScoringConfiguration.mockResolvedValue({ data: { data: null } })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v1')).getByTitle('Thay đổi điểm sàn'))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert'))
      .toHaveTextContent('Không thể tải cấu hình điểm của phiên bản.'))
  })

  it('hiện gạch ngang khi tỷ lệ trọng số thiếu hoặc không phải số', async () => {
    api.getFormScoringConfiguration.mockResolvedValue({
      data: { data: { ...scoringConfiguration, criticalWeightPercent: null, normalWeightPercent: 'abc', passingScore: null } },
    })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v1')).getByTitle('Thay đổi điểm sàn'))

    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0))
    expect(screen.getByText('—/10')).toBeInTheDocument()
  })

  it('làm tròn một chữ số cho tỷ lệ lẻ', async () => {
    api.getFormScoringConfiguration.mockResolvedValue({
      data: { data: { ...scoringConfiguration, criticalWeightPercent: 66.666 } },
    })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v1')).getByTitle('Thay đổi điểm sàn'))

    expect(await screen.findByText('66.7%')).toBeInTheDocument()
  })

  it('bật công tắc mới hiện ô nhập và mở khoá nút lưu', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()

    expect(screen.getByRole('button', { name: /Thay đổi điểm sàn/ })).toBeDisabled()
    enableScoring()
    expect(screen.getByRole('spinbutton')).toHaveValue(7)
    expect(screen.getByRole('button', { name: /Thay đổi điểm sàn/ })).toBeEnabled()
  })

  it('tắt công tắc thì khôi phục điểm gốc và ẩn ô nhập', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } })

    enableScoring()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    enableScoring()
    expect(screen.getByRole('spinbutton')).toHaveValue(7)
  })

  it('từ chối điểm ngoài khoảng 0-10 hoặc quá một chữ số thập phân', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()

    for (const invalid of ['11', '-1', '7.55']) {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: invalid } })
      fireEvent.click(screen.getByRole('button', { name: /Thay đổi điểm sàn/ }))
      await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert'))
        .toHaveTextContent('Điểm sàn phải từ 0 đến 10 và có tối đa một chữ số thập phân.'))
      expect(api.updateFormScoringConfiguration).not.toHaveBeenCalled()
    }
  })

  it('lưu điểm sàn mới rồi đóng hộp thoại và tải lại phiên bản', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '8.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Thay đổi điểm sàn/ }))

    await waitFor(() => expect(api.updateFormScoringConfiguration).toHaveBeenCalledWith('7', 20, {
      passingScore: { mode: 'CUSTOM', value: 8.5 },
      lockVersion: 3,
    }))
    expect(showToast).toHaveBeenCalledWith('Đã thay đổi điểm sàn thành công.', 'success')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.getFormVersions).toHaveBeenCalledTimes(2)
  })

  it('thông báo riêng khi máy chủ tạo tác vụ tính lại kết quả', async () => {
    api.updateFormScoringConfiguration.mockResolvedValue({ data: { data: { recalculationScheduled: true } } })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()
    fireEvent.click(screen.getByRole('button', { name: /Thay đổi điểm sàn/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      'Đã tiếp nhận thay đổi điểm sàn và tạo tác vụ tính lại kết quả.', 'success',
    ))
  })

  it('lưu được bằng phím Enter trong ô nhập điểm', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })

    await waitFor(() => expect(api.updateFormScoringConfiguration).toHaveBeenCalled())
  })

  it('giữ hộp thoại mở và hiện lỗi khi lưu thất bại', async () => {
    api.updateFormScoringConfiguration.mockRejectedValue({ response: { data: { message: 'Phiên bản đã bị sửa nơi khác' } } })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()
    fireEvent.click(screen.getByRole('button', { name: /Thay đổi điểm sàn/ }))

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert'))
      .toHaveTextContent('Phiên bản đã bị sửa nơi khác'))
  })

  it('đóng hộp thoại bằng nút X, nút Hủy, phím Escape và click nền', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()

    await openScoring()
    fireEvent.click(screen.getByLabelText('Đóng cấu hình điểm sàn'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await openScoring()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await openScoring()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await openScoring()
    fireEvent.mouseDown(screen.getByRole('presentation'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('bỏ qua phím khác Escape và click vào bên trong hộp thoại', async () => {
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()

    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('khoá mọi thao tác trong lúc đang lưu điểm sàn', async () => {
    let resolveSave
    api.updateFormScoringConfiguration.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    await openScoring()
    enableScoring()
    fireEvent.click(screen.getByRole('button', { name: /Thay đổi điểm sàn/ }))

    await waitFor(() => expect(screen.getByLabelText('Đóng cấu hình điểm sàn')).toBeDisabled())
    expect(screen.getByRole('spinbutton')).toBeDisabled()
    // Escape và click nền bị vô hiệu khi đang lưu
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => { resolveSave({ data: { data: {} } }) })
  })

  it('ưu tiên passingScoreOverride khi mở hộp thoại', async () => {
    api.getFormScoringConfiguration.mockResolvedValue({
      data: { data: { ...scoringConfiguration, passingScoreOverride: 6.5 } },
    })
    await renderEdit()
    expect(await screen.findByText('v1')).toBeInTheDocument()
    fireEvent.click(within(rowOfVersion('v1')).getByTitle('Thay đổi điểm sàn'))
    expect(await screen.findByText('60%')).toBeInTheDocument()

    enableScoring()
    expect(screen.getByRole('spinbutton')).toHaveValue(6.5)
  })
})
