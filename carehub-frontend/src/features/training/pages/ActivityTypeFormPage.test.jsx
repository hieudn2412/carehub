import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityTypeFormPage from './ActivityTypeFormPage.jsx'

const navigate = vi.fn()
const route = { params: {} }
const api = vi.hoisted(() => ({
  getActivityType: vi.fn(),
  createActivityType: vi.fn(),
  updateActivityType: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useNavigate: () => navigate,
  useParams: () => route.params,
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))

const activityType = (overrides = {}) => ({
  id: 12, code: 'HOI_THAO', name: 'Hội thảo', description: 'Mô tả cũ',
  defaultDurationUnit: 'HOUR', requiresEvidence: true, maxCreditedHoursPerRecord: 8,
  sortOrder: 3, active: true, version: 2, usageCount: 0, ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = {}
  api.getActivityType.mockResolvedValue({ data: { data: activityType() } })
  api.createActivityType.mockResolvedValue({ data: { data: { id: 77 } } })
  api.updateActivityType.mockResolvedValue({ data: { data: { id: 12 } } })
})

const renderCreate = () => render(<ActivityTypeFormPage />)
const renderEdit = async () => {
  route.params = { id: '12' }
  render(<ActivityTypeFormPage />)
  await waitFor(() => expect(codeInput()).toHaveValue('HOI_THAO'))
}

const codeInput = () => screen.getByPlaceholderText('Ví dụ: HOI_THAO, TAP_HUAN')
const nameInput = () => screen.getByPlaceholderText('Nhập tên gọi cách thức...')
const descInput = () => screen.getByPlaceholderText('Mô tả tóm tắt ý nghĩa cách thức đào tạo này...')
const sortInput = () => screen.getByRole('spinbutton')
const evidenceCheck = () => screen.getByRole('checkbox', { name: /Bắt buộc cung cấp tài liệu minh chứng/ })
const activeCheck = () => screen.getByRole('checkbox', { name: /Kích hoạt sử dụng ngay/ })
const submitForm = () => fireEvent.submit(codeInput().closest('form'))

describe('ActivityTypeFormPage - tạo mới', () => {
  it('hiện biểu mẫu trống với giá trị mặc định', () => {
    renderCreate()

    expect(screen.getByText('Thêm cách thức đào tạo mới')).toBeInTheDocument()
    expect(api.getActivityType).not.toHaveBeenCalled()
    expect(codeInput()).toHaveValue('')
    expect(codeInput()).toBeEnabled()
    expect(sortInput()).toHaveValue(0)
    expect(evidenceCheck()).toBeChecked()
    expect(activeCheck()).toBeChecked()
  })

  it('tạo cách thức mới rồi mở trang chi tiết', async () => {
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'TAP_HUAN' } })
    fireEvent.change(nameInput(), { target: { value: 'Tập huấn' } })
    fireEvent.change(descInput(), { target: { value: 'Mô tả mới' } })
    fireEvent.change(sortInput(), { target: { value: '5' } })
    fireEvent.click(evidenceCheck())
    fireEvent.click(activeCheck())
    submitForm()

    await waitFor(() => expect(api.createActivityType).toHaveBeenCalledWith({
      code: 'TAP_HUAN', name: 'Tập huấn', description: 'Mô tả mới',
      defaultDurationUnit: 'HOUR', requiresEvidence: false,
      maxCreditedHoursPerRecord: null, sortOrder: 5, active: false, version: null,
    }))
    expect(navigate).toHaveBeenCalledWith('/admin/training/activity-types/77')
  })

  it('gửi description null khi bỏ trống mô tả', async () => {
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(nameInput(), { target: { value: 'Không mô tả' } })
    submitForm()

    await waitFor(() => expect(api.createActivityType).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
    ))
  })

  it('hiện lỗi khi tạo thất bại', async () => {
    api.createActivityType.mockRejectedValue({ response: { data: { message: 'Mã đã tồn tại' } } })
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(nameInput(), { target: { value: 'Trùng mã' } })
    submitForm()

    expect(await screen.findByText('Mã đã tồn tại')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('báo lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.createActivityType.mockRejectedValue(new Error('down'))
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(nameInput(), { target: { value: 'Mất mạng' } })
    submitForm()

    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })

  it('khoá nút lưu trong lúc gửi', async () => {
    let resolveCreate
    api.createActivityType.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    renderCreate()
    fireEvent.change(codeInput(), { target: { value: 'ABC' } })
    fireEvent.change(nameInput(), { target: { value: 'Đang lưu' } })
    submitForm()

    expect(await screen.findByRole('button', { name: 'Đang lưu...' })).toBeDisabled()
    await act(async () => { resolveCreate({ data: { data: { id: 1 } } }) })
  })

  it('có liên kết huỷ về danh sách', () => {
    renderCreate()
    expect(screen.getByRole('link', { name: 'Hủy bỏ' })).toHaveAttribute('href', '/admin/training/activity-types')
  })
})

