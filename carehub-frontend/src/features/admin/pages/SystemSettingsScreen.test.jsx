import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SystemSettingsScreen from './SystemSettingsScreen.jsx'

const showToast = vi.fn()
const shell = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ getSystemSettings: vi.fn(), updateSystemSettings: vi.fn() }))

vi.mock('../api/adminApi.js', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, breadcrumbs, title }) => {
    shell.current = { breadcrumbs, title }
    return <main>{children}</main>
  },
}))

const settings = (overrides = {}) => ({
  globalTrainingHours: 96,
  trainingWindowYears: 3,
  competencyTargetScore: 7,
  version: 4,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  shell.current = null
  api.getSystemSettings.mockResolvedValue({ data: { data: settings() } })
  api.updateSystemSettings.mockResolvedValue({ data: { data: settings({ globalTrainingHours: 100, trainingWindowYears: 4, competencyTargetScore: 8, version: 5 }) } })
})

const hoursInput = () => screen.getByLabelText('Mục tiêu giờ đào tạo toàn viện')
const yearsInput = () => screen.getByLabelText('Chu kỳ tính giờ đào tạo')
const scoreInput = () => screen.getByLabelText('Điểm sàn năng lực chuyên môn toàn viện')
const saveButton = () => screen.getByRole('button', { name: /Lưu cấu hình/ })
const resetButton = () => screen.getByRole('button', { name: 'Đặt lại mặc định' })

const renderTraining = async () => {
  render(<SystemSettingsScreen />)
  await waitFor(() => expect(hoursInput()).toHaveValue(96))
}
const renderCompetency = async () => {
  render(<SystemSettingsScreen mode="competency" />)
  await waitFor(() => expect(scoreInput()).toHaveValue(7))
}

