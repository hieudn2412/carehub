import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminQualityHistoryDetailPage from './AdminQualityHistoryDetailPage.jsx'

const navigate = vi.fn()
const route = { params: { id: '31' }, search: '' }
const shell = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({
  getFormSubmission: vi.fn(),
  getFormVersionById: vi.fn(),
  getFormHistoryVersionById: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
  useSearchParams: () => [new URLSearchParams(route.search)],
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, back, breadcrumbs }) => {
    shell.current = { back, breadcrumbs }
    return (
      <main>
        <button onClick={back.onClick}>{back.label}</button>
        <nav data-testid="breadcrumbs">{breadcrumbs.map((crumb) => `${crumb.label}|${crumb.link || ''}`).join(' / ')}</nav>
        {children}
      </main>
    )
  },
}))

const submission = (overrides = {}) => ({
  id: 31,
  formId: 5,
  formVersionId: 9,
  formCode: 'HAND_HYGIENE_COMPLIANCE',
  versionNumber: 3,
  title: 'Tuân thủ vệ sinh tay',
  convertedScore: 8.5,
  passingScore: 7,
  result: 'PASSED',
  criticalFailure: false,
  submittedAt: '2026-08-01T03:05:00',
  subject: { fullName: 'Nguyễn Văn A', employeeCode: 'NV001', department: 'Khoa Nội' },
  submittedBy: { fullName: 'Trần Thị B', employeeCode: 'NV002' },
  answers: [
    { questionKey: 'q1', optionKey: 'yes' },
    { questionKey: 'q2', value: { textValue: 'Ghi chú tự do' } },
  ],
  scoreBreakdown: [
    { questionKey: 'q1', weightedScore: 2, maxScore: 2 },
    { questionKey: 'q2', weightedScore: 1, maxScore: 3 },
  ],
  ...overrides,
})

