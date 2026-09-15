import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExamAssignmentListPage from './ExamAssignmentListPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({
  listAssignments: vi.fn(),
  openAssignment: vi.fn(),
  closeAssignment: vi.fn(),
  archiveAssignment: vi.fn(),
  getAssignmentResults: vi.fn(),
  getResultReport: vi.fn(),
  getAttemptResultBreakdown: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/examAssignmentApi.js', () => ({ examAssignmentApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, confirmText, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Hủy</button>
      <button onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options }) => (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))
vi.mock('../components/ExamManagementViewSwitch.jsx', () => ({
  default: ({ activeView, canViewPapers, canViewAssignments, onChange }) => (
    <div data-testid="view-switch" data-active={activeView}>
      {canViewPapers && <button onClick={() => onChange('papers')}>Bộ đề</button>}
      {canViewAssignments && <button onClick={() => onChange('assignments')}>Đợt giao đề</button>}
    </div>
  ),
}))
vi.mock('../components/ExamAssignmentAddTargetsModal.jsx', () => ({
  default: ({ assignment, onAdded, onClose }) => (
    <div role="dialog" aria-label="Thêm nhân viên vào đợt giao đề">
      <p>{assignment.name}</p>
      <button onClick={() => onAdded(2)}>Xác nhận thêm</button>
      <button onClick={onClose}>Đóng modal</button>
    </div>
  ),
}))

const openAssignment = {
  id: 1,
  name: 'Đợt kiểm tra quý 3',
  examPaperCode: 'DE-01',
  examPaperName: 'Kiểm soát nhiễm khuẩn',
  targetCount: 20,
  submittedTargetCount: 12,
  dueAt: '2026-09-01T10:00:00Z',
  status: 'OPEN',
  statusText: 'Đang mở',
}
const draftAssignment = {
  id: 2,
  name: 'Đợt nháp',
  examPaperCode: 'DE-02',
  examPaperName: 'An toàn người bệnh',
  targetCount: 5,
  submittedTargetCount: null,
  dueAt: null,
  status: 'DRAFT',
  statusText: 'Bản nháp',
}
const archivedAssignment = {
  id: 3,
  name: 'Đợt đã lưu trữ',
  examPaperCode: 'DE-03',
  examPaperName: 'Cấp cứu',
  targetCount: 8,
  submittedTargetCount: 8,
  dueAt: '2026-07-01T10:00:00Z',
  status: 'ARCHIVED',
  statusText: null,
}

const resultsPayload = {
  assignmentName: 'Đợt kiểm tra quý 3',
  examPaperCode: 'DE-01',
  examPaperName: 'Kiểm soát nhiễm khuẩn',
  targetCount: 20,
  notStartedCount: 3,
  submittedCount: 5,
  gradedCount: 12,
  averageScore: 7.4,
  bestScore: 9.5,
  rows: [
    {
      userId: 100, employeeCode: 'NV001', userName: 'Nguyễn Văn A', departmentName: 'Khoa Ngoại',
      attemptCount: 2, bestScore: 9.5, latestScore: 8, bestPassed: true,
      latestStatus: 'GRADED', latestStatusText: 'Đã chấm', latestSubmittedAt: '2026-08-25T02:00:00Z', latestAttemptId: 500,
    },
    {
      userId: 101, employeeCode: 'NV002', userName: 'Trần Thị B', departmentName: null,
      attemptCount: 0, bestScore: null, latestScore: null, bestPassed: null,
      latestStatus: null, latestStatusText: null, latestSubmittedAt: null, latestAttemptId: null,
    },
    {
      userId: 102, employeeCode: 'NV003', userName: 'Lê Văn C', departmentName: 'Khoa Nội',
      attemptCount: 1, bestScore: 4, latestScore: 4, bestPassed: false,
      latestStatus: 'IN_PROGRESS', latestStatusText: 'Đang làm', latestSubmittedAt: null, latestAttemptId: 501,
    },
  ],
}

