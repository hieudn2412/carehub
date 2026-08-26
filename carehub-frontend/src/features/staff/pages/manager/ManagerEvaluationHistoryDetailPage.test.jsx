import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerEvaluationHistoryDetailPage from './ManagerEvaluationHistoryDetailPage.jsx'

const route = { params: { id: '77' }, search: '' }
const shell = vi.hoisted(() => ({ current: null }))
const api = vi.hoisted(() => ({ getFormSubmission: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useParams: () => route.params,
  useSearchParams: () => [new URLSearchParams(route.search)],
}))
vi.mock('../../api/staffApi.js', () => ({ staffApi: api }))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, back, breadcrumbs, title }) => {
    shell.current = { back, breadcrumbs, title }
    return (
      <main>
        <a href={back.to}>{back.label}</a>
        <span data-testid="title">{title || ''}</span>
        <nav data-testid="breadcrumbs">{(breadcrumbs || []).map((crumb) => `${crumb.label}|${crumb.link || ''}`).join(' / ')}</nav>
        {children}
      </main>
    )
  },
}))

const evaluation = (overrides = {}) => ({
  id: 77,
  formId: 5,
  formVersionId: 9,
  formCode: 'HAND_HYGIENE_COMPLIANCE',
  formTitle: 'Tuân thủ vệ sinh tay',
  versionNumber: 3,
  convertedScore: 8.5,
  passingScore: 7,
  result: 'PASSED',
  criticalFailure: false,
  submittedAt: '2026-08-01T03:05:00',
  subject: { fullName: 'Nguyễn Văn A', employeeCode: 'NV001', department: 'Khoa Nội' },
  submittedBy: { fullName: 'Trần Thị B', employeeCode: 'NV002' },
  answers: [
    { questionKey: 'q1', value: { label: 'Có' } },
    { questionKey: 'q2', value: { textValue: 'Ghi chú' } },
  ],
  scoreBreakdown: [
    { questionKey: 'q1', title: 'Rửa tay đúng quy trình?', critical: true, weightedScore: 2, maxScore: 2 },
    { questionKey: 'q2', title: 'Ghi chú thêm', critical: false, weightedScore: 0, maxScore: 3 },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  route.params = { id: '77' }
  route.search = ''
  shell.current = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.getFormSubmission.mockResolvedValue({ data: { data: evaluation() } })
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async (props) => {
  render(<ManagerEvaluationHistoryDetailPage {...props} />)
  await screen.findByRole('heading', { name: 'Tuân thủ vệ sinh tay' })
}
const backLink = () => screen.getByRole('link', { name: 'Quay lại' })

describe('ManagerEvaluationHistoryDetailPage - trạng thái tải', () => {
  it('hiện khối chờ khi đang tải', () => {
    api.getFormSubmission.mockReturnValue(new Promise(() => {}))
    render(<ManagerEvaluationHistoryDetailPage />)

    expect(screen.getByText('Đang tải chi tiết kết quả đánh giá...')).toBeInTheDocument()
    expect(screen.getByTestId('title')).toHaveTextContent('Lịch sử đánh giá')
    expect(backLink()).toHaveAttribute('href', '/manager/quality/history')
  })

  it('hiện lỗi khi tải chi tiết thất bại', async () => {
    api.getFormSubmission.mockRejectedValue(new Error('down'))
    render(<ManagerEvaluationHistoryDetailPage />)

    expect(await screen.findByText('Không thể tải chi tiết kết quả đánh giá.')).toBeInTheDocument()
    expect(console.error).toHaveBeenCalled()
  })

  it('hiện thông báo khi máy chủ trả về phiếu rỗng', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: null } })
    render(<ManagerEvaluationHistoryDetailPage />)

    expect(await screen.findByText('Không tìm thấy chi tiết kết quả đánh giá.')).toBeInTheDocument()
  })
})