const version = (overrides = {}) => ({
  id: 9,
  title: 'Phiên bản bảng kiểm',
  passingScore: 7,
  sections: [
    {
      id: 1, sectionKey: 's1', title: 'Phần chuẩn bị', description: 'Mô tả phần 1', displayOrder: 1,
      items: [
        {
          id: 11, itemKey: 'i1', displayOrder: 1,
          question: {
            questionKey: 'q1', title: 'Rửa tay đúng quy trình?', critical: true, helpText: 'Xem hướng dẫn',
            options: [{ optionKey: 'yes', label: 'Có', compliant: true }, { optionKey: 'no', label: 'Không', compliant: false }],
          },
        },
        {
          id: 12, itemKey: 'i2', displayOrder: 2,
          question: { questionKey: 'q2', title: 'Ghi chú thêm', excludeFromScore: false },
        },
      ],
    },
    {
      id: 2, sectionKey: 's2', title: 'Phần kết luận', displayOrder: 2,
      items: [{ id: 21, itemKey: 'i3', displayOrder: 1, title: 'Lưu ý', description: 'Nội dung mô tả' }],
    },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = { id: '31' }
  route.search = ''
  shell.current = null
  api.getFormSubmission.mockResolvedValue({ data: { data: submission() } })
  api.getFormVersionById.mockResolvedValue({ data: { data: version() } })
  api.getFormHistoryVersionById.mockResolvedValue({ data: { data: version() } })
})

const renderPage = async (props) => {
  render(<AdminQualityHistoryDetailPage {...props} />)
  await screen.findByRole('heading', { name: 'Tuân thủ vệ sinh tay' })
}

describe('AdminQualityHistoryDetailPage - tải chi tiết', () => {
  it('tải phiếu và phiên bản rồi hiển thị tóm tắt', async () => {
    render(<AdminQualityHistoryDetailPage />)
    expect(screen.getByText('Đang tải chi tiết kết quả...')).toBeInTheDocument()

    await screen.findByRole('heading', { name: 'Tuân thủ vệ sinh tay' })
    expect(api.getFormSubmission).toHaveBeenCalledWith('31')
    expect(api.getFormVersionById).toHaveBeenCalledWith(5, 9)
    expect(api.getFormHistoryVersionById).not.toHaveBeenCalled()
    expect(screen.getByText('TUAN_THU_VE_SINH_TAY · Phiên bản v3')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('NV001 · Khoa Nội')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
    expect(screen.getByText('8,50/10')).toBeInTheDocument()
    expect(screen.getByText('Điểm sàn: 7,00/10')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getByText('Không có lỗi trọng yếu')).toBeInTheDocument()
    expect(screen.getByText('2 phần · 2 câu hỏi')).toBeInTheDocument()
  })

  it('dùng API phiên bản lịch sử ở chế độ quản lý khoa', async () => {
    await renderPage({ role: 'manager' })

    expect(api.getFormHistoryVersionById).toHaveBeenCalledWith(5, 9)
    expect(api.getFormVersionById).not.toHaveBeenCalled()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('/manager/reports/checklist-dashboard')
  })

  it('điền giá trị mặc định khi phiếu thiếu thông tin', async () => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: submission({
        title: null, subject: null, submittedBy: null, submittedAt: null, updatedAt: null,
        convertedScore: undefined, passingScore: undefined,
      }) },
    })
    api.getFormVersionById.mockResolvedValue({ data: { data: version({ title: null, passingScore: undefined }) } })
    render(<AdminQualityHistoryDetailPage />)

    await screen.findByRole('heading', { name: 'Quy trình chưa có tiêu đề' })
    expect(screen.getByText('Chưa có tên')).toBeInTheDocument()
    expect(screen.getByText('Chưa có mã · Chưa xác định khoa/phòng')).toBeInTheDocument()
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument()
    expect(screen.getByText('Chưa có mã nhân viên')).toBeInTheDocument()
    expect(screen.getByText('Chưa có')).toBeInTheDocument()
    expect(screen.getByText('--/10')).toBeInTheDocument()
    expect(screen.getByText('Điểm sàn: --/10')).toBeInTheDocument()
  })

  it('dùng thời điểm cập nhật khi phiếu chưa có thời gian nộp', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: submission({ submittedAt: null, updatedAt: '2026-07-15T02:30:00' }) } })
    await renderPage()
    expect(screen.getByText('02:30 15/07/2026')).toBeInTheDocument()
  })

  it.each([
    ['FAILED_SCORE', 'Chưa đạt điểm'],
    ['FAILED_CRITICAL', 'Không đạt câu trọng yếu'],
    [null, 'Chưa tính điểm'],
  ])('hiển thị nhãn kết quả %s', async (result, label) => {
    api.getFormSubmission.mockResolvedValue({ data: { data: submission({ result }) } })
    await renderPage()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('cảnh báo khi phiếu có lỗi câu trọng yếu', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: submission({ criticalFailure: true }) } })
    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Kết quả có lỗi câu trọng yếu')
    expect(screen.getByText('Có lỗi trọng yếu')).toBeInTheDocument()
  })

  it('hiện lỗi khi không tìm thấy phiếu và cho phép thử lại', async () => {
    api.getFormSubmission.mockResolvedValueOnce({ data: { data: null } })
    render(<AdminQualityHistoryDetailPage />)

    expect(await screen.findByText('Không tìm thấy kết quả đánh giá.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
    await screen.findByRole('heading', { name: 'Tuân thủ vệ sinh tay' })
  })

  it('hiện thông báo lỗi từ máy chủ', async () => {
    api.getFormSubmission.mockRejectedValue({ response: { data: { message: 'Bạn không có quyền xem phiếu này' } } })
    render(<AdminQualityHistoryDetailPage />)
    expect(await screen.findByText('Bạn không có quyền xem phiếu này')).toBeInTheDocument()
  })

  it('hiện lỗi mặc định khi máy chủ không phản hồi', async () => {
    api.getFormVersionById.mockRejectedValue({ response: {} })
    render(<AdminQualityHistoryDetailPage />)
    expect(await screen.findByText('Không thể tải chi tiết kết quả đánh giá.')).toBeInTheDocument()
  })

  it('in kết quả khi bấm nút In', async () => {
    window.print = vi.fn()
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /In kết quả/ }))
    expect(window.print).toHaveBeenCalled()
  })
})

