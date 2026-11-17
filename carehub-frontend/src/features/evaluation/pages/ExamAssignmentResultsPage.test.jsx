import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExamAssignmentResultsPage from './ExamAssignmentResultsPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({
  getAssignmentResults: vi.fn(),
  exportAssignmentResults: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ assignmentId: '6' }),
}))

vi.mock('../api/examAssignmentApi.js', () => ({
  examAssignmentApi: api,
}))

vi.mock('../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => ({ showToast }),
}))

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main data-testid="app-shell">{children}</main>,
}))

const mockResultsData = {
  assignmentId: 6,
  assignmentName: 'Đợt kiểm tra quy trình tiêm an toàn',
  examPaperId: 12,
  examPaperCode: 'DT-01',
  examPaperName: 'Quy trình tiêm và an toàn người bệnh',
  targetCount: 4,
  submittedCount: 2,
  gradedCount: 2,
  averageScore: 8.5,
  bestScore: 10,
  rows: [
    {
      userId: 101,
      userName: 'Nguyễn Văn An',
      employeeCode: 'NV001',
      departmentName: 'Khoa Cấp cứu',
      attemptCount: 2,
      latestAttemptId: 201,
      latestStatus: 'GRADED',
      latestStatusText: 'Đã chấm',
      bestScore: 9.5,
      latestScore: 9.5,
      bestPassed: true,
      latestPassed: true,
      latestSubmittedAt: '2026-08-15T09:30:00Z',
      latestTabSwitchCount: 0,
    },
    {
      userId: 102,
      userName: 'Trần Thị Bình',
      employeeCode: 'NV002',
      departmentName: 'Khoa Cấp cứu',
      attemptCount: 1,
      latestAttemptId: 202,
      latestStatus: 'GRADED',
      latestStatusText: 'Đã chấm',
      bestScore: 5.0,
      latestScore: 5.0,
      bestPassed: false,
      latestPassed: false,
      latestSubmittedAt: '2026-08-15T10:15:00Z',
      latestTabSwitchCount: 2,
    },
    {
      userId: 103,
      userName: 'Lê Hoàng Cường',
      employeeCode: 'NV003',
      departmentName: 'Khoa Hồi sức tích cực',
      attemptCount: 1,
      latestAttemptId: 203,
      latestStatus: 'IN_PROGRESS',
      latestStatusText: 'Đang làm',
      bestScore: null,
      latestScore: null,
      bestPassed: null,
      latestPassed: null,
      latestSubmittedAt: null,
      latestTabSwitchCount: 1,
    },
    {
      userId: 104,
      userName: 'Phạm Minh Đức',
      employeeCode: 'NV004',
      departmentName: 'Khoa Ngoại',
      attemptCount: 0,
      latestAttemptId: null,
      latestStatus: 'NOT_STARTED',
      latestStatusText: 'Chưa làm',
      bestScore: null,
      latestScore: null,
      bestPassed: null,
      latestPassed: null,
      latestSubmittedAt: null,
      latestTabSwitchCount: 0,
    },
  ],
}

