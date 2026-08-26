import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EvaluationImportHistoryPage from './EvaluationImportHistoryPage.jsx'

const showToast = vi.fn()
const api = vi.hoisted(() => ({ listImports: vi.fn(), getImport: vi.fn(), exportErrorFile: vi.fn() }))

vi.mock('../api/evaluationImportApi.js', () => ({ evaluationImportApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/AdminFilterDisclosure.jsx', () => ({
  default: ({ activeCount, children }) => <div data-testid="filters" data-active={activeCount}>{children}</div>,
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

const job = (id, overrides = {}) => ({
  id,
  importType: 'QUESTION_BANK',
  importTypeText: 'Ngân hàng câu hỏi',
  fileName: `cau-hoi-${id}.xlsx`,
  status: 'COMMITTED',
  statusText: 'Đã import',
  totalRows: 20,
  validRows: 18,
  invalidRows: 2,
  createdRows: 18,
  skippedRows: 0,
  actor: 'admin',
  createdAt: '2026-08-01T03:05:00',
  ...overrides,
})

const detail = (overrides = {}) => ({
  ...job(1),
  rows: [
    { rowNumber: 1, stem: 'Câu hỏi hợp lệ', status: 'CREATED', createdQuestionId: 77, valid: true, skipped: false, errorsText: null },
    { rowNumber: 2, stem: 'Câu hỏi bỏ qua', status: 'SKIPPED', createdQuestionId: null, valid: true, skipped: true, errorsText: null },
    { rowNumber: 3, stem: 'Câu hỏi hợp lệ chưa lưu', status: 'VALID', createdQuestionId: null, valid: true, skipped: false, errorsText: null },
    { rowNumber: 4, stem: 'Câu hỏi lỗi', status: 'INVALID', createdQuestionId: null, valid: false, skipped: false, errorsText: 'Thiếu đáp án đúng' },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.listImports.mockResolvedValue({ data: { data: [job(1), job(2, { status: 'FAILED', statusText: 'Thất bại' })] } })
  api.getImport.mockResolvedValue({ data: { data: detail() } })
})

const renderPage = async () => {
  render(<EvaluationImportHistoryPage />)
  await screen.findByText('#1')
}
const openDetail = async () => {
  await renderPage()
  fireEvent.click(screen.getAllByTitle('Xem chi tiết')[0])
  await screen.findByText(/Import #1/)
}
const detailCard = () => document.querySelector('.exp-form-card')

describe('EvaluationImportHistoryPage - danh sách import', () => {
  it('tải và hiển thị lịch sử import', async () => {
    render(<EvaluationImportHistoryPage />)
    expect(screen.getByText('Đang tải lịch sử import...')).toBeInTheDocument()

    await screen.findByText('#1')
    expect(api.listImports).toHaveBeenCalledWith({ q: undefined, status: undefined })
    expect(screen.getAllByText('Ngân hàng câu hỏi')).toHaveLength(2)
    expect(screen.getByText('cau-hoi-1.xlsx')).toBeInTheDocument()
    expect(within(screen.getAllByRole('table')[0]).getByText('Đã import')).toBeInTheDocument()
    expect(within(screen.getAllByRole('table')[0]).getByText('Thất bại')).toBeInTheDocument()
    expect(screen.getAllByText('20 dòng')).toHaveLength(2)
  })

  it('điền giá trị mặc định cho các cột còn trống', async () => {
    api.listImports.mockResolvedValue({
      data: { data: [job(1, {
        fileName: null, importTypeText: null, statusText: null, status: null,
        totalRows: null, createdRows: null, skippedRows: null, actor: null, createdAt: null,
      })] },
    })
    await renderPage()

    expect(screen.getByText('Không có tên file')).toBeInTheDocument()
    expect(screen.getByText('QUESTION_BANK')).toBeInTheDocument()
    expect(screen.getByText('0 dòng')).toBeInTheDocument()
    expect(screen.getByText('system')).toBeInTheDocument()
    expect(screen.getAllByText('---').length).toBeGreaterThan(0)
  })

  it('hiện thông báo khi chưa có lịch sử import', async () => {
    api.listImports.mockResolvedValue({ data: { data: [] } })
    render(<EvaluationImportHistoryPage />)
    expect(await screen.findByText('Chưa có lịch sử import.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải lịch sử thất bại', async () => {
    api.listImports.mockRejectedValue({ response: { data: { message: 'Không có quyền xem import' } } })
    render(<EvaluationImportHistoryPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền xem import', 'error'))
  })

  it('tải lại danh sách bằng nút Tải lại', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tải lại/ }))
    await waitFor(() => expect(api.listImports).toHaveBeenCalledTimes(2))
  })

  it('lọc theo từ khoá và trạng thái', async () => {
    await renderPage()

    fireEvent.change(screen.getByPlaceholderText('Tìm file, người import, mã import...'), { target: { value: 'cau-hoi' } })
    await waitFor(() => expect(api.listImports).toHaveBeenCalledWith({ q: 'cau-hoi', status: undefined }))

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'FAILED' } })
    await waitFor(() => expect(api.listImports).toHaveBeenCalledWith({ q: 'cau-hoi', status: 'FAILED' }))
    expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '1')
  })

  it('không đếm bộ lọc khi chưa chọn trạng thái', async () => {
    await renderPage()
    expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '0')
  })
})

