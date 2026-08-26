import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityTypeDetailPage from './ActivityTypeDetailPage.jsx'

const api = vi.hoisted(() => ({ getActivityType: vi.fn(), updateActivityTypeStatus: vi.fn() }))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>,
  useParams: () => ({ id: '12' }),
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))

const detail = (overrides = {}) => ({
  id: 12, code: 'HOI_THAO', name: 'Hội thảo', description: 'Mô tả cách thức',
  active: true, requiresEvidence: true, sortOrder: 3, usageCount: 7, version: 2,
  createdAt: '2026-08-01T03:00:00Z', updatedAt: '2026-08-20T03:00:00Z',
  recentRecords: [
    { id: 1, title: 'Khoá cấp cứu', employeeCode: 'NV001', employeeName: 'Nguyễn Văn A', startDate: '2026-08-01', declaredHours: 8, workflowStatus: 'SUBMITTED' },
    { id: 2, title: 'Khoá vô khuẩn', employeeCode: 'NV002', employeeName: 'Trần Thị B', startDate: '2026-08-05', declaredHours: null, workflowStatus: 'DRAFT' },
  ],
  auditTimeline: [
    { id: 10, changeType: 'CREATED', changedAt: '2026-08-01T03:00:00Z', changedByName: 'Quản trị viên' },
    { id: 11, changeType: 'UPDATED', changedAt: '2026-08-10T03:00:00Z', changedByName: null, changedByUserId: 5 },
    { id: 12, changeType: 'DEACTIVATED', changedAt: null, changedByName: null, changedByUserId: null },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  api.getActivityType.mockResolvedValue({ data: { data: detail() } })
  api.updateActivityTypeStatus.mockResolvedValue({ data: { success: true } })
})

afterEach(() => { window.confirm.mockRestore?.() })

const renderPage = async () => {
  render(<ActivityTypeDetailPage />)
  await screen.findByText('HOI_THAO')
}

describe('ActivityTypeDetailPage - hiển thị chi tiết', () => {
  it('tải và hiển thị đầy đủ các khối thông tin', async () => {
    render(<ActivityTypeDetailPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông tin chi tiết...')

    await screen.findByText('HOI_THAO')
    expect(api.getActivityType).toHaveBeenCalledWith('12')
    expect(screen.getByText('Hội thảo')).toBeInTheDocument()
    expect(screen.getByText('Mô tả cách thức')).toBeInTheDocument()
    expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Bắt buộc')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('điền gạch ngang cho mô tả và giờ khai báo còn trống', async () => {
    api.getActivityType.mockResolvedValue({
      data: { data: detail({ description: null, createdAt: null, updatedAt: null }) },
    })
    await renderPage()

    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3)
  })

  it('hiển thị nhãn ngưng sử dụng và không bắt buộc minh chứng', async () => {
    api.getActivityType.mockResolvedValue({ data: { data: detail({ active: false, requiresEvidence: false }) } })
    await renderPage()

    expect(screen.getByText('Ngưng sử dụng')).toBeInTheDocument()
    expect(screen.getByText('Không bắt buộc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kích hoạt' })).toBeInTheDocument()
  })

  it('liệt kê hồ sơ đào tạo gần đây', async () => {
    await renderPage()

    expect(screen.getByText('Khoá cấp cứu')).toBeInTheDocument()
    expect(screen.getByText('NV001 - Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument()
    expect(within(screen.getByText('Khoá vô khuẩn').closest('tr')).getByText('-')).toBeInTheDocument()
  })

  it('hiện thông báo khi chưa có hồ sơ nào áp dụng', async () => {
    api.getActivityType.mockResolvedValue({ data: { data: detail({ recentRecords: [] }) } })
    await renderPage()
    expect(screen.getByText('Chưa có hồ sơ đào tạo nào áp dụng cách thức này.')).toBeInTheDocument()
  })

  it('hiển thị lịch sử thay đổi kèm người thực hiện', async () => {
    await renderPage()

    expect(screen.getByText('CREATED')).toBeInTheDocument()
    expect(screen.getByText(/Thực hiện bởi: Quản trị viên/)).toBeInTheDocument()
    // thiếu tên thì rơi về id người dùng
    expect(screen.getByText(/Thực hiện bởi: 5/)).toBeInTheDocument()
    // thiếu cả hai thì hiện gạch ngang dài
    expect(screen.getByText(/Thực hiện bởi: —/)).toBeInTheDocument()
  })

  it('hiện thông báo khi chưa có lịch sử thay đổi', async () => {
    api.getActivityType.mockResolvedValue({ data: { data: detail({ auditTimeline: [] }) } })
    await renderPage()
    expect(screen.getByText('Chưa có lịch sử thay đổi nào được lưu lại.')).toBeInTheDocument()
  })

  it('tạo liên kết sang trang chỉnh sửa', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: 'Chỉnh sửa' }))
      .toHaveAttribute('href', '/admin/training/activity-types/12/edit')
  })

  it('hiện lỗi kèm nút thử lại khi tải chi tiết thất bại', async () => {
    api.getActivityType.mockRejectedValueOnce({ response: { data: { message: 'Không tìm thấy' } } })
    render(<ActivityTypeDetailPage />)

    expect(await screen.findByText('Không tìm thấy')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('HOI_THAO')
  })
})

describe('ActivityTypeDetailPage - đổi trạng thái', () => {
  it('hỏi xác nhận rồi ngừng kích hoạt và tải lại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ngưng hoạt động' }))

    expect(window.confirm).toHaveBeenCalledWith('Bạn muốn ngừng kích hoạt loại "Hội thảo"?')
    await waitFor(() => expect(api.updateActivityTypeStatus).toHaveBeenCalledWith(12, { active: false, version: 2 }))
    await waitFor(() => expect(api.getActivityType).toHaveBeenCalledTimes(2))
  })

  it('kích hoạt lại cách thức đang ngưng', async () => {
    api.getActivityType.mockResolvedValue({ data: { data: detail({ active: false }) } })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt' }))

    expect(window.confirm).toHaveBeenCalledWith('Bạn muốn kích hoạt loại "Hội thảo"?')
    await waitFor(() => expect(api.updateActivityTypeStatus).toHaveBeenCalledWith(12, { active: true, version: 2 }))
  })

  it('không gọi API khi người dùng huỷ xác nhận', async () => {
    window.confirm.mockReturnValue(false)
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ngưng hoạt động' }))

    expect(api.updateActivityTypeStatus).not.toHaveBeenCalled()
  })

  it('hiện lỗi khi đổi trạng thái thất bại', async () => {
    api.updateActivityTypeStatus.mockRejectedValue({ response: { data: { message: 'Đang được sử dụng' } } })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ngưng hoạt động' }))

    expect(await screen.findByText('Đang được sử dụng')).toBeInTheDocument()
  })

  it('báo lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.updateActivityTypeStatus.mockRejectedValue(new Error('down'))
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ngưng hoạt động' }))

    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })
})