const reportPayload = {
  fields: [{
    professionalFieldId: 1, professionalFieldCode: 'LV01', professionalFieldName: 'Vô khuẩn',
    correctCount: 30, totalQuestions: 40, averageScore: 7.5, passedAttempts: 8, evaluatedAttempts: 10,
  }],
  cells: [{
    professionalFieldId: 1, professionalFieldName: 'Vô khuẩn', cognitiveLevel: 'FOUNDATION',
    cognitiveLabel: 'Kiến thức nền tảng', correctCount: 15, totalQuestions: 20, evaluatedAttempts: 10, smallSample: false,
  }],
}

const breakdownPayload = {
  attemptId: 500,
  fields: [{
    professionalFieldId: 1, professionalFieldCode: 'LV01', professionalFieldName: 'Vô khuẩn',
    correctCount: 8, totalQuestions: 10, score: 8, passingThreshold: 7, passed: true,
  }],
  cells: [{
    professionalFieldId: 1, professionalFieldName: 'Vô khuẩn', cognitiveLevel: 'FOUNDATION',
    cognitiveLabel: 'Kiến thức nền tảng', correctCount: 4, totalQuestions: 5, smallSample: true,
  }],
  questions: [{
    paperQuestionId: 900, position: 1, professionalFieldName: 'Vô khuẩn',
    cognitiveLabel: 'Kiến thức nền tảng', stem: 'Rửa tay thường quy trong bao lâu?', correct: true,
  }],
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listAssignments.mockResolvedValue({ data: { data: [openAssignment, draftAssignment, archivedAssignment] } })
  api.openAssignment.mockResolvedValue({ data: { success: true } })
  api.closeAssignment.mockResolvedValue({ data: { success: true } })
  api.archiveAssignment.mockResolvedValue({ data: { success: true } })
  api.getAssignmentResults.mockResolvedValue({ data: { data: resultsPayload } })
  api.getResultReport.mockResolvedValue({ data: { data: reportPayload } })
  api.getAttemptResultBreakdown.mockResolvedValue({ data: { data: breakdownPayload } })
})

const renderPage = async (props = {}) => {
  render(<ExamAssignmentListPage {...props} />)
  await screen.findByText('Đợt kiểm tra quý 3')
}

const rowOf = (name) => screen.getByText(name).closest('tr')
const openResults = async () => {
  fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Xem điểm'))
  await screen.findByText('Nguyễn Văn A')
}

describe('ExamAssignmentListPage - danh sách đợt giao đề', () => {
  it('tải và hiển thị đầy đủ cột của từng đợt giao', async () => {
    render(<ExamAssignmentListPage />)
    expect(screen.getByText('Đang tải các đợt giao đề...')).toBeInTheDocument()

    await screen.findByText('Đợt kiểm tra quý 3')
    expect(api.listAssignments).toHaveBeenCalledWith({})
    expect(screen.getByText('DE-01 - Kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(screen.getByText('12/20')).toBeInTheDocument()
    // submittedTargetCount null phải hiện 0 thay vì rỗng
    expect(screen.getByText('0/5')).toBeInTheDocument()
    expect(screen.getByText('Đang mở')).toBeInTheDocument()
    // thiếu statusText thì rơi về mã trạng thái
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có đợt giao nào', async () => {
    api.listAssignments.mockResolvedValue({ data: { data: [] } })
    render(<ExamAssignmentListPage />)
    expect(await screen.findByText('Chưa có đợt giao đề nào.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải danh sách thất bại', async () => {
    api.listAssignments.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<ExamAssignmentListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('tải lại danh sách khi bấm nút Tải lại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tải lại/ }))
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledTimes(2))
  })

  it('chuyển sang trang tạo bài kiểm tra mới', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tạo bài kiểm tra mới/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/exam-management/new')
  })

  it('chuyển tab qua ExamManagementViewSwitch', async () => {
    const onViewChange = vi.fn()
    await renderPage({ onViewChange })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ đề' }))
    expect(onViewChange).toHaveBeenCalledWith('papers')
    expect(screen.getByTestId('view-switch')).toHaveAttribute('data-active', 'assignments')
  })

  it('ẩn tab bộ đề khi không có quyền', async () => {
    await renderPage({ canViewPapers: false })
    expect(screen.queryByRole('button', { name: 'Bộ đề' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đợt giao đề' })).toBeInTheDocument()
  })
})

describe('ExamAssignmentListPage - tìm kiếm và lọc', () => {
  it('tìm theo tên đợt, tên đề và mã đề', async () => {
    await renderPage()
    const search = screen.getByPlaceholderText('Tìm đợt giao, mã đề, tên đề')

    fireEvent.change(search, { target: { value: 'QUÝ 3' } })
    await waitFor(() => expect(screen.queryByText('Đợt nháp')).not.toBeInTheDocument())

    fireEvent.change(search, { target: { value: 'an toàn' } })
    expect(await screen.findByText('Đợt nháp')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'de-03' } })
    expect(await screen.findByText('Đợt đã lưu trữ')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'không có' } })
    expect(await screen.findByText('Chưa có đợt giao đề nào.')).toBeInTheDocument()
  })

  it('lọc theo trạng thái và hiện chỉ báo số bộ lọc đang bật', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    expect(screen.getByRole('button', { name: /Bộ lọc/ })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'DRAFT' } })
    await waitFor(() => expect(screen.queryByText('Đợt kiểm tra quý 3')).not.toBeInTheDocument())
    expect(screen.getByText('Đợt nháp')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Bộ lọc/ })).getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    expect(screen.queryByLabelText('Trạng thái')).not.toBeInTheDocument()
  })
})

