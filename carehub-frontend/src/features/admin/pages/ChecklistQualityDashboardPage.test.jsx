import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ChecklistQualityDashboardPage from './ChecklistQualityDashboardPage.jsx'
import { adminApi } from '../api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, id, onChange, options, placeholder, value }) => (
    <select id={id} aria-label={ariaLabel || placeholder} onChange={(event) => onChange(event.target.value)} value={value}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

vi.mock('../api/adminApi.js', () => ({
  adminApi: {
    getDepartments: vi.fn(),
    getQualityChecklistDashboard: vi.fn(),
    getQualityChecklistFilterOptions: vi.fn(),
    getQualityChecklistTrend: vi.fn(),
  },
}))

vi.mock('../../staff/api/staffApi.js', () => ({
  staffApi: { getProfile: vi.fn() },
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

const checklist = {
  averageConvertedScore: 9,
  complianceRate: 100,
  failedCount: 0,
  formCode: 'QT-CS-01',
  formId: 19,
  formTitle: 'Quy trình chăm sóc người bệnh',
  lastSubmittedAt: '2026-08-10T08:30:00Z',
  monitoringCount: 1,
  passedCount: 1,
  targetPercent: 80,
  targetSource: 'HOSPITAL',
  uniqueSubjectCount: 1,
  versionNumber: 1,
}

function dashboardResponse(content = [checklist]) {
  return {
    data: {
      data: {
        content,
        page: 0,
        size: 10,
        totalElements: content.length,
        totalPages: content.length ? 1 : 0,
      },
    },
  }
}

describe('ChecklistQualityDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getDepartments.mockResolvedValue({ data: { data: { content: [] } } })
    adminApi.getQualityChecklistDashboard.mockResolvedValue(dashboardResponse())
    adminApi.getQualityChecklistFilterOptions.mockResolvedValue({
      data: { data: { evaluators: [], forms: [], subjects: [] } },
    })
    adminApi.getQualityChecklistTrend.mockResolvedValue({ data: { data: { items: [] } } })
    staffApi.getProfile.mockResolvedValue({
      data: { data: { departmentId: 7, departmentName: 'Khoa Điều dưỡng' } },
    })
  })

  it('keeps the result dashboard visible beside the list after filtering', async () => {
    const { container } = render(<ChecklistQualityDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'PASSED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByRole('heading', { name: 'Danh sách bảng kiểm phù hợp' })).toBeInTheDocument()
    expect(screen.getByText('KẾT QUẢ BẢNG KIỂM ĐANG CHỌN')).toBeInTheDocument()
    const workspace = container.querySelector('.checklist-quality-workspace')
    expect(workspace).toContainElement(container.querySelector('.checklist-quality-processes'))
    expect(workspace).toContainElement(container.querySelector('.checklist-quality-detail'))
    await waitFor(() => {
      expect(adminApi.getQualityChecklistDashboard).toHaveBeenCalledWith(expect.objectContaining({
        resultStatus: 'PASSED',
        view: 'FILTERED',
      }))
    })
  })

  it('shows the latest scored date when a checklist has one submission', async () => {
    render(<ChecklistQualityDashboardPage />)

    expect(await screen.findByText('Chấm gần nhất:')).toBeInTheDocument()
    const submittedAt = screen.getByText(/10\/08\/2026/)
    expect(submittedAt).toHaveAttribute('datetime', checklist.lastSubmittedAt)
  })

  it('only requests user dashboard data after applying draft filters', async () => {
    render(<ChecklistQualityDashboardPage role="user" />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'PASSED' } })

    expect(adminApi.getQualityChecklistDashboard).not.toHaveBeenCalledWith(expect.objectContaining({
      resultStatus: 'PASSED',
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(adminApi.getQualityChecklistDashboard).toHaveBeenCalledWith(expect.objectContaining({
        resultStatus: 'PASSED',
        view: 'FILTERED',
      }))
    })
  })

  it('only requests manager dashboard data after applying draft filters', async () => {
    render(<ChecklistQualityDashboardPage role="manager" />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'PASSED' } })

    expect(adminApi.getQualityChecklistDashboard).not.toHaveBeenCalledWith(expect.objectContaining({
      resultStatus: 'PASSED',
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(adminApi.getQualityChecklistDashboard).toHaveBeenCalledWith(expect.objectContaining({
        departmentId: '7',
        resultStatus: 'PASSED',
        view: 'FILTERED',
      }))
    })
  })
})