describe('ManagerEvaluationHistoryDetailPage - tóm tắt kết quả', () => {
  it('hiển thị đầy đủ thông tin phiếu đánh giá', async () => {
    await renderPage()

    expect(api.getFormSubmission).toHaveBeenCalledWith('77')
    expect(screen.getByText('TUAN_THU_VE_SINH_TAY · Phiên bản v3')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('NV001 · Khoa Nội')).toBeInTheDocument()
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument()
    expect(screen.getByText('NV002')).toBeInTheDocument()
    expect(screen.getByText('8,50/10')).toBeInTheDocument()
    expect(screen.getByText('Điểm sàn: 7,00/10')).toBeInTheDocument()
    expect(screen.getByText('Đạt')).toBeInTheDocument()
    expect(screen.getByText('Không có lỗi trọng yếu')).toBeInTheDocument()
  })

  it('dùng điểm sàn mặc định khi phiếu không có', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: evaluation({ passingScore: null }) } })
    await renderPage()
    expect(screen.getByText('Điểm sàn: 6,67/10')).toBeInTheDocument()
  })

  it('điền giá trị mặc định khi phiếu thiếu thông tin', async () => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: evaluation({
        formTitle: null, title: null, formCode: null, versionNumber: null,
        subject: {}, submittedBy: {}, submittedAt: null, updatedAt: null, convertedScore: undefined,
      }) },
    })
    render(<ManagerEvaluationHistoryDetailPage />)

    await screen.findByRole('heading', { name: 'Quy trình chưa có tiêu đề' })
    expect(screen.getByText('Chưa có tên')).toBeInTheDocument()
    expect(screen.getByText('Chưa xác định khoa/phòng')).toBeInTheDocument()
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument()
    expect(screen.getByText('Chưa có')).toBeInTheDocument()
    expect(screen.getByText('---/10')).toBeInTheDocument()
    expect(screen.getByText('· Phiên bản v1')).toBeInTheDocument()
  })

  it('dùng tên và mã dự phòng của người chấm', async () => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: evaluation({
        submittedBy: { name: 'Người chấm phụ', username: 'grader01' },
        subject: { fullName: 'Nhân viên', departmentName: 'Khoa Ngoại' },
      }) },
    })
    await renderPage()

    expect(screen.getByText('Người chấm phụ')).toBeInTheDocument()
    expect(screen.getByText('grader01')).toBeInTheDocument()
    expect(screen.getByText('Khoa Ngoại')).toBeInTheDocument()
  })

  it('dùng tiêu đề dự phòng và thời điểm cập nhật', async () => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: evaluation({ formTitle: null, title: 'Tiêu đề dự phòng', submittedAt: null, updatedAt: '2026-07-15T02:30:00' }) },
    })
    render(<ManagerEvaluationHistoryDetailPage />)

    await screen.findByRole('heading', { name: 'Tiêu đề dự phòng' })
    expect(screen.getByText('02:30 15/07/2026')).toBeInTheDocument()
  })

  it.each([
    ['FAILED_SCORE', 'Chưa đạt điểm'],
    ['FAILED_CRITICAL', 'Không đạt câu trọng yếu'],
    [null, 'Chưa tính điểm'],
  ])('hiển thị nhãn kết quả %s', async (result, label) => {
    api.getFormSubmission.mockResolvedValue({ data: { data: evaluation({ result }) } })
    await renderPage()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('cảnh báo khi phiếu có lỗi trọng yếu', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: evaluation({ criticalFailure: true }) } })
    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Kết quả có lỗi câu trọng yếu')
    expect(screen.getByText('Có lỗi trọng yếu')).toBeInTheDocument()
  })

  it('làm tròn điểm âm rất nhỏ về 0', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: evaluation({ convertedScore: -0.000001 }) } })
    await renderPage()
    expect(screen.getByText('0,00/10')).toBeInTheDocument()
  })

  it('in kết quả khi bấm nút In', async () => {
    window.print = vi.fn()
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /In kết quả/ }))
    expect(window.print).toHaveBeenCalled()
  })
})

