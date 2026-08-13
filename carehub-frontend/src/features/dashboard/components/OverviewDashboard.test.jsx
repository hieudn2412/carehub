import React, { Profiler } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div>{children}</div>,
  Area: () => null,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

vi.mock('../../staff/api/staffApi.js', () => ({
  staffApi: {
    getAssignedForms: vi.fn().mockResolvedValue({ data: { data: { content: [], totalElements: 0 } } }),
  },
}))

const previousReact = globalThis.React
let OverviewDashboard
let Sidebar

beforeAll(async () => {
  globalThis.React = React
  OverviewDashboard = (await import('./OverviewDashboard.jsx')).default
  Sidebar = (await import('../../staff/components/sidebar.jsx')).default
})

afterAll(() => {
  globalThis.React = previousReact
})

function DashboardRouteHarness({ includeComplianceChart = false }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <>
      <output data-testid="pathname">{location.pathname}</output>
      <Routes>
        <Route
          path="/staff/dashboard"
          element={(
            <OverviewDashboard
              role="staff"
              profile={null}
              loading={false}
              error=""
              filters={{}}
              onNavigate={navigate}
              summary={{
                total: 0,
                passed: 0,
                failed: 0,
                rate: 0,
                totalDetail: 'Tổng quan',
                passedDetail: 'Đạt',
                failedDetail: 'Chưa đạt',
                rateDetail: 'Tỷ lệ',
              }}
              domains={{
                training: {
                  total: 1,
                  passed: 1,
                  failed: 0,
                  rate: 100,
                  available: true,
                  note: '1 / 1 giờ đã hoàn thành.',
                  path: '/staff/training',
                },
                exams: { available: false, total: 0, passed: 0, failed: 0, rate: 0 },
                quality: { available: false, total: 0, passed: 0, failed: 0, rate: 0 },
              }}
              {...(includeComplianceChart ? { complianceChart: [] } : {})}
            />
          )}
        />
        <Route path="/staff/training" element={<h1>Giờ đào tạo liên tục</h1>} />
      </Routes>
    </>
  )
}

describe('OverviewDashboard navigation regression', () => {
  it('does not enter a render loop when a staff dashboard omits compliance chart data', () => {
    let commitCount = 0

    expect(() => render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Profiler
          id="staff-dashboard"
          onRender={() => {
            commitCount += 1
            if (commitCount > 10) {
              throw new Error('Dashboard rendered more than 10 times before navigation')
            }
          }}
        >
          <DashboardRouteHarness />
        </Profiler>
      </MemoryRouter>,
    )).not.toThrow()

    expect(commitCount).toBeLessThanOrEqual(10)
  })

  it('renders the destination route after clicking a staff dashboard detail action', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <DashboardRouteHarness includeComplianceChart />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }))

    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/staff/training')
      expect(screen.getByRole('heading', { name: 'Giờ đào tạo liên tục' })).toBeInTheDocument()
    })
  })

  it('changes the route when a USER clicks the desktop sidebar training link', async () => {
    const payload = window.btoa(JSON.stringify({ roles: ['USER'] }))
    window.sessionStorage.setItem('carehub.accessToken', `header.${payload}.signature`)

    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Sidebar />
        <output data-testid="sidebar-path" />
        <Routes>
          <Route path="/staff/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/staff/training" element={<h1>Giờ đào tạo liên tục</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Theo dõi cá nhân/ }))
    fireEvent.click(screen.getByRole('link', { name: /Giờ đào tạo liên tục/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Giờ đào tạo liên tục' })).toBeInTheDocument()
    })
  })

  it('changes the route after a USER selects a mobile sidebar item and the drawer closes', async () => {
    const payload = window.btoa(JSON.stringify({ roles: ['USER'] }))
    window.sessionStorage.setItem('carehub.accessToken', `header.${payload}.signature`)

    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Sidebar />
        <Routes>
          <Route path="/staff/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/staff/training" element={<h1>Giờ đào tạo liên tục</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    const aside = screen.getByRole('complementary', { name: 'Điều hướng chính' })
    await act(async () => {
      window.dispatchEvent(new Event('staff-sidebar-toggle'))
    })
    await waitFor(() => expect(aside.querySelector('.staff-mobile-menu')).toHaveAttribute('aria-hidden', 'false'))

    const mobileNavigation = within(aside).getByRole('navigation', { name: 'Chức năng của nhân viên' })
    await act(async () => {
      fireEvent.click(within(mobileNavigation).getByRole('link', { name: /Giờ đào tạo liên tục/ }))
    })

    await waitFor(() => {
      expect(aside.querySelector('.staff-mobile-menu')).toHaveAttribute('aria-hidden', 'true')
    })
    await act(async () => {
      const transitionEvent = new Event('transitionend', { bubbles: true })
      Object.defineProperty(transitionEvent, 'propertyName', { value: 'transform' })
      aside.dispatchEvent(transitionEvent)
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Giờ đào tạo liên tục' })).toBeInTheDocument()
    })
  })

  it('resets manager compliance details when the chart data changes', async () => {
    const baseProps = {
      role: 'manager',
      profile: null,
      loading: false,
      error: '',
      filters: { departmentId: '' },
      summary: { total: 0, passed: 0, failed: 0, rate: 0 },
      domains: {
        training: { available: false, total: 0, passed: 0, failed: 0, rate: 0 },
        exams: { available: false, total: 0, passed: 0, failed: 0, rate: 0 },
        quality: { available: false, total: 0, passed: 0, failed: 0, rate: 0 },
      },
    }
    const chart = [{ id: 1, name: 'Bảng kiểm A', target: 80, actual: 70, total: 1, passed: 0 }]
    const { rerender } = render(
      <MemoryRouter>
        <OverviewDashboard {...baseProps} complianceChart={chart} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }))
    expect(screen.getByRole('heading', { name: 'Chi tiết tuân thủ theo bảng kiểm' })).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <OverviewDashboard
          {...baseProps}
          complianceChart={[{ ...chart[0], actual: 75 }]}
        />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chất lượng chăm sóc' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Chi tiết tuân thủ theo bảng kiểm' })).not.toBeInTheDocument()
    })
  })
})