describe('ExamAssignmentListPage - vòng đời đợt giao', () => {
  it('chỉ hiện nút mở cho đợt chưa mở và chưa lưu trữ', async () => {
    await renderPage()
    expect(within(rowOf('Đợt nháp')).getByTitle('Mở')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra quý 3')).queryByTitle('Mở')).not.toBeInTheDocument()
    expect(within(rowOf('Đợt đã lưu trữ')).queryByTitle('Mở')).not.toBeInTheDocument()
  })

  it('chỉ hiện nút đóng và giao bổ sung cho đợt đang mở', async () => {
    await renderPage()
    expect(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Đóng')).toBeInTheDocument()
    expect(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Giao bổ sung nhân viên')).toBeInTheDocument()
    expect(within(rowOf('Đợt nháp')).queryByTitle('Đóng')).not.toBeInTheDocument()
  })

  it('mở đợt giao rồi tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt nháp')).getByTitle('Mở'))

    await waitFor(() => expect(api.openAssignment).toHaveBeenCalledWith(2))
    expect(showToast).toHaveBeenCalledWith('Đã mở đợt giao đề.', 'success')
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledTimes(2))
  })

  it('báo lỗi khi mở đợt giao thất bại', async () => {
    api.openAssignment.mockRejectedValue({ response: { data: { message: 'Đề chưa xuất bản' } } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt nháp')).getByTitle('Mở'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đề chưa xuất bản', 'error'))
  })

  it('đóng đợt giao rồi tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Đóng'))

    await waitFor(() => expect(api.closeAssignment).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã đóng đợt giao đề.', 'success')
  })

  it('báo lỗi khi đóng đợt giao thất bại', async () => {
    api.closeAssignment.mockRejectedValue(new Error('boom'))
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Đóng'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })

  it('khoá nút lưu trữ với đợt đã lưu trữ', async () => {
    await renderPage()
    expect(within(rowOf('Đợt đã lưu trữ')).getByTitle('Lưu trữ')).toBeDisabled()
    expect(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Lưu trữ')).toBeEnabled()
  })

  it('hỏi xác nhận trước khi lưu trữ rồi gọi API', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Lưu trữ'))

    const dialog = screen.getByRole('dialog', { name: 'Lưu trữ đợt giao đề?' })
    expect(within(dialog).getByText(/Đợt kiểm tra quý 3/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu trữ đợt giao' }))

    await waitFor(() => expect(api.archiveAssignment).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã lưu trữ đợt giao đề.', 'success')
  })

  it('không lưu trữ khi người dùng bấm Hủy', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Lưu trữ'))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Lưu trữ đợt giao đề?' })).getByRole('button', { name: 'Hủy' }))

    expect(screen.queryByRole('dialog', { name: 'Lưu trữ đợt giao đề?' })).not.toBeInTheDocument()
    expect(api.archiveAssignment).not.toHaveBeenCalled()
  })

  it('báo lỗi khi lưu trữ thất bại', async () => {
    api.archiveAssignment.mockRejectedValue({ response: { data: { message: 'Đợt đang mở' } } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Lưu trữ'))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Lưu trữ đợt giao đề?' })).getByRole('button', { name: 'Lưu trữ đợt giao' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đợt đang mở', 'error'))
  })
})

