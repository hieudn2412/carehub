import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityTypeListPage from './ActivityTypeListPage.jsx'
import { trainingApi } from '../api/trainingApi.js'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../api/trainingApi.js', () => ({
  trainingApi: {
    getActivityTypes: vi.fn(),
    createActivityType: vi.fn(),
    updateActivityType: vi.fn(),
  },
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('ActivityTypeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getActivityTypes.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 1,
            name: 'Đào tạo trực tiếp',
            description: 'Học tập trung tại bệnh viện',
            maxCreditedHoursPerRecord: 8,
            active: true,
          }],
          totalElements: 1,
          totalPages: 1,
        },
      },
    })
  })

  it('uses the new page name and omits the credited-hours column', async () => {
    render(<ActivityTypeListPage />)

    expect(await screen.findByRole('heading', { name: 'Cách thức đào tạo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tên cách thức' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Quy tắc tính giờ' })).not.toBeInTheDocument()
    expect(screen.queryByText('Tối đa 8 giờ')).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
  })

  it('only requests filtered data after the draft filters are applied', async () => {
    render(<ActivityTypeListPage />)

    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm cách thức đào tạo' }), { target: { value: 'trực tiếp' } })
    expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hoạt động' }))
    expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(2))
    expect(trainingApi.getActivityTypes).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'trực tiếp',
      isActive: true,
    }))
  })
})

const item = (id, overrides = {}) => ({
  id,
  code: `ATC_${id}`,
  name: `Cách thức ${id}`,
  description: `Mô tả ${id}`,
  defaultDurationUnit: 'HOUR',
  requiresEvidence: true,
  maxCreditedHoursPerRecord: 8,
  sortOrder: id,
  active: true,
  version: 2,
  ...overrides,
})

const pageData = (content, overrides = {}) => ({
  data: { data: { content, totalElements: content.length, totalPages: 1, ...overrides } },
})

const listQuery = (overrides = {}) => ({
  keyword: undefined, isActive: undefined, page: 0, size: 10, sort: 'sortOrder,asc', ...overrides,
})

const renderPage = async () => {
  render(<ActivityTypeListPage />)
  await screen.findByText('Cách thức 1')
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const pickOption = (comboboxName, optionName) => {
  fireEvent.click(screen.getByRole('combobox', { name: comboboxName }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}
const nameInput = () => screen.getByPlaceholderText('Nhập tên cách thức đào tạo...')
const modal = () => document.querySelector('.atl-modal')

describe('ActivityTypeListPage - danh sách', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getActivityTypes.mockResolvedValue(pageData([item(1), item(2, { active: false, description: null })]))
    trainingApi.createActivityType.mockResolvedValue({})
    trainingApi.updateActivityType.mockResolvedValue({})
  })

  afterEach(() => vi.useRealTimers())

  it('tải và hiển thị danh sách cách thức đào tạo', async () => {
    render(<ActivityTypeListPage />)
    await screen.findByText('Cách thức 1')

    expect(trainingApi.getActivityTypes).toHaveBeenCalledWith(listQuery())
    expect(screen.getAllByText('Hoạt động').length).toBeGreaterThan(0)
    expect(screen.getByText('Ngưng')).toBeInTheDocument()
    expect(screen.getByText('Mô tả 1')).toBeInTheDocument()
    expect(screen.getByText('-')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 2 trong tổng số 2 kết quả')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có dữ liệu', async () => {
    trainingApi.getActivityTypes.mockResolvedValue(pageData([]))
    render(<ActivityTypeListPage />)
    expect(await screen.findByText('Chưa có cách thức đào tạo nào.')).toBeInTheDocument()
  })

  it('hiện thông báo riêng khi lọc không có kết quả', async () => {
    await renderPage()
    trainingApi.getActivityTypes.mockResolvedValue(pageData([]))
    openFilters()
    pickOption('Trạng thái', 'Ngưng hoạt động')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByText('Không tìm thấy kết quả phù hợp.')).toBeInTheDocument()
  })

  it('chịu được phản hồi thiếu dữ liệu phân trang', async () => {
    trainingApi.getActivityTypes.mockResolvedValue({ data: { data: null } })
    render(<ActivityTypeListPage />)
    expect(await screen.findByText('Chưa có cách thức đào tạo nào.')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải danh sách thất bại', async () => {
    trainingApi.getActivityTypes.mockRejectedValue({ response: { status: 403, data: {} } })
    render(<ActivityTypeListPage />)
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này')).toBeInTheDocument()
  })

  it('hiện lỗi mặc định khi máy chủ không phản hồi', async () => {
    trainingApi.getActivityTypes.mockRejectedValue(new Error('down'))
    render(<ActivityTypeListPage />)
    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })

  it('lọc theo trạng thái ngưng hoạt động', async () => {
    await renderPage()
    openFilters()
    pickOption('Trạng thái', 'Ngưng hoạt động')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledWith(listQuery({ isActive: false })))
  })

  it('xoá bộ lọc và về trạng thái ban đầu', async () => {
    await renderPage()
    openFilters()
    pickOption('Trạng thái', 'Hoạt động')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenLastCalledWith(listQuery()))
  })

  it('tìm kiếm với độ trễ 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ActivityTypeListPage />)
    await screen.findByText('Cách thức 1')

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm cách thức đào tạo' }), { target: { value: '  hội thảo  ' } })
    expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenLastCalledWith(listQuery({ keyword: 'hội thảo' })))
  })

  it('không gọi lại khi từ khoá chỉ có khoảng trắng', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ActivityTypeListPage />)
    await screen.findByText('Cách thức 1')

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm cách thức đào tạo' }), { target: { value: '   ' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })

    expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(1)
  })
})