describe('ActivityTypeFormPage - chỉnh sửa', () => {
  it('nạp dữ liệu cách thức vào biểu mẫu', async () => {
    await renderEdit()

    expect(api.getActivityType).toHaveBeenCalledWith('12')
    expect(screen.getByText('Cập nhật cách thức đào tạo')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Hội thảo')
    expect(descInput()).toHaveValue('Mô tả cũ')
    expect(sortInput()).toHaveValue(3)
    expect(evidenceCheck()).toBeChecked()
  })

  it('điền giá trị mặc định cho các trường máy chủ trả về null', async () => {
    api.getActivityType.mockResolvedValue({
      data: { data: { id: 12, code: null, name: null, description: null, defaultDurationUnit: null, requiresEvidence: null, maxCreditedHoursPerRecord: null, sortOrder: null, active: null, version: 1, usageCount: null } },
    })
    route.params = { id: '12' }
    render(<ActivityTypeFormPage />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())

    expect(codeInput()).toHaveValue('')
    expect(sortInput()).toHaveValue(0)
    expect(evidenceCheck()).not.toBeChecked()
    expect(activeCheck()).not.toBeChecked()
    expect(codeInput()).toBeEnabled()
  })

  it('khoá ô mã khi cách thức đã phát sinh dữ liệu', async () => {
    api.getActivityType.mockResolvedValue({ data: { data: activityType({ usageCount: 5 }) } })
    await renderEdit()

    expect(codeInput()).toBeDisabled()
    expect(screen.getByText(/đã phát sinh dữ liệu liên kết nên không thể đổi mã/)).toBeInTheDocument()
  })

  it('cập nhật cách thức kèm số phiên bản', async () => {
    await renderEdit()
    fireEvent.change(nameInput(), { target: { value: 'Hội thảo chuyên đề' } })
    submitForm()

    await waitFor(() => expect(api.updateActivityType).toHaveBeenCalledWith('12', expect.objectContaining({
      name: 'Hội thảo chuyên đề', version: 2, maxCreditedHoursPerRecord: 8,
    })))
    expect(navigate).toHaveBeenCalledWith('/admin/training/activity-types/12')
  })

  it('hiện lỗi khi tải chi tiết thất bại', async () => {
    api.getActivityType.mockRejectedValue({ response: { data: { message: 'Không tìm thấy' } } })
    route.params = { id: '12' }
    render(<ActivityTypeFormPage />)

    expect(await screen.findByText('Không tìm thấy')).toBeInTheDocument()
  })

  it('hiện trạng thái đang tải biểu mẫu', async () => {
    let resolveDetail
    api.getActivityType.mockReturnValue(new Promise((resolve) => { resolveDetail = resolve }))
    route.params = { id: '12' }
    render(<ActivityTypeFormPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông tin biểu mẫu...')
    await act(async () => { resolveDetail({ data: { data: activityType() } }) })
  })

  it('hiện lỗi khi cập nhật thất bại', async () => {
    api.updateActivityType.mockRejectedValue({ response: { data: { message: 'Xung đột phiên bản' } } })
    await renderEdit()
    submitForm()

    expect(await screen.findByText('Xung đột phiên bản')).toBeInTheDocument()
  })
})