describe('ExamAssignmentListPage - bảng điểm', () => {
  it('mở bảng điểm với tổng hợp, báo cáo lĩnh vực và danh sách nhân viên', async () => {
    await renderPage()
    await openResults()

    expect(api.getAssignmentResults).toHaveBeenCalledWith(1)
    expect(api.getResultReport).toHaveBeenCalledWith(1)
    expect(screen.getByText('DE-01 · Kiểm soát nhiễm khuẩn')).toBeInTheDocument()
    expect(screen.getByText('7.4')).toBeInTheDocument()
    expect(screen.getAllByText('9.5').length).toBeGreaterThan(0)
    // submittedCount + gradedCount
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('LV01 · Vô khuẩn')).toBeInTheDocument()
    expect(screen.getByText('30/40')).toBeInTheDocument()
    expect(screen.getByText('8/10')).toBeInTheDocument()
    expect(screen.getByText('Đủ mẫu')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getByText('Không đạt')).toBeInTheDocument()
    expect(screen.getByText('Chưa có điểm')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa làm')).toHaveLength(2)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('đóng bảng điểm khi bấm lại nút xem điểm', async () => {
    await renderPage()
    await openResults()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Xem điểm'))
    await waitFor(() => expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument())
  })

  it('đóng bảng điểm bằng nút Đóng', async () => {
    await renderPage()
    await openResults()
    fireEvent.click(screen.getByRole('button', { name: /Đóng$/ }))
    await waitFor(() => expect(screen.queryByText('Nguyễn Văn A')).not.toBeInTheDocument())
  })

  it('hiện trạng thái đang tải rồi thu gọn lại khi tải điểm lỗi', async () => {
    api.getAssignmentResults.mockRejectedValue({ response: { data: { message: 'Chưa có dữ liệu điểm' } } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Xem điểm'))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Chưa có dữ liệu điểm', 'error'))
    expect(screen.queryByText('Đang tải điểm...')).not.toBeInTheDocument()
  })

  it('hiển thị dòng rỗng khi báo cáo lĩnh vực và cell trống', async () => {
    api.getResultReport.mockResolvedValue({ data: { data: { fields: [], cells: [] } } })
    await renderPage()
    await openResults()

    expect(screen.getByText('Chưa có lượt thi đã chấm theo lĩnh vực.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có dữ liệu cell.')).toBeInTheDocument()
  })

  it('ẩn khối báo cáo khi máy chủ không trả về report', async () => {
    api.getResultReport.mockResolvedValue({ data: { data: null } })
    await renderPage()
    await openResults()

    expect(screen.queryByText('Độ phủ kết quả theo lĩnh vực')).not.toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
  })

  it('hiện thông báo khi đợt giao chưa có nhân viên', async () => {
    api.getAssignmentResults.mockResolvedValue({ data: { data: { ...resultsPayload, rows: [] } } })
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Xem điểm'))

    expect(await screen.findByText('Chưa có nhân viên trong bài kiểm tra này.')).toBeInTheDocument()
  })

  it('đánh dấu mẫu nhỏ trong heatmap', async () => {
    api.getResultReport.mockResolvedValue({
      data: { data: { fields: [], cells: [{ ...reportPayload.cells[0], smallSample: true }] } },
    })
    await renderPage()
    await openResults()
    expect(screen.getByText(/Mẫu nhỏ \(≤ 1 câu\/lượt\)/)).toBeInTheDocument()
  })
})

