import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingEmployeeStatusDetailPage from './TrainingEmployeeStatusDetailPage.jsx'
import { trainingApi } from '../api/trainingApi.js'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../api/trainingApi.js', () => ({
  trainingApi: {
    getEmployeeTrainingStatus: vi.fn(),
    getEmployeeTrainingStatuses: vi.fn(),
    getRecordOptions: vi.fn(),
    listRecords: vi.fn(),
  },
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('TrainingEmployeeStatusDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getEmployeeTrainingStatus.mockResolvedValue({
      data: {
        data: {
          employeeName: 'Nguyễn Văn An',
          employeeCode: 'NV001',
          submittedHours: 120,
          requiredHours: 120,
          remainingHours: 0,
          progressPercentage: 100,
          status: 'NON_COMPLIANT',
          requirementName: 'Yêu cầu đào tạo điều dưỡng',
          cycleYears: 2,
          windowStart: '2025-01-01',
          windowEnd: '2026-12-31',
          warningMessage: 'Sắp kết thúc chu kỳ',
          yearlyHours: [{ year: 2026, submittedHours: 80 }],
          activityTypeHours: [{ activityTypeId: 4, activityTypeName: 'Hội thảo', submittedHours: 45 }],
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
    trainingApi.getEmployeeTrainingStatuses.mockResolvedValue({
      data: {
        data: {
          content: [{
            employeeId: 1,
            departmentName: 'Khoa Gây mê hồi sức',
            jobPositionName: 'Điều dưỡng',
            lastTrainingDate: '2026-02-16',
          }],
        },
      },
    })
    trainingApi.listRecords.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 19,
            title: 'Đào tạo an toàn người bệnh',
            provider: 'Bệnh viện Hữu nghị Việt Đức',
            activityTypeName: 'Hội thảo',
            professionalFieldName: 'Hồi sức cấp cứu',
            declaredHours: 8,
            startDate: '2026-02-15',
            endDate: '2026-02-16',
            workflowStatus: 'SUBMITTED',
            sourceType: 'MANUAL',
            evidenceCount: 1,
            passedEvidenceCount: 1,
            failedEvidenceCount: 0,
          }],
          totalElements: 1,
          totalPages: 1,
        },
      },
    })
  })

  it('shows the submitted-hours card in green when the requirement is met', async () => {
    const { container } = renderPage()

    expect((await screen.findAllByText('120h')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('120/120h - Đạt')).toBeInTheDocument()
    expect(screen.getAllByText('Yêu cầu đào tạo điều dưỡng')).toHaveLength(2)
    expect(screen.getByText('Sắp kết thúc chu kỳ')).toBeInTheDocument()
    expect(screen.getByText('Bệnh viện Hữu nghị Việt Đức')).toBeInTheDocument()
    expect(screen.getAllByText('Hồi sức cấp cứu').length).toBeGreaterThan(0)
    expect(await screen.findByText('Khoa Gây mê hồi sức')).toBeInTheDocument()
    expect(screen.getByText('Điều dưỡng')).toBeInTheDocument()
    expect(container.querySelector('.ted-summary-card')).toHaveClass('ted-summary-card--compliant')
    expect(container.querySelector('.ted-card-value')).toHaveClass('ted-card-value--compliant')
  })

  it('filters the employee summary by professional field and as-of date', async () => {
    renderPage()

    await screen.findByText('120/120h - Đạt')
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc tổng hợp theo lĩnh vực chuyên môn' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hồi sức cấp cứu' }))
    fireEvent.change(screen.getByLabelText('Tính tổng hợp đến ngày'), { target: { value: '2026-06-30' } })

    await waitFor(() => expect(trainingApi.getEmployeeTrainingStatus).toHaveBeenLastCalledWith('1', {
      professionalFieldId: 7,
      asOf: '2026-06-30',
    }))
  })

  it('applies keyword, date, status, field and activity filters to the records API', async () => {
    renderPage()

    expect(await screen.findByText('Đào tạo an toàn người bệnh')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm theo khóa học hoặc hội thảo' }), { target: { value: 'an toàn' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo trạng thái hồ sơ' }))
    fireEvent.click(screen.getByRole('option', { name: 'Đã nộp' }))
    fireEvent.change(screen.getByLabelText('Lọc từ ngày'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('Lọc đến ngày'), { target: { value: '2026-03-31' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo lĩnh vực chuyên môn' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hồi sức cấp cứu' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo hình thức đào tạo' }))
    fireEvent.click(screen.getByRole('option', { name: 'Hội thảo' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo tình trạng minh chứng' }))
    fireEvent.click(screen.getByRole('option', { name: 'Có minh chứng' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo kết quả minh chứng' }))
    fireEvent.click(screen.getByRole('option', { name: 'Đạt' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo nguồn dữ liệu' }))
    fireEvent.click(screen.getByRole('option', { name: 'Nhân viên khai báo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenLastCalledWith({
      employeeId: 1,
      page: 0,
      size: 10,
      titleKeyword: 'an toàn',
      workflowStatus: 'SUBMITTED',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      professionalFieldId: 7,
      activityTypeId: 4,
      hasEvidence: true,
      moderationStatus: 'PASSED',
      sourceType: 'MANUAL',
      sort: 'startDate,desc',
    }))
  })

  it('rejects an inverted date range without calling the records API again', async () => {
    renderPage()

    await waitFor(() => expect(trainingApi.listRecords).toHaveBeenCalledTimes(1))
    await screen.findByText('Khoa Gây mê hồi sức')
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    fireEvent.change(screen.getByLabelText('Lọc từ ngày'), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText('Lọc đến ngày'), { target: { value: '2026-03-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(trainingApi.listRecords).toHaveBeenCalledTimes(1)
  })

  it('keeps independent filters visible when option lists fail to load', async () => {
    trainingApi.getRecordOptions.mockRejectedValueOnce(new Error('temporary failure'))
    renderPage()

    await screen.findByText('120/120h - Đạt')
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))

    expect(screen.getByRole('combobox', { name: 'Lọc theo trạng thái hồ sơ' })).toBeEnabled()
    expect(screen.getByLabelText('Lọc từ ngày')).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Lọc theo tình trạng minh chứng' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Lọc theo lĩnh vực chuyên môn' })).toBeDisabled()
  })
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/training/employees/1']}>
      <Routes>
        <Route path="/training/employees/:employeeId" element={<TrainingEmployeeStatusDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