describe('EvaluationImportHistoryPage - chi tiết import', () => {
  it('mở chi tiết và hiển thị các dòng import', async () => {
    await openDetail()

    expect(api.getImport).toHaveBeenCalledWith(1)
    expect(within(detailCard()).getByText('Tổng dòng: 20')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Hợp lệ: 18')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Lỗi: 2')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Đã lưu #77')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Bỏ qua')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Hợp lệ')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Có lỗi')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Thiếu đáp án đúng')).toBeInTheDocument()
    expect(within(detailCard()).getAllByText('Không có lỗi')).toHaveLength(3)
  })

  it('dùng failedRows khi thiếu invalidRows', async () => {
    api.getImport.mockResolvedValue({ data: { data: detail({ invalidRows: null, failedRows: 5 }) } })
    await openDetail()
    expect(within(detailCard()).getByText('Lỗi: 5')).toBeInTheDocument()
  })

  it('điền số 0 khi chi tiết thiếu số liệu', async () => {
    api.getImport.mockResolvedValue({
      data: { data: detail({ totalRows: null, validRows: null, invalidRows: null, failedRows: null, createdRows: null, skippedRows: null }) },
    })
    await openDetail()

    expect(within(detailCard()).getByText('Tổng dòng: 0')).toBeInTheDocument()
    expect(within(detailCard()).getByText('Lỗi: 0')).toBeInTheDocument()
  })

  it('dùng loại import khi chi tiết không có tên file', async () => {
    api.getImport.mockResolvedValue({ data: { data: detail({ fileName: null }) } })
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Xem chi tiết')[0])

    expect(await screen.findByText(/Import #1 - Ngân hàng câu hỏi/)).toBeInTheDocument()
  })

  it('hiện thông báo khi chi tiết không có dòng nào', async () => {
    api.getImport.mockResolvedValue({ data: { data: detail({ rows: [] }) } })
    await openDetail()
    expect(screen.getByText('Không có dữ liệu dòng import.')).toBeInTheDocument()
  })

  it('chịu được chi tiết thiếu hẳn mảng dòng', async () => {
    api.getImport.mockResolvedValue({ data: { data: detail({ rows: undefined }) } })
    await openDetail()
    expect(screen.getByText('Không có dữ liệu dòng import.')).toBeInTheDocument()
  })

  it('không mở chi tiết khi phản hồi rỗng', async () => {
    api.getImport.mockResolvedValue({ data: { data: null } })
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Xem chi tiết')[0])

    await waitFor(() => expect(api.getImport).toHaveBeenCalled())
    expect(screen.queryByText(/Import #1/)).not.toBeInTheDocument()
  })

  it('báo lỗi khi mở chi tiết thất bại', async () => {
    api.getImport.mockRejectedValue({ response: { data: { message: 'Không tìm thấy phiên import' } } })
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Xem chi tiết')[0])

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tìm thấy phiên import', 'error'))
  })
})

describe('EvaluationImportHistoryPage - tải file lỗi', () => {
  const errorButton = () => screen.getByRole('button', { name: /Tải file lỗi/ })

  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:evaluation-import')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('tải file lỗi và thu hồi blob URL', async () => {
    api.exportErrorFile.mockResolvedValue({ data: new Blob(['errors']) })
    await openDetail()

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(errorButton())

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đã tải file lỗi import.', 'success'))
    expect(api.exportErrorFile).toHaveBeenCalledWith(1)
    expect(click).toHaveBeenCalled()
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:evaluation-import')
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })

  it('báo lỗi khi tải file lỗi thất bại', async () => {
    api.exportErrorFile.mockRejectedValue({ response: { data: { message: 'Không tạo được file lỗi' } } })
    await openDetail()
    fireEvent.click(errorButton())

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không tạo được file lỗi', 'error'))
  })

  it('khoá nút tải khi phiên import không có dòng lỗi', async () => {
    api.getImport.mockResolvedValue({ data: { data: detail({ invalidRows: 0, failedRows: 0, skippedRows: 0 }) } })
    await openDetail()
    expect(errorButton()).toBeDisabled()
  })

  it('mở khoá nút tải khi chỉ có dòng bỏ qua', async () => {
    api.getImport.mockResolvedValue({ data: { data: detail({ invalidRows: 0, failedRows: 0, skippedRows: 3 }) } })
    await openDetail()
    expect(errorButton()).toBeEnabled()
  })
})
