import { Profiler } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import OverviewDashboard from './OverviewDashboard.jsx'
import Sidebar from '../../staff/components/sidebar.jsx'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'

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
  const managementDomains = {
    training: { available: true, total: 4, passed: 2, failed: 2, rate: 50 },
    exams: { available: true, total: 3, passed: 1, failed: 2, rate: 33.3, knowledgeAverage: 7.5, skillAverage: 6.5 },
    quality: { available: true, total: 5, passed: 4, failed: 1, rate: 80 },
  }

  it('does not present the overall competency pass rate as a knowledge-specific percentage', () => {
    render(
      <MemoryRouter>
        <OverviewDashboard
          role="admin"
          loading={false}
          error=""
          filters={{ departmentId: '', employeeCode: '', content: 'knowledge', fromDate: '', toDate: '' }}
          departments={[]}
          onFilterChange={vi.fn()}
          domains={managementDomains}
          complianceChart={[]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('TB 7,5/10')).toBeInTheDocument()
    expect(screen.getByText('3 nhân viên')).toBeInTheDocument()
    expect(screen.queryByText('33,3%')).not.toBeInTheDocument()
  })

  it('counts changed date filters and can reset the complete admin scope', () => {
    const onFilterChange = vi.fn()
    render(
      <MemoryRouter>
        <OverviewDashboard
          role="admin"
          loading={false}
          error=""
          filters={{ departmentId: '10', employeeCode: 'NV001', content: 'compliance', fromDate: '2025-01-01', toDate: '2025-12-31' }}
          departments={[]}
          onFilterChange={onFilterChange}
          domains={managementDomains}
          complianceChart={[]}
        />
      </MemoryRouter>,
    )

    const filterButton = screen.getByRole('button', { name: /Bộ lọc/ })
    expect(filterButton).toHaveTextContent('5')
    fireEvent.click(filterButton)
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(onFilterChange).toHaveBeenCalledWith('departmentId', '')
    expect(onFilterChange).toHaveBeenCalledWith('employeeCode', '')
    expect(onFilterChange).toHaveBeenCalledWith('content', 'all')
    expect(onFilterChange).toHaveBeenCalledWith('fromDate', expect.stringMatching(/^\d{4}-01-01$/))
    expect(onFilterChange).toHaveBeenCalledWith('toDate', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

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
    tokenStorage.setAccessToken(`header.${payload}.signature`)

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
    fireEvent.click(screen.getByRole('link', { name: /Đào tạo liên tục/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Giờ đào tạo liên tục' })).toBeInTheDocument()
    })
  })

  it('keeps the personal tracking section open after navigating to evaluation history', async () => {
    const payload = window.btoa(JSON.stringify({ roles: ['USER'] }))
    tokenStorage.setAccessToken(`header.${payload}.signature`)

    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Sidebar />
        <Routes>
          <Route path="/staff/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/staff/quality/history" element={<h1>Lịch sử đánh giá</h1>} />
        </Routes>
      </MemoryRouter>,
    )

    const desktopNavigation = document.querySelector('.sidebar__nav')
    const trackingTrigger = within(desktopNavigation).getByRole('button', { name: /Theo dõi cá nhân/ })

    fireEvent.click(trackingTrigger)
    fireEvent.click(within(desktopNavigation).getByRole('link', { name: /Lịch sử đánh giá/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Lịch sử đánh giá' })).toBeInTheDocument()
      expect(trackingTrigger).toHaveAttribute('aria-expanded', 'true')
    })
  })

  it('changes the route after a USER selects a mobile sidebar item and the drawer closes', async () => {
    const payload = window.btoa(JSON.stringify({ roles: ['USER'] }))
    tokenStorage.setAccessToken(`header.${payload}.signature`)

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
      fireEvent.click(within(mobileNavigation).getByRole('link', { name: /Đào tạo liên tục/ }))
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