describe('AdminQualityHistoryDetailPage - bảng kiểm chỉ đọc', () => {
  it('mở sẵn tất cả các phần và hiển thị câu hỏi', async () => {
    await renderPage()

    expect(screen.getByText('Rửa tay đúng quy trình?')).toBeInTheDocument()
    expect(screen.getByText('Trọng yếu')).toBeInTheDocument()
    expect(screen.getByText('Xem hướng dẫn')).toBeInTheDocument()
    expect(screen.getByText('Có')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú tự do')).toBeInTheDocument()
    expect(screen.getByText('2,00 / 2,00')).toBeInTheDocument()
    expect(screen.getByText('Đạt điểm tối đa')).toBeInTheDocument()
    expect(screen.getByText('Cần xem lại')).toBeInTheDocument()
    expect(screen.getByText('Lưu ý')).toBeInTheDocument()
    expect(screen.getByText('Nội dung mô tả')).toBeInTheDocument()
  })

  it('đánh dấu câu hỏi chưa đạt', async () => {
    await renderPage()
    expect(document.querySelectorAll('.aqh-readonly-question--failed')).toHaveLength(1)
  })

  it('đánh dấu chưa đạt khi phương án được chọn không tuân thủ', async () => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: submission({
        answers: [{ questionKey: 'q1', optionKey: 'no' }],
        scoreBreakdown: [{ questionKey: 'q1', weightedScore: 2, maxScore: 2 }],
      }) },
    })
    await renderPage()

    expect(screen.getByText('Không')).toBeInTheDocument()
    expect(document.querySelector('.aqh-readonly-question--failed')).not.toBeNull()
  })

  it('bỏ qua điểm với câu hỏi không tính điểm', async () => {
    api.getFormVersionById.mockResolvedValue({
      data: { data: version({ sections: [{
        id: 1, sectionKey: 's1', title: 'Phần 1', displayOrder: 1,
        items: [{ id: 11, displayOrder: 1, question: { questionKey: 'q1', title: 'Câu không tính điểm', excludeFromScore: true } }],
      }] }) },
    })
    await renderPage()

    expect(screen.getByText('Không tính điểm')).toBeInTheDocument()
    expect(document.querySelector('.aqh-readonly-question__score')).toBeNull()
  })

  it.each([
    [{ value: { labels: ['A', 'B'] } }, 'A, B'],
    [{ value: { values: ['X', 'Y'] } }, 'X, Y'],
    [{ value: { numberValue: 12 } }, '12'],
    [{ value: { dateValue: '2026-08-01' } }, '2026-08-01'],
    [{ value: { timeValue: '08:30' } }, '08:30'],
    [{ value: { label: 'Nhãn' } }, 'Nhãn'],
    [{ value: { value: 'Giá trị' } }, 'Giá trị'],
    [{ value: {} }, 'Chưa trả lời'],
    [{}, 'Chưa trả lời'],
  ])('hiển thị câu trả lời tự do %#', async (answerOverrides, expected) => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: submission({ answers: [{ questionKey: 'q2', ...answerOverrides }], scoreBreakdown: [] }) },
    })
    await renderPage()

    const question = screen.getByText('Ghi chú thêm').closest('.aqh-readonly-question')
    expect(within(question).getByText(expected)).toBeInTheDocument()
  })

  it('hiện Chưa trả lời khi câu hỏi không có câu trả lời', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: submission({ answers: [], scoreBreakdown: [] }) } })
    await renderPage()
    expect(screen.getAllByText('Chưa trả lời')).toHaveLength(2)
  })

  it('hiện Đã chọn khi phương án không có nhãn', async () => {
    api.getFormVersionById.mockResolvedValue({
      data: { data: version({ sections: [{
        id: 1, sectionKey: 's1', title: 'Phần 1', displayOrder: 1,
        items: [{ id: 11, displayOrder: 1, question: { questionKey: 'q1', title: 'Câu hỏi', options: [{ optionKey: 'yes' }] } }],
      }] }) },
    })
    await renderPage()
    expect(screen.getByText('Đã chọn')).toBeInTheDocument()
  })

  it('thu gọn và mở lại một phần', async () => {
    await renderPage()
    const toggle = screen.getByRole('button', { name: /Phần chuẩn bị/ })

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Rửa tay đúng quy trình?')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByText('Rửa tay đúng quy trình?')).toBeInTheDocument()
  })

  it('thu gọn rồi mở lại tất cả các phần', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Thu gọn tất cả/ }))
    expect(screen.queryByText('Rửa tay đúng quy trình?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Mở tất cả/ }))
    expect(screen.getByText('Rửa tay đúng quy trình?')).toBeInTheDocument()
  })

  it('đặt tên mặc định cho phần và câu hỏi thiếu tiêu đề', async () => {
    api.getFormVersionById.mockResolvedValue({
      data: { data: version({ sections: [{
        id: 1, sectionKey: null, displayOrder: 1,
        items: [{ id: 11, displayOrder: 1, question: { questionKey: 'q1' } }],
      }] }) },
    })
    await renderPage()

    expect(screen.getByText('Phần 1')).toBeInTheDocument()
    expect(screen.getByText('Câu hỏi 1')).toBeInTheDocument()
  })

  it('chịu được phiên bản không có phần nào', async () => {
    api.getFormVersionById.mockResolvedValue({ data: { data: version({ sections: null }) } })
    await renderPage()

    expect(screen.getByText('0 phần · 0 câu hỏi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mở tất cả/ })).toBeInTheDocument()
  })

  it('chịu được phần không có mục nào', async () => {
    api.getFormVersionById.mockResolvedValue({
      data: { data: version({ sections: [{ id: 1, sectionKey: 's1', title: 'Phần rỗng', displayOrder: 1, items: null }] }) },
    })
    await renderPage()
    expect(screen.getByText('1 phần · 0 câu hỏi')).toBeInTheDocument()
  })
})

