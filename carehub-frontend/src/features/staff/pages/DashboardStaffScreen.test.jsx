import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardStaffScreen from './DashboardStaffScreen.jsx'
import { staffApi } from '../api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { myCompetencyApi } from '../../evaluation/api/myCompetencyApi.js'

void React

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../api/staffApi.js', () => ({
  staffApi: {
    getProfile: vi.fn(),
    getMyDashboardFormSummary: vi.fn(),
  },
}))

vi.mock('../../training/api/trainingApi.js', () => ({
  trainingApi: { getMyTrainingStatus: vi.fn() },
}))

vi.mock('../../evaluation/api/myCompetencyApi.js', () => ({
  myCompetencyApi: { getSummary: vi.fn() },
}))

function response(data) {
  return Promise.resolve({ data: { data } })
}

describe('DashboardStaffScreen', () => {
  beforeEach(() => {
    staffApi.getProfile.mockReturnValue(response({
      fullName: 'Nguyễn Văn A',
      employeeCode: 'NV001',
      departmentName: 'Khoa Điều dưỡng',
      roles: [{ name: 'User' }],
    }))
    trainingApi.getMyTrainingStatus.mockReturnValue(response({
      submittedHours: 15,
      requiredHours: 120,
      status: 'NON_COMPLIANT',
    }))
    staffApi.getMyDashboardFormSummary.mockReturnValue(response({
      submittedCount: 12,
      passedCount: 9,
      averageConvertedScore: 6.5,
    }))
    myCompetencyApi.getSummary.mockReturnValue(response({
      knowledgeAttemptCount: 3,
      knowledgeAverage: 7.5,
      skillEvaluationCount: 8,
      skillAverage: 6.5,
      overallScore: 7,
      targetScore: 7,
      isPassed: true,
    }))
  })

  it('renders the personal dashboard metrics and uses the configured competency floor', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Routes>
          <Route path="/staff/dashboard" element={<DashboardStaffScreen />} />
          <Route path="/staff/training" element={<h1>Trang đào tạo</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument()
    expect(screen.getByText('15/120h')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('7,5/10')).toBeInTheDocument()
    expect(screen.getByText('6,5/10')).toBeInTheDocument()
    expect(screen.getByText((_, element) => (
      element.classList?.contains('staff-home-overall__content')
      && element.textContent.includes('7,0/10')
    ))).toBeInTheDocument()
    expect(screen.getByText((_, element) => (
      element.classList?.contains('staff-home-overall__status')
      && element.textContent.includes('Điểm sàn 7,0/10')
    ))).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()

    const currentYear = String(new Date().getFullYear())
    expect(staffApi.getMyDashboardFormSummary).toHaveBeenCalledWith(expect.objectContaining({
      fromDate: `${currentYear}-01-01`,
    }))
    expect(myCompetencyApi.getSummary).toHaveBeenCalledWith(expect.objectContaining({
      fromDate: `${currentYear}-01-01`,
    }))

    fireEvent.click(screen.getByRole('button', { name: /Đào tạo liên tục/i }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trang đào tạo' })).toBeInTheDocument())
  })

  it('calculates compliance from all passed submissions across different forms', async () => {
    staffApi.getMyDashboardFormSummary.mockReturnValue(response({
      formCount: 5,
      submittedCount: 30,
      passedCount: 6,
      averageConvertedScore: 7.59,
    }))

    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Routes>
          <Route path="/staff/dashboard" element={<DashboardStaffScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('20%')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.queryByText('75,9%')).not.toBeInTheDocument()
  })

  it('uses the default competency floor of six when the API has no department configuration', async () => {
    myCompetencyApi.getSummary.mockReturnValue(response({
      knowledgeAttemptCount: 0,
      knowledgeAverage: 0,
      skillEvaluationCount: 0,
      skillAverage: 0,
      overallScore: 0,
      targetScore: null,
      isPassed: false,
    }))

    const { container } = render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Routes>
          <Route path="/staff/dashboard" element={<DashboardStaffScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { level: 1 })
    const status = container.querySelector('.staff-home-overall__status')
    expect(status).toHaveTextContent('6,0/10')
    expect(status).not.toHaveTextContent('Chưa cấu hình')
  })
})
