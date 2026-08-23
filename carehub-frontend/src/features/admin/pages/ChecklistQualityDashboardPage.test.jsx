import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ChecklistQualityDashboardPage from './ChecklistQualityDashboardPage.jsx'
import { adminApi } from '../api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))

vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, id, onChange, options, placeholder, value, disabled }) => (
    <select id={id} aria-label={ariaLabel || placeholder} disabled={disabled} onChange={(event) => onChange && onChange(event.target.value)} value={value}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

vi.mock('../api/adminApi.js', () => ({
  adminApi: {
    getDepartments: vi.fn(),
    getFormHistoryVersions: vi.fn(),
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

const secondChecklist = {
  ...checklist,
  complianceRate: 62.5,
  formCode: 'QT-CS-02',
  formId: 21,
  formTitle: 'Quy trình thay băng vết thương',
  lastSubmittedAt: '2026-08-11T02:30:00Z',
  monitoringCount: 8,
  passedCount: 5,
  failedCount: 3,
  targetPercent: 85,
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

function renderDashboard(ui, initialEntry = '/') {
  return render(<MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>)
}

describe('ChecklistQualityDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getDepartments.mockResolvedValue({ data: { data: { content: [] } } })
    adminApi.getQualityChecklistDashboard.mockImplementation((params = {}) => {
      const allChecklists = [checklist, secondChecklist]
      if (params.formId) {
        return Promise.resolve(dashboardResponse(allChecklists.filter((item) => String(item.formId) === String(params.formId))))
      }
      return Promise.resolve(dashboardResponse(params.view === 'LATEST' ? [checklist] : allChecklists))
    })
    adminApi.getQualityChecklistFilterOptions.mockResolvedValue({
      data: { data: { evaluators: [], forms: [], subjects: [] } },
    })
    adminApi.getQualityChecklistTrend.mockResolvedValue({ data: { data: { items: [] } } })
    adminApi.getFormHistoryVersions.mockResolvedValue({ data: { data: [{ versionId: 19, versionNumber: 1 }] } })
    staffApi.getProfile.mockResolvedValue({
      data: { data: { departmentId: 7, departmentName: 'Khoa Điều dưỡng' } },
    })
  })

  it('shows a filtered checklist list first, then opens the selected checklist detail', async () => {
    const { container } = renderDashboard(<ChecklistQualityDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    await waitFor(() => {
      expect(adminApi.getQualityChecklistTrend).toHaveBeenCalled()
    })
    vi.clearAllMocks()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'PASSED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByRole('heading', { name: 'Danh sách bảng kiểm' })).toBeInTheDocument()
    await waitFor(() => {
      expect(adminApi.getQualityChecklistDashboard).toHaveBeenCalledWith(expect.objectContaining({
        resultStatus: 'PASSED',
        view: 'FILTERED',
      }))
    })
    expect(screen.getByText('Quy trình thay băng vết thương')).toBeInTheDocument()
    expect(container.querySelectorAll('.checklist-quality-process-card__top button')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Cấu hình mục tiêu/i })).not.toBeInTheDocument()
    expect(screen.queryByText('KẾT QUẢ BẢNG KIỂM ĐANG CHỌN')).not.toBeInTheDocument()
    expect(adminApi.getQualityChecklistTrend).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByText('Quy trình chăm sóc người bệnh')[0])

    expect(await screen.findByRole('heading', { name: 'Bảng kiểm đã chọn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Danh sách bảng kiểm đã lọc/i })).toBeInTheDocument()
    expect(screen.getByText('KẾT QUẢ BẢNG KIỂM ĐANG CHỌN')).toBeInTheDocument()
    const workspace = container.querySelector('.checklist-quality-workspace')
    expect(workspace).toContainElement(container.querySelector('.checklist-quality-processes'))
    expect(workspace).toContainElement(container.querySelector('.checklist-quality-detail'))
    await waitFor(() => {
      expect(adminApi.getQualityChecklistTrend).toHaveBeenCalledWith(expect.objectContaining({
        formId: '19',
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: /Danh sách bảng kiểm đã lọc/i }))

    expect(await screen.findByRole('heading', { name: 'Danh sách bảng kiểm' })).toBeInTheDocument()
    expect(screen.getByText('Quy trình thay băng vết thương')).toBeInTheDocument()
    expect(screen.queryByText('KẾT QUẢ BẢNG KIỂM ĐANG CHỌN')).not.toBeInTheDocument()
  })

  it('opens results from the checklist list button without selecting the card', async () => {
    const { container } = renderDashboard(<ChecklistQualityDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    vi.clearAllMocks()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'PASSED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByRole('heading', { name: 'Danh sách bảng kiểm' })).toBeInTheDocument()
    fireEvent.click(container.querySelectorAll('.checklist-quality-process-card__top button')[0])

    await waitFor(() => {
      expect(adminApi.getFormHistoryVersions).toHaveBeenCalledWith(19, expect.objectContaining({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      }))
    })
    expect(screen.queryByText('KẾT QUẢ BẢNG KIỂM ĐANG CHỌN')).not.toBeInTheDocument()
    expect(adminApi.getQualityChecklistTrend).not.toHaveBeenCalled()
  })

  it('searches checklists only after applying the draft keyword', async () => {
    renderDashboard(<ChecklistQualityDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    vi.clearAllMocks()

    fireEvent.change(screen.getByLabelText('Tìm theo tên hoặc mã quy trình'), {
      target: { value: 'thay bang' },
    })
    expect(adminApi.getQualityChecklistDashboard).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(adminApi.getQualityChecklistDashboard).toHaveBeenCalledWith(expect.objectContaining({
        keyword: 'thay bang',
        view: 'FILTERED',
      }))
    })
  })

  it('restores the selected checklist detail from return query params', async () => {
    renderDashboard(
      <ChecklistQualityDashboardPage />,
      '/admin/reports/checklist-dashboard?dateFrom=2026-01-01&dateTo=2026-08-22&selectedFormId=19',
    )

    expect(await screen.findByRole('heading', { name: 'Bảng kiểm đã chọn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Danh sách bảng kiểm đã lọc/i })).toBeInTheDocument()
    expect(await screen.findByText('KẾT QUẢ BẢNG KIỂM ĐANG CHỌN')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Danh sách bảng kiểm đã lọc/i }))

    expect(await screen.findByRole('heading', { name: 'Danh sách bảng kiểm' })).toBeInTheDocument()
    expect(screen.getByText('Quy trình thay băng vết thương')).toBeInTheDocument()
  })

  it('shows the latest scored date when a checklist has one submission', async () => {
    const { container } = renderDashboard(<ChecklistQualityDashboardPage />)

    expect(await screen.findByText('Chấm gần nhất:')).toBeInTheDocument()
    const submittedAt = screen.getByText(/10\/08\/2026/)
    expect(submittedAt).toHaveAttribute('datetime', checklist.lastSubmittedAt)
    expect(container.querySelector('.checklist-quality-process-card__top button')).toHaveTextContent('Xem kết quả')
    expect(screen.queryByRole('button', { name: /Cấu hình mục tiêu/i })).not.toBeInTheDocument()
  })

  it('only requests user dashboard data after applying draft filters', async () => {
    renderDashboard(<ChecklistQualityDashboardPage role="user" />)

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

  it('only requests admin dashboard data after applying draft filters', async () => {
    renderDashboard(<ChecklistQualityDashboardPage />)

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
    renderDashboard(<ChecklistQualityDashboardPage role="manager" />)

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

  it('renders department filter for manager and is fixed to own department', async () => {
    renderDashboard(<ChecklistQualityDashboardPage role="manager" />)

    expect(await screen.findByRole('heading', { name: 'Quy trình chăm sóc người bệnh' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/i }))

    expect(screen.getByText('Khoa/phòng')).toBeInTheDocument()
    const selects = screen.getAllByRole('combobox')
    const deptSelect = selects.find((el) => el.value === '7')
    expect(deptSelect).toBeDefined()
    expect(deptSelect).toBeDisabled()
  })
})
