import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingHoursListScreen from './TrainingHoursListScreen.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'

globalThis.React = React

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog">
      <button type="button" onClick={onConfirm}>Xác nhận xóa</button>
      <button type="button" onClick={onCancel}>Hủy</button>
    </div>
  ) : null,
}))

vi.mock('../../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../../features/training/api/trainingApi', () => ({
  trainingApi: {
    getMyTrainingStatus: vi.fn(),
    getRecordOptions: vi.fn(),
    listRecords: vi.fn(),
    deleteRecord: vi.fn(),
  },
}))

vi.mock('../../api/staffApi.js', () => ({
  staffApi: {
    getProfile: vi.fn(),
  },
}))

describe('TrainingHoursListScreen query navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    staffApi.getProfile.mockResolvedValue({ data: { data: { id: 42 } } })
    trainingApi.getMyTrainingStatus.mockResolvedValue({ data: { data: { status: 'NOT_CONFIGURED' } } })
    trainingApi.getRecordOptions.mockResolvedValue({
      data: { data: { professionalFields: [{ id: 7, name: 'Hồi sức' }], activityTypes: [{ id: 4, name: 'Hội thảo' }] } },
    })
    trainingApi.listRecords.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 1,
            title: 'Hồ sơ nháp',
            workflowStatus: 'DRAFT',
            startDate: '2026-01-10',
            declaredHours: 4,
          }],
          totalElements: 1,
        },
      },
    })
    trainingApi.deleteRecord.mockResolvedValue({})
  })

  it('reads URL filters, waits for Enter and sends all filter params to API', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/training/all?q=cu%20&status=DRAFT&dateFrom=2026-01-01&dateTo=2026-03-31&professionalFieldId=7&activityTypeId=4&page=2']}>
        <TrainingHoursListScreen />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      titleKeyword: 'cu',
      workflowStatus: 'DRAFT',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      professionalFieldId: 7,
      activityTypeId: 4,
      employeeId: 42,
    })))

    const search = screen.getByRole('textbox', { name: 'Tìm theo tên khóa đào tạo' })
    fireEvent.change(search, { target: { value: 'mới' } })
    expect(trainingApi.listRecords).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/training/all'))
    expect(screen.getByRole('button', { name: 'Xem chi tiết Hồ sơ nháp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chỉnh sửa Hồ sơ nháp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa hồ sơ Hồ sơ nháp' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nộp hồ sơ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quản lý minh chứng/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Minh chứng' })).not.toBeInTheDocument()
  })

  it('returns to the previous page after deleting the only record on a later page', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/training/all?page=2']}>
        <TrainingHoursListScreen />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Xóa hồ sơ Hồ sơ nháp' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Xóa hồ sơ Hồ sơ nháp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))

    await waitFor(() => expect(trainingApi.deleteRecord).toHaveBeenCalledWith(1, undefined))
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/training/all'))
    await waitFor(() => expect(screen.getByTestId('current-path')).not.toHaveTextContent('page=2'))
  })

  it('keeps existing rows visible when a reload fails and exposes retry', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/training/all']}>
        <TrainingHoursListScreen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Hồ sơ nháp')).toBeInTheDocument())
    trainingApi.listRecords.mockRejectedValueOnce(new Error('temporary failure'))
    const search = screen.getByRole('textbox', { name: 'Tìm theo tên khóa đào tạo' })
    fireEvent.change(search, { target: { value: 'lỗi tạm thời' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    await waitFor(() => expect(screen.getByRole('button', { name: /Tải thêm thất bại · Thử lại/ })).toBeInTheDocument())
    expect(screen.getByText('Hồ sơ nháp')).toBeInTheDocument()
  })

  it('shows only view for submitted and cancelled records', async () => {
    trainingApi.listRecords.mockResolvedValueOnce({
      data: {
        data: {
          content: [
            { id: 10, title: 'Hồ sơ đã nộp', workflowStatus: 'SUBMITTED', startDate: '2026-01-01', declaredHours: 2 },
            { id: 11, title: 'Hồ sơ đã hủy', workflowStatus: 'CANCELLED', startDate: '2026-01-02', declaredHours: 3 },
          ],
          totalElements: 2,
        },
      },
    })
    render(
      <MemoryRouter initialEntries={['/staff/training/all']}>
        <TrainingHoursListScreen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'Xem chi tiết Hồ sơ đã nộp' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Xem chi tiết Hồ sơ đã hủy' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chỉnh sửa Hồ sơ đã nộp/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xóa hồ sơ Hồ sơ đã nộp/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Minh chứng/ })).not.toBeInTheDocument()
  })

  it('applies all four filters together and resets the URL page', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/training/all?page=3']}>
        <TrainingHoursListScreen />
        <LocationProbe />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Lọc theo trạng thái hồ sơ' }))
    fireEvent.click(screen.getByRole('option', { name: 'Đã nộp' }))
    fireEvent.change(screen.getByLabelText('Lọc từ ngày'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Lọc đến ngày'), { target: { value: '2026-08-20' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo lĩnh vực chuyên môn' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hồi sức' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo hình thức đào tạo' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hội thảo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/training/all?status=SUBMITTED'))
    expect(screen.getByTestId('current-path')).toHaveTextContent('dateFrom=2026-01-01')
    expect(screen.getByTestId('current-path')).toHaveTextContent('dateTo=2026-08-20')
    expect(screen.getByTestId('current-path')).toHaveTextContent('professionalFieldId=7')
    expect(screen.getByTestId('current-path')).toHaveTextContent('activityTypeId=4')
    expect(screen.getByTestId('current-path')).not.toHaveTextContent('page=3')
    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 0,
      workflowStatus: 'SUBMITTED',
      dateFrom: '2026-01-01',
      dateTo: '2026-08-20',
      professionalFieldId: 7,
      activityTypeId: 4,
    })))
  })

  it('ignores a stale request error after applying a date filter', async () => {
    const firstRequest = deferredPromise()
    trainingApi.listRecords
      .mockImplementationOnce(() => firstRequest.promise)
      .mockResolvedValueOnce({
        data: {
          data: {
            content: [{
              id: 20,
              title: 'Hồ sơ trong khoảng ngày',
              workflowStatus: 'SUBMITTED',
              startDate: '2026-08-10',
              declaredHours: 3,
            }],
            totalElements: 1,
          },
        },
      })

    render(
      <MemoryRouter initialEntries={['/staff/training/all']}>
        <TrainingHoursListScreen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc' }))
    fireEvent.change(await screen.findByLabelText('Lọc từ ngày'), { target: { value: '2026-08-06' } })
    fireEvent.change(screen.getByLabelText('Lọc đến ngày'), { target: { value: '2026-08-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByText('Hồ sơ trong khoảng ngày')).toBeInTheDocument()
    firstRequest.reject(new Error('stale request failed'))

    await waitFor(() => {
      expect(screen.queryByText(/Không thể tải danh sách giờ đào tạo/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Không thể kết nối đến máy chủ/i)).not.toBeInTheDocument()
    })
    expect(trainingApi.listRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      dateFrom: '2026-08-06',
      dateTo: '2026-08-12',
    }))
  })

  it('loads the next page when the mobile table reaches its horizontal end', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
    trainingApi.listRecords.mockImplementation(({ page }) => Promise.resolve({
      data: {
        data: {
          content: [{
            id: page + 1,
            title: `Hồ sơ trang ${page + 1}`,
            workflowStatus: 'SUBMITTED',
            startDate: '2026-01-10',
            declaredHours: 2,
          }],
          totalElements: 20,
        },
      },
    }))
    render(
      <MemoryRouter initialEntries={['/staff/training/all']}>
        <TrainingHoursListScreen />
        <LocationProbe />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Hồ sơ trang 1')).toBeInTheDocument())
    const tableBody = screen.getAllByRole('rowgroup')[1]
    Object.defineProperties(tableBody, {
      scrollWidth: { configurable: true, value: 1000 },
      scrollLeft: { configurable: true, value: 800 },
      clientWidth: { configurable: true, value: 160 },
    })
    fireEvent.scroll(tableBody)
    await waitFor(() => expect(screen.getByText('Hồ sơ trang 2')).toBeInTheDocument())
    expect(screen.getByTestId('current-path')).toHaveTextContent('page=2')
  })

  it('restores the previous and next URL filters through browser history', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/staff/training/all?q=first',
          '/staff/training/all?status=DRAFT',
        ]}
        initialIndex={1}
      >
        <TrainingHoursListScreen />
        <LocationProbe />
        <HistoryControls />
      </MemoryRouter>,
    )

    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenCalledWith(expect.objectContaining({
      workflowStatus: 'DRAFT',
    })))

    fireEvent.click(screen.getByRole('button', { name: 'Lùi lịch sử' }))
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('?q=first'))
    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenCalledWith(expect.objectContaining({
      titleKeyword: 'first',
    })))

    fireEvent.click(screen.getByRole('button', { name: 'Tiến lịch sử' }))
    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('?status=DRAFT'))
    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenLastCalledWith(expect.objectContaining({
      workflowStatus: 'DRAFT',
    })))
  })
})

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="current-path">{location.pathname}{location.search}</span>
}

function HistoryControls() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>Lùi lịch sử</button>
      <button type="button" onClick={() => navigate(1)}>Tiến lịch sử</button>
    </>
  )
}

function deferredPromise() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}