describe('ManagerEvaluationHistoryDetailPage - chi tiết câu trả lời', () => {
  it('hiển thị từng câu hỏi kèm điểm và trạng thái', async () => {
    await renderPage()

    expect(screen.getByText('Chi tiết câu trả lời kiểm tra')).toBeInTheDocument()
    expect(screen.getByText('Trọng tâm')).toBeInTheDocument()
    expect(screen.getByText('ĐẠT')).toBeInTheDocument()
    expect(screen.getByText('KHÔNG ĐẠT')).toBeInTheDocument()
    expect(screen.getByText('2,00 / 2,00 điểm')).toBeInTheDocument()
    expect(screen.getByText('0,00 / 3,00 điểm')).toBeInTheDocument()
    expect(screen.getByText('Có')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú')).toBeInTheDocument()
  })

  it.each([
    [{ labels: ['A', 'B'] }, 'A, B'],
    [{ textValue: 'Văn bản' }, 'Văn bản'],
    [{ numberValue: 0 }, '0'],
    [{ dateValue: '2026-08-01' }, '2026-08-01'],
    [{ timeValue: '08:30' }, '08:30'],
    [{ values: ['X', 'Y'] }, 'X, Y'],
    [{ value: 'Giá trị' }, 'Giá trị'],
    [{}, 'Chưa trả lời'],
    [{ labels: [] }, 'Chưa trả lời'],
  ])('định dạng câu trả lời %#', async (value, expected) => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: evaluation({
        answers: [{ questionKey: 'q1', value }],
        scoreBreakdown: [{ questionKey: 'q1', title: 'Câu hỏi 1', weightedScore: 1, maxScore: 1 }],
      }) },
    })
    await renderPage()

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('hiện Chưa trả lời khi không tìm thấy câu trả lời tương ứng', async () => {
    api.getFormSubmission.mockResolvedValue({
      data: { data: evaluation({ answers: null, scoreBreakdown: [{ questionKey: 'q9', title: 'Câu lẻ', weightedScore: 1, maxScore: 1 }] }) },
    })
    await renderPage()
    expect(screen.getByText('Chưa trả lời')).toBeInTheDocument()
  })

  it('chịu được phiếu không có bảng điểm chi tiết', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: evaluation({ scoreBreakdown: null }) } })
    await renderPage()

    expect(screen.getByText('Chi tiết câu trả lời kiểm tra')).toBeInTheDocument()
    expect(screen.queryByText('ĐẠT')).not.toBeInTheDocument()
  })
})

describe('ManagerEvaluationHistoryDetailPage - điều hướng quay lại', () => {
  it('quay về trang phiên bản của bảng kiểm khi không có returnTo', async () => {
    await renderPage()
    expect(backLink()).toHaveAttribute('href', '/manager/quality/history/results/forms/5/versions/9')
  })

  it('quay về trang lịch sử khi phiếu thiếu thông tin biểu mẫu', async () => {
    api.getFormSubmission.mockResolvedValue({ data: { data: evaluation({ formId: null, formVersionId: null }) } })
    await renderPage()
    expect(backLink()).toHaveAttribute('href', '/manager/quality/history')
  })

  it('ưu tiên returnTo hợp lệ', async () => {
    route.search = '?returnTo=%2Fmanager%2Fquality%2Fhistory%3Fpage%3D2'
    await renderPage()
    expect(backLink()).toHaveAttribute('href', '/manager/quality/history?page=2')
  })

  it('bỏ qua returnTo không bắt đầu bằng dấu gạch chéo', async () => {
    route.search = '?returnTo=https%3A%2F%2Fevil.example'
    await renderPage()
    expect(backLink()).toHaveAttribute('href', '/manager/quality/history/results/forms/5/versions/9')
  })

  it('dùng breadcrumb lịch sử đánh giá mặc định', async () => {
    await renderPage()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Lịch sử đánh giá|/manager/quality/history')
  })

  it('dùng breadcrumb tuân thủ theo kỹ thuật cho báo cáo bảng kiểm', async () => {
    await renderPage({ historyPath: '/manager/reports/checklist-dashboard' })
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Tuân thủ theo kỹ thuật|/manager/reports/checklist-dashboard')
  })

  it('nhận diện báo cáo bảng kiểm từ tham số returnTo', async () => {
    route.search = '?returnTo=%2Fadmin%2Freports%2Fchecklist-dashboard%2Fresults'
    await renderPage()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Tuân thủ theo kỹ thuật')
  })
})
