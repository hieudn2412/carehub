import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingHoursOverviewScreen from './TrainingHoursOverviewScreen.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-chart">{children}</div>,
  BarChart: ({ children, data }) => (
    <div data-testid="professional-field-chart" data-field-count={data.length}>
      {data.map(field => (
        <span key={field.professionalFieldId ?? field.professionalFieldName}>
          {field.professionalFieldName}: {field.submittedHours}
        </span>
      ))}
      {children}
    </div>
  ),
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../../../../features/training/api/trainingApi', () => ({
  trainingApi: {
    getMyTrainingStatus: vi.fn(),
    getMyProfessionalFieldHours: vi.fn(),
    getRecordOptions: vi.fn(),
    listRecords: vi.fn(),
  },
}))

vi.mock('../../api/staffApi.js', () => ({
  staffApi: {
    getProfile: vi.fn(),
  },
}))

vi.mock('../../../../features/auth/services/tokenStorage.js', () => ({
  tokenStorage: {
    getAccessToken: vi.fn(() => null),
  },
}))

vi.mock('../../../../features/auth/utils/jwt.js', () => ({
  getRolesFromAccessToken: vi.fn(() => []),
}))

const previousReact = globalThis.React
const currentYear = new Date().getFullYear()

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('TrainingHoursOverviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getMyTrainingStatus.mockResolvedValue({
      data: {
        data: {
          status: 'CONFIGURED',
          submittedHours: 72,
          requiredHours: 120,
        },
      },
    })
    trainingApi.getMyProfessionalFieldHours.mockResolvedValue({
      data: {
        data: {
          year: currentYear,
          availableYears: [currentYear, currentYear - 1, currentYear - 2],
          fields: [
            {
              professionalFieldId: 1,
              professionalFieldName: 'Hồi sức cấp cứu',
              submittedHours: 24.5,
            },
            {
              professionalFieldId: 2,
              professionalFieldName: 'Lĩnh vực chuyên môn có tên rất dài',
              submittedHours: 12,
            },
          ],
        },
      },
    })
    trainingApi.getRecordOptions.mockResolvedValue({
      data: {
        data: {
          professionalFields: [{ id: 7, name: 'Hồi sức cấp cứu' }],
          activityTypes: [{ id: 4, name: 'Hội thảo' }],
        },
      },
    })
    staffApi.getProfile.mockResolvedValue({ data: { data: { id: 42 } } })
    trainingApi.listRecords.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 99,
            title: 'Khóa đào tạo mới nhất',
            workflowStatus: 'SUBMITTED',
            startDate: '2025-01-10',
            submittedAt: '2026-07-20T10:00:00Z',
            declaredHours: 8,
            professionalFieldName: 'Hồi sức cấp cứu',
          }],
        },
      },
    })
  })

  it('renders the chart and exactly one latest submitted record', async () => {

    const { container } = render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
        <LocationProbe />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Còn thiếu 48 giờ')).toBeInTheDocument()
    expect(await screen.findByText('Khóa đào tạo mới nhất')).toBeInTheDocument()
    expect(screen.getByTestId('professional-field-chart')).toHaveAttribute('data-field-count', '2')
    expect(screen.getByText('Hồi sức cấp cứu: 24.5')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Giờ đào tạo liên tục' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Giờ đào tạo theo lĩnh vực' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Giờ đào tạo gần nhất' })).toBeInTheDocument()
    const search = screen.getByRole('textbox', { name: 'Tìm theo nội dung đào tạo' })
    const yearSelect = screen.getByRole('combobox', { name: 'Năm biểu đồ' })
    const filterButton = screen.getByRole('button', { name: 'Mở bộ lọc giờ đào tạo' })
    const updateButton = screen.getByRole('button', { name: /Cập nhật giờ đào tạo/ })
    expect(search).toBeInTheDocument()
    expect(yearSelect).toBeInTheDocument()
    expect(filterButton).toBeInTheDocument()
    expect(updateButton).toBeInTheDocument()
    search.focus()
    expect(search).toHaveFocus()
    yearSelect.focus()
    expect(yearSelect).toHaveFocus()
    filterButton.focus()
    expect(filterButton).toHaveFocus()
    updateButton.focus()
    expect(updateButton).toHaveFocus()
    fireEvent.click(updateButton)
    expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/training/new')
    expect([...container.querySelectorAll('[data-overview-section]')].map(section => section.dataset.overviewSection))
      .toEqual(['chart', 'progress', 'tools', 'latest'])
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem chi tiết Khóa đào tạo mới nhất' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Chỉnh sửa Khóa đào tạo mới nhất/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quản lý minh chứng Khóa đào tạo mới nhất/ })).not.toBeInTheDocument()
    expect(trainingApi.listRecords).toHaveBeenCalledWith({
      employeeId: 42,
      workflowStatus: 'SUBMITTED',
      page: 0,
      size: 1,
      sort: 'submittedAt,desc',
    })
  })

  it('reloads only the chart on year changes and ignores stale responses', async () => {
    const staleResponse = deferred()
    const newestResponse = deferred()
    render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Hồi sức cấp cứu: 24.5')).toBeInTheDocument()
    const statusCallCount = trainingApi.getMyTrainingStatus.mock.calls.length
    const latestCallCount = trainingApi.listRecords.mock.calls.length
    const profileCallCount = staffApi.getProfile.mock.calls.length
    trainingApi.getMyProfessionalFieldHours.mockImplementation(({ year }) => (
      year === currentYear - 1 ? staleResponse.promise : newestResponse.promise
    ))

    const yearSelect = screen.getByRole('combobox', { name: 'Năm biểu đồ' })
    fireEvent.change(yearSelect, { target: { value: currentYear - 1 } })
    fireEvent.change(yearSelect, { target: { value: currentYear - 2 } })

    await act(async () => {
      newestResponse.resolve(chartResponse(currentYear - 2, 'Dữ liệu mới nhất', 30))
    })
    expect(await screen.findByText('Dữ liệu mới nhất: 30')).toBeInTheDocument()

    await act(async () => {
      staleResponse.resolve(chartResponse(currentYear - 1, 'Dữ liệu cũ', 99))
    })
    expect(screen.queryByText('Dữ liệu cũ: 99')).not.toBeInTheDocument()
    expect(trainingApi.getMyTrainingStatus).toHaveBeenCalledTimes(statusCallCount)
    expect(trainingApi.listRecords).toHaveBeenCalledTimes(latestCallCount)
    expect(staffApi.getProfile).toHaveBeenCalledTimes(profileCallCount)
  })

  it('keeps latest data visible while the chart loads, fails and retries', async () => {
    const chartRequest = deferred()
    trainingApi.getMyProfessionalFieldHours.mockReturnValue(chartRequest.promise)
    render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Khóa đào tạo mới nhất')).toBeInTheDocument()
    expect(screen.getByText('Đang tải biểu đồ...')).toBeInTheDocument()
    await act(async () => {
      chartRequest.reject(new Error('chart failed'))
    })
    expect(await screen.findByText('Không thể tải biểu đồ giờ đào tạo.')).toBeInTheDocument()

    const latestCallCount = trainingApi.listRecords.mock.calls.length
    trainingApi.getMyProfessionalFieldHours.mockResolvedValue(
      chartResponse(currentYear, 'Biểu đồ sau khi thử lại', 18),
    )
    fireEvent.click(screen.getByRole('button', { name: /Thử lại biểu đồ/ }))
    expect(await screen.findByText('Biểu đồ sau khi thử lại: 18')).toBeInTheDocument()
    expect(screen.getByText('Khóa đào tạo mới nhất')).toBeInTheDocument()
    expect(trainingApi.listRecords).toHaveBeenCalledTimes(latestCallCount)
  })

  it('shows and retries the latest-record error without reloading the chart', async () => {
    trainingApi.listRecords.mockRejectedValueOnce(new Error('latest failed'))
    render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Hồi sức cấp cứu: 24.5')).toBeInTheDocument()
    expect(await screen.findByText('Không thể tải hồ sơ giờ đào tạo gần nhất.')).toBeInTheDocument()
    const chartCallCount = trainingApi.getMyProfessionalFieldHours.mock.calls.length
    trainingApi.listRecords.mockResolvedValue({ data: { data: { content: [] } } })
    fireEvent.click(screen.getByRole('button', { name: /Thử lại hồ sơ gần nhất/ }))

    expect(await screen.findByText('Chưa có hồ sơ giờ đào tạo đã nộp.')).toBeInTheDocument()
    expect(screen.getByText('Hồi sức cấp cứu: 24.5')).toBeInTheDocument()
    expect(trainingApi.getMyProfessionalFieldHours).toHaveBeenCalledTimes(chartCallCount)
  })

  it('renders independent empty states for chart and latest record', async () => {
    trainingApi.getMyProfessionalFieldHours.mockResolvedValue({
      data: { data: { year: currentYear, availableYears: [currentYear], fields: [] } },
    })
    trainingApi.listRecords.mockResolvedValue({ data: { data: { content: [] } } })
    render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText(`Chưa có dữ liệu biểu đồ trong năm ${currentYear}.`)).toBeInTheDocument()
    expect(await screen.findByText('Chưa có hồ sơ giờ đào tạo đã nộp.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('keeps more than ten fields inside the dedicated chart scroll region', async () => {
    const fields = Array.from({ length: 12 }, (_, index) => ({
      professionalFieldId: index + 1,
      professionalFieldName: `Lĩnh vực ${index + 1}`,
      submittedHours: index + 1,
    }))
    trainingApi.getMyProfessionalFieldHours.mockResolvedValue({
      data: { data: { year: currentYear, availableYears: [currentYear], fields } },
    })
    const { container } = render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('professional-field-chart')).toHaveAttribute('data-field-count', '12')
    const chartCanvas = container.querySelector('.th-overview-chart-canvas')
    expect(chartCanvas).toHaveStyle({ minWidth: '1104px' })
    expect(chartCanvas?.parentElement).toHaveClass('th-overview-chart-scroll')
  })

  it('navigates search and applied filters with a compact URL', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
        <LocationProbe />
      </MemoryRouter>,
    )

    const search = screen.getByRole('textbox', { name: 'Tìm theo nội dung đào tạo' })
    fireEvent.change(search, { target: { value: '  khóa học  ' } })
    expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/training')
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/training/all')

    // Render a fresh overview so the filter draft starts from a clean state.
    render(
      <MemoryRouter initialEntries={['/staff/training']}>
        <TrainingHoursOverviewScreen />
        <LocationProbe />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Mở bộ lọc giờ đào tạo' })[1])
    expect(await screen.findByRole('region', { name: 'Bộ lọc giờ đào tạo' })).toBeInTheDocument()
    fireEvent.change(await screen.findByRole('combobox', { name: 'Bộ lọc trạng thái' }), { target: { value: 'SUBMITTED' } })
    fireEvent.change(screen.getByLabelText('Bộ lọc từ ngày'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Bộ lọc đến ngày'), { target: { value: '2026-03-31' } })
    fireEvent.change(await screen.findByRole('combobox', { name: 'Bộ lọc lĩnh vực chuyên môn' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getAllByTestId('current-path')[1]).toHaveTextContent(
      '/staff/training/all?status=SUBMITTED&dateFrom=2026-01-01&dateTo=2026-03-31&professionalFieldId=7',
    )
  })
})

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="current-path">{location.pathname}{location.search}</span>
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function chartResponse(year, professionalFieldName, submittedHours) {
  return {
    data: {
      data: {
        year,
        availableYears: [currentYear, currentYear - 1, currentYear - 2],
        fields: [{
          professionalFieldId: year,
          professionalFieldName,
          submittedHours,
        }],
      },
    },
  }
}