describe('ExamAssignmentListPage - phân tích lượt làm bài', () => {
  const openBreakdown = async () => {
    await renderPage()
    await openResults()
    fireEvent.click(within(rowOf('NV001')).getByRole('button', { name: 'Xem chi tiết' }))
    await screen.findByText('Rửa tay thường quy trong bao lâu?')
  }

  it('chỉ bật nút chi tiết cho lượt đã chấm', async () => {
    await renderPage()
    await openResults()

    expect(within(rowOf('NV001')).getByRole('button', { name: 'Xem chi tiết' })).toBeEnabled()
    // chưa làm bài -> không có attempt
    expect(within(rowOf('NV002')).getByRole('button', { name: 'Xem chi tiết' })).toBeDisabled()
    // đang làm, chưa chấm
    expect(within(rowOf('NV003')).getByRole('button', { name: 'Xem chi tiết' })).toBeDisabled()
  })

  it('tải và hiển thị phân tích theo lĩnh vực, mức nhận thức và từng câu', async () => {
    await openBreakdown()

    expect(api.getAttemptResultBreakdown).toHaveBeenCalledWith(500)
    expect(screen.getByText('Phân tích lượt làm bài')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText(/Mẫu nhỏ \(≤ 1 câu\)/)).toBeInTheDocument()
    expect(screen.getByText('Đúng')).toBeInTheDocument()
  })

  it('thu gọn phân tích khi bấm lại nút của cùng một lượt', async () => {
    await openBreakdown()
    fireEvent.click(within(rowOf('NV001')).getByRole('button', { name: 'Ẩn chi tiết' }))
    await waitFor(() => expect(screen.queryByText('Rửa tay thường quy trong bao lâu?')).not.toBeInTheDocument())
  })

  it('đóng phân tích bằng nút Đóng riêng của khối', async () => {
    await openBreakdown()
    const panel = screen.getByText('Phân tích lượt làm bài').closest('section')
    fireEvent.click(within(panel).getByRole('button', { name: /Đóng/ }))
    await waitFor(() => expect(screen.queryByText('Rửa tay thường quy trong bao lâu?')).not.toBeInTheDocument())
  })

  it('báo lỗi khi tải phân tích thất bại', async () => {
    api.getAttemptResultBreakdown.mockRejectedValue({ response: { data: { message: 'Không tìm thấy lượt thi' } } })
    await renderPage()
    await openResults()
    fireEvent.click(within(rowOf('NV001')).getByRole('button', { name: 'Xem chi tiết' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy lượt thi', 'error'))
    expect(screen.queryByText('Phân tích lượt làm bài')).not.toBeInTheDocument()
  })

  it('chịu được payload phân tích rỗng', async () => {
    api.getAttemptResultBreakdown.mockResolvedValue({ data: { data: { attemptId: 500 } } })
    await renderPage()
    await openResults()
    fireEvent.click(within(rowOf('NV001')).getByRole('button', { name: 'Xem chi tiết' }))

    expect(await screen.findByText('Phân tích lượt làm bài')).toBeInTheDocument()
  })
})

describe('ExamAssignmentListPage - giao bổ sung nhân viên', () => {
  it('mở modal, thêm nhân viên rồi làm mới danh sách', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Giao bổ sung nhân viên'))

    const dialog = await screen.findByRole('dialog', { name: 'Thêm nhân viên vào đợt giao đề' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận thêm' }))
    await waitFor(() => expect(api.listAssignments).toHaveBeenCalledTimes(2))
  })

  it('nạp lại bảng điểm khi đợt đang mở bảng điểm được giao bổ sung', async () => {
    await renderPage()
    await openResults()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Giao bổ sung nhân viên'))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Thêm nhân viên vào đợt giao đề' })).getByRole('button', { name: 'Xác nhận thêm' }))

    await waitFor(() => expect(api.getAssignmentResults).toHaveBeenCalledTimes(2))
    expect(api.getResultReport).toHaveBeenCalledTimes(2)
  })

  it('báo lỗi khi nạp lại bảng điểm sau giao bổ sung thất bại', async () => {
    await renderPage()
    await openResults()
    api.getAssignmentResults.mockRejectedValue({ response: { data: { message: 'Lỗi tải lại điểm' } } })
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Giao bổ sung nhân viên'))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Thêm nhân viên vào đợt giao đề' })).getByRole('button', { name: 'Xác nhận thêm' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Lỗi tải lại điểm', 'error'))
  })

  it('đóng modal mà không gọi thêm API', async () => {
    await renderPage()
    fireEvent.click(within(rowOf('Đợt kiểm tra quý 3')).getByTitle('Giao bổ sung nhân viên'))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Thêm nhân viên vào đợt giao đề' })).getByRole('button', { name: 'Đóng modal' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm nhân viên vào đợt giao đề' })).not.toBeInTheDocument())
    expect(api.listAssignments).toHaveBeenCalledTimes(1)
  })
})