describe('ExamAssignmentResultsPage with Filter and Filtered Excel Export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAssignmentResults.mockResolvedValue({ data: { data: mockResultsData } })
    api.exportAssignmentResults.mockResolvedValue({
      data: new Blob(['mock-excel-bytes'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    })

    // Mock window.URL methods and anchor click to avoid jsdom navigation warning
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    window.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('renders assignment information, summary cards, and all rows initially', async () => {
    render(<ExamAssignmentResultsPage />)

    expect(await screen.findByText('Đợt kiểm tra quy trình tiêm an toàn')).toBeInTheDocument()
    expect(screen.getByText('Tổng nhân viên')).toBeInTheDocument()
    expect(screen.getByText('Vi phạm giám sát')).toBeInTheDocument()
    expect(screen.getByText('2 nhân viên')).toBeInTheDocument() // 2 candidates with violations (NV002, NV003)

    // Check all 4 candidates rendered
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
    expect(screen.getByText('Lê Hoàng Cường')).toBeInTheDocument()
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument()

    // Status bar shows 4/4
    expect(screen.getByText(/Đang hiển thị/)).toBeInTheDocument()
  })

  it('filters rows by search keyword (name or employee code)', async () => {
    render(<ExamAssignmentResultsPage />)
    await screen.findByText('Nguyễn Văn An')

    const searchInput = screen.getByPlaceholderText('Tìm theo họ tên hoặc mã nhân viên...')

    // Search by name
    fireEvent.change(searchInput, { target: { value: 'Bình' } })
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument()
    expect(screen.queryByText('Phạm Minh Đức')).not.toBeInTheDocument()

    // Search by code
    fireEvent.change(searchInput, { target: { value: 'NV004' } })
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument()
    expect(screen.queryByText('Trần Thị Bình')).not.toBeInTheDocument()

    // Clear search button
    const clearBtn = screen.getByLabelText('Xóa từ khóa tìm kiếm')
    fireEvent.click(clearBtn)
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
  })

  it('filters rows by department dropdown', async () => {
    render(<ExamAssignmentResultsPage />)
    await screen.findByText('Nguyễn Văn An')

    const deptSelect = screen.getByLabelText('Khoa/phòng')
    fireEvent.change(deptSelect, { target: { value: 'Khoa Cấp cứu' } })

    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
    expect(screen.queryByText('Lê Hoàng Cường')).not.toBeInTheDocument()
    expect(screen.queryByText('Phạm Minh Đức')).not.toBeInTheDocument()
  })

  it('filters rows by result status dropdown', async () => {
    render(<ExamAssignmentResultsPage />)
    await screen.findByText('Nguyễn Văn An')

    const statusSelect = screen.getByLabelText('Đánh giá / Kết quả')

    // Filter 'passed'
    fireEvent.change(statusSelect, { target: { value: 'passed' } })
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.queryByText('Trần Thị Bình')).not.toBeInTheDocument()

    // Filter 'failed'
    fireEvent.change(statusSelect, { target: { value: 'failed' } })
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument()

    // Filter 'not_started'
    fireEvent.change(statusSelect, { target: { value: 'not_started' } })
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument()
  })

  it('filters rows by monitoring violation status', async () => {
    render(<ExamAssignmentResultsPage />)
    await screen.findByText('Nguyễn Văn An')

    const violationSelect = screen.getByLabelText('Giám sát vi phạm')

    // Only candidates with violations (NV002, NV003)
    fireEvent.change(violationSelect, { target: { value: 'has_violation' } })
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
    expect(screen.getByText('Lê Hoàng Cường')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument()
    expect(screen.queryByText('Phạm Minh Đức')).not.toBeInTheDocument()

    // Only clean candidates (NV001, NV004)
    fireEvent.change(violationSelect, { target: { value: 'clean' } })
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument()
    expect(screen.queryByText('Trần Thị Bình')).not.toBeInTheDocument()
    expect(screen.queryByText('Lê Hoàng Cường')).not.toBeInTheDocument()
  })

  it('resets all filters when clicking "Xóa bộ lọc"', async () => {
    render(<ExamAssignmentResultsPage />)
    await screen.findByText('Nguyễn Văn An')

    const searchInput = screen.getByPlaceholderText('Tìm theo họ tên hoặc mã nhân viên...')
    fireEvent.change(searchInput, { target: { value: 'Không_tồn_tại' } })

    expect(screen.getByText('Không tìm thấy nhân viên nào phù hợp với bộ lọc đã chọn.')).toBeInTheDocument()

    const resetButtons = screen.getAllByRole('button', { name: /Xóa bộ lọc/ })
    fireEvent.click(resetButtons[0])

    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument()
  })

  it('exports to Excel with active filter parameters when clicking "Xuất Excel"', async () => {
    render(<ExamAssignmentResultsPage />)
    await screen.findByText('Nguyễn Văn An')

    // Apply department filter
    const deptSelect = screen.getByLabelText('Khoa/phòng')
    fireEvent.change(deptSelect, { target: { value: 'Khoa Cấp cứu' } })

    // Apply violation filter
    const violationSelect = screen.getByLabelText('Giám sát vi phạm')
    fireEvent.change(violationSelect, { target: { value: 'has_violation' } })

    // Click Export Excel button
    const exportBtn = screen.getAllByRole('button', { name: /Xuất Excel/ })[0]
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(api.exportAssignmentResults).toHaveBeenCalledWith('6', {
        department: 'Khoa Cấp cứu',
        violation: true,
      })
    })

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('theo bộ lọc'),
      'success',
    )
  })
})