describe('SystemSettingsScreen - chế độ giờ đào tạo', () => {
  it('tải và hiển thị cấu hình giờ đào tạo', async () => {
    render(<SystemSettingsScreen />)
    expect(screen.getByText(/Đang tải cấu hình/)).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    await waitFor(() => expect(hoursInput()).toHaveValue(96))
    expect(yearsInput()).toHaveValue(3)
    expect(screen.getAllByText(/3 năm/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Cấu hình giờ đào tạo' })).toBeInTheDocument()
    expect(shell.current.title).toBe('Cấu hình giờ đào tạo')
    expect(screen.queryByLabelText('Điểm sàn năng lực chuyên môn toàn viện')).not.toBeInTheDocument()
  })

  it('dùng giá trị mặc định khi máy chủ chưa có cấu hình', async () => {
    api.getSystemSettings.mockResolvedValue({ data: { data: null } })
    render(<SystemSettingsScreen />)

    await waitFor(() => expect(hoursInput()).toHaveValue(120))
    expect(yearsInput()).toHaveValue(5)
  })

  it('báo lỗi khi tải cấu hình thất bại', async () => {
    api.getSystemSettings.mockRejectedValue({ response: { status: 500, data: {} } })
    render(<SystemSettingsScreen />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Máy chủ đang gặp sự cố. Vui lòng thử lại sau', 'error'))
  })

  it('lưu cấu hình và cập nhật lại giá trị từ máy chủ', async () => {
    await renderTraining()
    fireEvent.change(hoursInput(), { target: { value: '150' } })
    fireEvent.change(yearsInput(), { target: { value: '6' } })
    fireEvent.click(saveButton())

    expect(screen.getByRole('button', { name: /Đang lưu/ })).toBeDisabled()
    await waitFor(() => expect(api.updateSystemSettings).toHaveBeenCalledWith({
      globalTrainingHours: 150, trainingWindowYears: 6, competencyTargetScore: 7, version: 4,
    }))
    await waitFor(() => expect(hoursInput()).toHaveValue(100))
    expect(showToast).toHaveBeenCalledWith('Đã cập nhật cấu hình giờ đào tạo.', 'success')
  })

  it('chặn lưu khi mục tiêu giờ nhỏ hơn 0,5', async () => {
    await renderTraining()
    fireEvent.change(hoursInput(), { target: { value: '0.2' } })
    fireEvent.click(saveButton())

    expect(showToast).toHaveBeenCalledWith('Mục tiêu giờ đào tạo phải từ 0,5 giờ trở lên.', 'warning')
    expect(api.updateSystemSettings).not.toHaveBeenCalled()
  })

  it('chặn lưu khi mục tiêu giờ để trống', async () => {
    await renderTraining()
    fireEvent.change(hoursInput(), { target: { value: '' } })
    fireEvent.click(saveButton())

    expect(showToast).toHaveBeenCalledWith('Mục tiêu giờ đào tạo phải từ 0,5 giờ trở lên.', 'warning')
  })

  it.each([
    ['0', 'nhỏ hơn 1'],
    ['101', 'lớn hơn 100'],
    ['2.5', 'không phải số nguyên'],
  ])('chặn lưu khi chu kỳ %s (%s)', async (value) => {
    await renderTraining()
    fireEvent.change(yearsInput(), { target: { value } })
    fireEvent.click(saveButton())

    expect(showToast).toHaveBeenCalledWith('Chu kỳ đào tạo phải là số nguyên từ 1 đến 100 năm.', 'warning')
    expect(api.updateSystemSettings).not.toHaveBeenCalled()
  })

  it('báo lỗi khi lưu thất bại', async () => {
    api.updateSystemSettings.mockRejectedValue(new Error('down'))
    await renderTraining()
    fireEvent.click(saveButton())

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại', 'error',
    ))
    expect(saveButton()).toBeEnabled()
  })

  it('đặt lại cấu hình giờ đào tạo về mặc định', async () => {
    await renderTraining()
    fireEvent.click(resetButton())

    expect(hoursInput()).toHaveValue(120)
    expect(yearsInput()).toHaveValue(5)
  })
})

describe('SystemSettingsScreen - chế độ năng lực', () => {
  it('tải và hiển thị điểm sàn năng lực', async () => {
    render(<SystemSettingsScreen mode="competency" />)
    expect(screen.getByText(/Đang tải cấu hình/)).toBeInTheDocument()

    await waitFor(() => expect(scoreInput()).toHaveValue(7))
    expect(screen.getByRole('heading', { name: 'Cấu hình năng lực chuyên môn', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Thiết lập điểm sàn năng lực chuyên môn áp dụng chung cho toàn viện.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Mục tiêu giờ đào tạo toàn viện')).not.toBeInTheDocument()
  })

  it('lưu điểm sàn năng lực', async () => {
    await renderCompetency()
    fireEvent.change(scoreInput(), { target: { value: '8.5' } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(api.updateSystemSettings).toHaveBeenCalledWith({
      globalTrainingHours: 96, trainingWindowYears: 3, competencyTargetScore: 8.5, version: 4,
    }))
    expect(showToast).toHaveBeenCalledWith('Đã cập nhật cấu hình năng lực chuyên môn.', 'success')
  })

  it.each(['-1', '11'])('chặn lưu khi điểm sàn không hợp lệ (%s)', async (value) => {
    await renderCompetency()
    fireEvent.change(scoreInput(), { target: { value } })
    fireEvent.click(saveButton())

    expect(showToast).toHaveBeenCalledWith('Điểm sàn năng lực phải nằm trong khoảng 0 đến 10.', 'warning')
    expect(api.updateSystemSettings).not.toHaveBeenCalled()
  })

  it('không áp dụng ràng buộc giờ đào tạo ở chế độ năng lực', async () => {
    api.getSystemSettings.mockResolvedValue({ data: { data: settings({ globalTrainingHours: 0 }) } })
    await renderCompetency()
    fireEvent.click(saveButton())

    await waitFor(() => expect(api.updateSystemSettings).toHaveBeenCalled())
  })

  it('đặt lại điểm sàn về mặc định', async () => {
    await renderCompetency()
    fireEvent.change(scoreInput(), { target: { value: '9' } })
    fireEvent.click(resetButton())

    expect(scoreInput()).toHaveValue(6)
  })
})
