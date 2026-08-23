import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerEvaluationHistoryPage from './ManagerEvaluationHistoryPage.jsx'
import { adminApi } from '../../../admin/api/adminApi.js'

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, id, onChange, options, placeholder, value, disabled }) => (
    <select
      id={id}
      aria-label={ariaLabel || placeholder}
      disabled={disabled}
      onChange={(event) => onChange && onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('../../../admin/api/adminApi.js', () => ({
  adminApi: {
    getDepartments: vi.fn(),
    getQualityChecklistFilterOptions: vi.fn(),
    getEvaluationHistory: vi.fn(),
    getEvaluationHistorySummary: vi.fn(),
  },
}))

const mockSubmission = {
  id: 101,
  formTitle: 'Rửa tay ngoại khoa',
  formCode: 'RUA_TAY_NGOAI_KHOA',
  formVersionId: 14,
  versionNumber: 1,
  subjectContext: {
    fullName: 'NamHaiPham',
    employeeCode: 'hainam',
    subjectUser: {
      department: {
        id: 3,
        name: 'Phòng Hành chính',
      },
    },
  },
  submittedBy: {
    name: 'Ng hieu 24',
    username: 'nghieu2412',
  },
  submittedAt: '2026-08-23T23:38:00Z',
  convertedScore: 8.0,
  result: 'PASSED',
}

describe('ManagerEvaluationHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getDepartments.mockResolvedValue({
      data: {
        data: [
          { id: 3, name: 'Phòng Hành chính', code: 'HC' },
          { id: 7, name: 'Khoa Điều dưỡng', code: 'DD' },
        ],
      },
    })
    adminApi.getQualityChecklistFilterOptions.mockResolvedValue({
      data: {
        data: {
          forms: [{ id: 14, title: 'Rửa tay ngoại khoa', code: 'RTNK' }],
        },
      },
    })
    adminApi.getEvaluationHistory.mockResolvedValue({
      data: {
        data: {
          content: [mockSubmission],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        },
      },
    })
    adminApi.getEvaluationHistorySummary.mockResolvedValue({
      data: {
        data: {
          total: 1,
          passed: 1,
          failed: 0,
          averageConvertedScore: 8.0,
        },
      },
    })
  })

  it('renders summary KPI cards and submission table correctly', async () => {
    render(
      <MemoryRouter>
        <ManagerEvaluationHistoryPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('Lịch sử đánh giá')).toBeInTheDocument()
    expect(screen.getByText('Tổng lượt')).toBeInTheDocument()
    expect(screen.getAllByText('Đạt').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Điểm trung bình')).toBeInTheDocument()

    expect(await screen.findByText('NamHaiPham')).toBeInTheDocument()
    expect(screen.getByText('Phòng Hành chính')).toBeInTheDocument()
    expect(screen.getByText('8,00/10')).toBeInTheDocument()
  })

  it('allows filtering by department across all departments', async () => {
    render(
      <MemoryRouter>
        <ManagerEvaluationHistoryPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('NamHaiPham')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))

    const deptSelect = screen.getByLabelText('Lọc theo khoa phòng')
    expect(deptSelect).toBeInTheDocument()
    expect(deptSelect).not.toBeDisabled()

    fireEvent.change(deptSelect, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(adminApi.getEvaluationHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: '3',
        })
      )
    })
  })
})
