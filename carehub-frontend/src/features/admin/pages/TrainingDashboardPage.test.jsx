import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingDashboardPage from './TrainingDashboardPage.jsx'
import { staffApi } from '../../staff/api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'

globalThis.React = React

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Cell: () => null,
  LabelList: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, title }) => <main><h1>{title}</h1>{children}</main>,
}))
vi.mock('../../../shared/components/ProgressRing.jsx', () => ({ default: () => null }))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ actions, children }) => <section>{actions}{children}</section>,
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label }) => <label>{label}<select aria-label={label} /></label>,
}))
vi.mock('../components/ChartConfigPanel.jsx', () => ({ default: () => null }))
vi.mock('../../staff/api/staffApi.js', () => ({ staffApi: { getProfile: vi.fn() } }))
vi.mock('../../training/api/trainingApi.js', () => ({
  trainingApi: {
    getDepartments: vi.fn(),
    getEmployeeTrainingStatuses: vi.fn(),
    getRecordOptions: vi.fn(),
    getTrainingDashboardSummary: vi.fn(),
  },
}))

const response = (data) => ({ data: { data } })

describe('TrainingDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    staffApi.getProfile.mockResolvedValue(response({ departmentId: 7, departmentName: 'Khoa Nội' }))
    trainingApi.getRecordOptions.mockResolvedValue(response({ professionalFields: [] }))
    trainingApi.getTrainingDashboardSummary.mockResolvedValue(response({
      totals: { employeeCount: 8, compliantCount: 6, complianceRate: 75 },
      byDepartment: [{ departmentName: 'Khoa Nội', employeeCount: 8, complianceRate: 75 }],
      byProfessionalField: [{ professionalFieldName: 'Điều dưỡng', submittedHours: 40 }],
      byActivityType: [{ activityTypeName: 'Hội thảo', submittedHours: 24 }],
    }))
  })

  it('manager dùng đủ dashboard admin nhưng dữ liệu bị khóa theo khoa', async () => {
    render(<MemoryRouter><TrainingDashboardPage role="manager" /></MemoryRouter>)

    await waitFor(() => expect(trainingApi.getTrainingDashboardSummary).toHaveBeenCalled())
    expect(trainingApi.getTrainingDashboardSummary).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 7 }))
    expect(trainingApi.getTrainingDashboardSummary.mock.calls[0][0]).not.toHaveProperty('asOf')
    expect(screen.queryByText('Tính đến ngày')).not.toBeInTheDocument()
    expect(screen.queryByText('Tỷ lệ hoàn thành theo khoa')).not.toBeInTheDocument()
    expect(screen.getByText('Tổng giờ đào tạo theo lĩnh vực')).toBeInTheDocument()
    expect(screen.getByText('Tổng giờ đào tạo theo hình thức')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xem chi tiết/ })).toBeInTheDocument()
  })
})