describe('AdminQualityHistoryDetailPage - điều hướng quay lại', () => {
  it('quay về trang phiên bản của bảng kiểm', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(navigate).toHaveBeenCalledWith(
      '/admin/reports/checklist-dashboard/results/forms/5/versions/9', { replace: true },
    )
  })

  it('giữ nguyên đường dẫn quay lại kèm tham số lọc', async () => {
    route.search = '?returnTo=%2Fadmin%2Freports%2Fchecklist-dashboard%2Fresults%2Fforms%2F5%2Fversions%2F9%3Fpage%3D2'
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(navigate).toHaveBeenCalledWith(
      '/admin/reports/checklist-dashboard/results/forms/5/versions/9?page=2', { replace: true },
    )
  })

  it('bỏ qua đường dẫn quay lại không hợp lệ', async () => {
    route.search = '?returnTo=%2Fhack'
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(navigate).toHaveBeenCalledWith(
      '/admin/reports/checklist-dashboard/results/forms/5/versions/9', { replace: true },
    )
  })

  it('quay về trang danh sách khi chưa tải được phiếu', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: null } })
    render(<AdminQualityHistoryDetailPage />)
    await screen.findByText('Không tìm thấy kết quả đánh giá.')

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(navigate).toHaveBeenCalledWith('/admin/reports/checklist-dashboard/results', { replace: true })
  })
})