describe('ActivityTypeListPage - phân trang', () => {
  const paged = (totalPages) => pageData([item(1)], { totalElements: totalPages * 10, totalPages })

  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getActivityTypes.mockResolvedValue(paged(3))
  })

  it('chuyển trang bằng nút số và nút mũi tên', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledWith(listQuery({ page: 1 })))

    fireEvent.click(screen.getByRole('button', { name: '>' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledWith(listQuery({ page: 2 })))

    fireEvent.click(screen.getByRole('button', { name: '<' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledWith(listQuery({ page: 1 })))
  })

  it('khoá nút lùi ở trang đầu và nút tiến khi chỉ có một trang', async () => {
    trainingApi.getActivityTypes.mockResolvedValue(paged(1))
    await renderPage()

    expect(screen.getByRole('button', { name: '<' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '>' })).toBeDisabled()
  })

  it('rút gọn danh sách trang khi có nhiều hơn 5 trang', async () => {
    trainingApi.getActivityTypes.mockResolvedValue(paged(9))
    await renderPage()

    expect(screen.getByText('...')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledWith(listQuery({ page: 8 })))
  })
})

describe('ActivityTypeListPage - modal tạo và sửa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getActivityTypes.mockResolvedValue(pageData([item(1), item(2, { active: false })]))
    trainingApi.createActivityType.mockResolvedValue({})
    trainingApi.updateActivityType.mockResolvedValue({})
  })

  it('mở modal tạo mới với biểu mẫu trống', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm cách thức/ }))

    expect(screen.getByRole('heading', { name: 'Tạo cách thức đào tạo' })).toBeInTheDocument()
    expect(nameInput()).toHaveValue('')
    expect(within(modal()).getByRole('combobox', { name: 'Trạng thái' })).toHaveValue('Hoạt động')
  })

  it('tạo mới cách thức đào tạo và tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm cách thức/ }))

    fireEvent.change(nameInput(), { target: { value: 'Hội thảo chuyên đề' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập mô tả tóm tắt...'), { target: { value: 'Mô tả mới' } })
    pickOption('Trạng thái', 'Ngưng hoạt động')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(trainingApi.createActivityType).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hội thảo chuyên đề',
      description: 'Mô tả mới',
      defaultDurationUnit: 'HOUR',
      requiresEvidence: true,
      maxCreditedHoursPerRecord: null,
      sortOrder: 0,
      active: false,
      version: null,
    })))
    expect(await screen.findByText('Đã thêm cách thức đào tạo mới thành công!')).toBeInTheDocument()
    expect(modal()).toBeNull()
    await waitFor(() => expect(trainingApi.getActivityTypes).toHaveBeenCalledTimes(2))
  })

  it('mở modal sửa với dữ liệu sẵn có', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa cách thức đào tạo Cách thức 1' }))

    expect(screen.getByRole('heading', { name: 'Cập nhật cách thức đào tạo' })).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Cách thức 1')
    expect(screen.getByPlaceholderText('Nhập mô tả tóm tắt...')).toHaveValue('Mô tả 1')
  })

  it('cập nhật cách thức đào tạo', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa cách thức đào tạo Cách thức 1' }))
    fireEvent.change(nameInput(), { target: { value: 'Cách thức đã sửa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(trainingApi.updateActivityType).toHaveBeenCalledWith(1, {
      code: 'ATC_1',
      name: 'Cách thức đã sửa',
      description: 'Mô tả 1',
      defaultDurationUnit: 'HOUR',
      requiresEvidence: true,
      maxCreditedHoursPerRecord: 8,
      sortOrder: 1,
      active: true,
      version: 2,
    }))
    expect(await screen.findByText('Đã cập nhật cách thức đào tạo thành công!')).toBeInTheDocument()
  })

  it('điền mặc định khi bản ghi thiếu trường', async () => {
    trainingApi.getActivityTypes.mockResolvedValue(pageData([item(1, {
      code: null, name: 'Thiếu dữ liệu', description: null, defaultDurationUnit: null,
      requiresEvidence: null, maxCreditedHoursPerRecord: null, sortOrder: null, active: null, version: null,
    })]))
    render(<ActivityTypeListPage />)
    await screen.findByText('Thiếu dữ liệu')

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa cách thức đào tạo Thiếu dữ liệu' }))
    expect(screen.getByPlaceholderText('Nhập mô tả tóm tắt...')).toHaveValue('')
    expect(within(modal()).getByRole('combobox', { name: 'Trạng thái' })).toHaveValue('Hoạt động')

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(trainingApi.updateActivityType).toHaveBeenCalledWith(1, expect.objectContaining({
      code: 'THIEU_DU_LIEU',
      description: null,
      defaultDurationUnit: 'HOUR',
      requiresEvidence: true,
      maxCreditedHoursPerRecord: null,
      sortOrder: 0,
      active: true,
    })))
  })

  it('sinh mã tạm khi không suy ra được mã từ tên', async () => {
    trainingApi.getActivityTypes.mockResolvedValue(pageData([item(1, { code: null, name: '###' })]))
    render(<ActivityTypeListPage />)
    await screen.findByText('###')

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa cách thức đào tạo ###' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => expect(trainingApi.updateActivityType).toHaveBeenCalledWith(1, expect.objectContaining({
      code: expect.stringMatching(/^ATC_\d+$/),
    })))
  })

  it('hiện lỗi khi lưu thất bại và giữ modal mở', async () => {
    trainingApi.updateActivityType.mockRejectedValue({ response: { status: 409, data: { message: 'Mã đã tồn tại' } } })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa cách thức đào tạo Cách thức 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(await screen.findByText('Mã đã tồn tại')).toBeInTheDocument()
    expect(modal()).not.toBeNull()
  })

  it('đóng modal bằng nút Hủy', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm cách thức/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))

    expect(modal()).toBeNull()
  })

  it('đóng modal khi bấm ra ngoài nhưng giữ nguyên khi bấm bên trong', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm cách thức/ }))

    fireEvent.click(modal())
    expect(modal()).not.toBeNull()

    fireEvent.click(document.querySelector('.atl-modal-backdrop'))
    expect(modal()).toBeNull()
  })

  it('đóng modal bằng nút X trên tiêu đề', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm cách thức/ }))
    fireEvent.click(document.querySelector('.atl-modal-close'))

    expect(modal()).toBeNull()
  })
})
