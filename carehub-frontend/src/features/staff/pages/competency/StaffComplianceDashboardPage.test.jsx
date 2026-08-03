import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import StaffComplianceDashboardPage from './StaffComplianceDashboardPage.jsx'
import { myCompetencyApi } from '../../../evaluation/api/myCompetencyApi.js'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children, data }) => <div data-testid="compliance-chart" data-count={data.length}>{children}</div>,
  Bar: ({ name }) => <span data-testid="compliance-bar">{name}</span>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../../../evaluation/api/myCompetencyApi.js', () => ({
  myCompetencyApi: {
    getComplianceOverview: vi.fn(),
    getComplianceChart: vi.fn(),
  },
}))

const response = (data) => ({ data: { data } })
const previousReact = globalThis.React

beforeAll(() => { globalThis.React = React })
afterAll(() => { globalThis.React = previousReact })

describe('StaffComplianceDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    myCompetencyApi.getComplianceOverview.mockResolvedValue(response({
      totalEvaluations: 5,
      passCount: 3,
      complianceRate: 60,
      latest: {
        formName: 'Rửa tay thường quy',
        evaluationCount: 3,
        complianceRate: 66.7,
        targetPercent: 80,
        targetSource: 'DEFAULT',
        latestEvaluatedAt: '2026-08-01T10:00:00Z',
      },
    }))
    myCompetencyApi.getComplianceChart.mockResolvedValue(response({
      year: 2026,
      availableYears: [2026, 2025],
      items: [
        { formId: 1, formName: 'Rửa tay thường quy', complianceRate: 66.7, targetPercent: 80 },
        { formId: 2, formName: 'Sát khuẩn bề mặt', complianceRate: 90, targetPercent: 80 },
      ],
    }))
  })

  it('shows aggregate cards, two bars per checklist and latest summary', async () => {
    render(<MemoryRouter><StaffComplianceDashboardPage /></MemoryRouter>)

    expect(await screen.findByText('Tổng số lượt được chấm')).toBeInTheDocument()
    expect(screen.getByText('60,0')).toBeInTheDocument()
    expect(screen.getByText('Rửa tay thường quy')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-chart')).toHaveAttribute('data-count', '2')
    expect(screen.getAllByTestId('compliance-bar')).toHaveLength(2)
    expect(screen.getByText('Xem toàn bộ')).toBeInTheDocument()
  })

  it('reloads only the chart when its year changes', async () => {
    render(<MemoryRouter><StaffComplianceDashboardPage /></MemoryRouter>)
    await screen.findByText('Tổng số lượt được chấm')
    const initialOverviewCalls = myCompetencyApi.getComplianceOverview.mock.calls.length
    fireEvent.change(screen.getByLabelText('Năm biểu đồ tuân thủ'), { target: { value: '2025' } })

    await waitFor(() => expect(myCompetencyApi.getComplianceChart).toHaveBeenCalledWith({ year: 2025 }))
    expect(myCompetencyApi.getComplianceOverview).toHaveBeenCalledTimes(initialOverviewCalls)
  })
})
