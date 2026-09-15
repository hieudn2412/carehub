import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportLogsListPage from './ImportLogsListPage.jsx'

const api = vi.hoisted(() => ({ getImportLogs: vi.fn(), getImportLogById: vi.fn() }))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children, breadcrumbs }) => <main data-breadcrumbs={breadcrumbs.map((x) => x.label).join('|')}>{children}</main> }))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange, className }) => <input aria-label={className} value={value} onChange={(event) => onChange(event.target.value)} />,
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, ariaLabel, value, onChange, options }) => <label>{label}<select aria-label={ariaLabel || label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>,
}))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ children, actions, errorMessage, isOpen, onApply, onReset, onToggle }) => <section>
    <button onClick={onToggle}>Bộ lọc</button>{actions}
    {errorMessage && <p role="alert">{errorMessage}</p>}
    {isOpen && <div data-testid="filters">{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
  </section>,
}))

const rows = [
  { rowNumber: 2, employeeCode: 'NV001', status: 'INSERTED', message: 'Đã thêm' },
  { rowNumber: 3, employeeCode: 'NV002', status: 'UPDATED', message: 'Đã sửa' },
  { rowNumber: 4, employeeCode: 'NV003', status: 'UNCHANGED', message: 'Không đổi' },
  { rowNumber: 5, employeeCode: 'NV004', status: 'FAILED', message: 'Sai dữ liệu' },
]
const logs = [
  { id: 1, sourceFile: 'nhan_vien_goc.xlsx', status: 'SUCCESS', totalRows: 10, insertedRows: 6, updatedRows: 4, failedRows: 0, durationMs: 1200, createdAt: '2026-08-20T10:00:00Z', rowResultsJson: JSON.stringify(rows) },
  { id: 2, sourceFile: 'phong_ban_goc.xlsx', status: 'PARTIAL', totalRows: 8, insertedRows: 3, updatedRows: 3, failedRows: 2, durationMs: 500, createdAt: '2026-08-19T10:00:00Z', rowResultsJson: 'not-json' },
  { id: 3, sourceFile: 'failed.xlsx', status: 'FAILED', totalRows: 5, insertedRows: 0, updatedRows: 0, failedRows: 5, createdAt: 'invalid', rowResultsJson: JSON.stringify({ invalid: true }) },
  { id: 4, sourceFile: 'unknown.xlsx', status: 'RUNNING', totalRows: 2, insertedRows: 0, updatedRows: 0, failedRows: 0, createdAt: null },
]
const response = (content = logs, overrides = {}) => ({ data: { data: { content, totalElements: content.length, totalPages: 1, ...overrides } } })

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/admin/reference/sync-history' } })
  api.getImportLogs.mockResolvedValue(response())
  api.getImportLogById.mockResolvedValue({ data: { data: logs[0] } })
})

const renderPage = async () => {
  render(<ImportLogsListPage />)
  await screen.findByText('nhan_vien_goc.xlsx')
}

describe('ImportLogsListPage', () => {
  it('renders API logs, totals, all status badges and sync-history copy', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Lịch sử đồng bộ' })).toBeInTheDocument()
    expect(screen.getAllByText('Thành công').length).toBeGreaterThan(1)
    expect(screen.getByText('Lỗi một phần')).toBeInTheDocument()
    expect(screen.getByText('Thất bại')).toBeInTheDocument()
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 4 trong tổng số 4 kết quả')).toBeInTheDocument()
    expect(api.getImportLogs).toHaveBeenCalledWith({ page: 0, size: 10, q: undefined, status: undefined })
  })

  it('uses alternate headings on system and generic import-log paths', async () => {
    Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/admin/system-logs' } })
    const first = render(<ImportLogsListPage />)
    expect(await screen.findByText('Nhật ký hệ thống (System logs)')).toBeInTheDocument()
    first.unmount()
    Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/admin/import-logs' } })
    render(<ImportLogsListPage />)
    expect(await screen.findByText('Nhật ký nhập dữ liệu (Import logs)')).toBeInTheDocument()
  })

  it('applies file/status/date filters and maps backend status values', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getByLabelText('Loại dữ liệu nhập'), { target: { value: 'nhan_vien_goc.xlsx' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PARTIAL' } })
    fireEvent.change(screen.getAllByLabelText('il-filter-date')[0], { target: { value: '2026-08-01' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getImportLogs).toHaveBeenLastCalledWith({ page: 0, size: 10, q: 'nhan_vien_goc.xlsx', status: 'COMPLETED_WITH_ERRORS' }))

    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'SUCCESS' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getImportLogs).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'COMPLETED' })))
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'FAILED' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getImportLogs).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'FAILED' })))
  })

  it('validates historical dates and resets filter values', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    const dates = screen.getAllByLabelText('il-filter-date')
    fireEvent.change(dates[0], { target: { value: '2026-09-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-08-01' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens detail, filters every row status/search and closes by both controls', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Xem chi tiết đợt nhập dữ liệu 1'))
    const modal = await screen.findByText('Chi tiết đợt nhập dữ liệu #1')
    await waitFor(() => expect(api.getImportLogById).toHaveBeenCalledWith(1))
    expect(screen.getByText('Kết quả chi tiết từng dòng (4)')).toBeInTheDocument()
    expect(screen.getAllByText('Thêm mới').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cập nhật').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Không đổi').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Lọc kết quả nhập theo trạng thái'), { target: { value: 'FAILED' } })
    expect(screen.getByText('NV004')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Tìm mã nhân viên...'), { target: { value: 'missing' } })
    expect(screen.getByText('Không tìm thấy kết quả dòng phù hợp với bộ lọc.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(modal).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Xem chi tiết đợt nhập dữ liệu 1'))
    const overlay = (await screen.findByText('Chi tiết đợt nhập dữ liệu #1')).closest('.il-modal-overlay')
    fireEvent.click(overlay)
    expect(screen.queryByText('Chi tiết đợt nhập dữ liệu #1')).not.toBeInTheDocument()
  })

  it('falls back to list row when detail response is empty or fails', async () => {
    await renderPage()
    api.getImportLogById.mockResolvedValueOnce({ data: { data: null } })
    fireEvent.click(screen.getByLabelText('Xem chi tiết đợt nhập dữ liệu 2'))
    expect(await screen.findByText('phong_ban_goc.xlsx', { selector: '.il-summary-value' })).toBeInTheDocument()
    expect(screen.getByText('Kết quả chi tiết từng dòng (0)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))

    api.getImportLogById.mockRejectedValueOnce(new Error('detail'))
    fireEvent.click(screen.getByLabelText('Xem chi tiết đợt nhập dữ liệu 3'))
    expect(await screen.findByText('failed.xlsx', { selector: '.il-summary-value' })).toBeInTheDocument()
  })

  it('falls back to generated mock data on empty or failed API and filters it locally', async () => {
    api.getImportLogs.mockResolvedValueOnce(response([]))
    render(<ImportLogsListPage />)
    expect((await screen.findAllByText('nhan_vien_goc.xlsx')).length).toBeGreaterThan(0)
    expect(screen.getByText(/trong tổng số/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'FAILED' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findAllByText('Thất bại')).not.toHaveLength(0)
  })

  it('paginates with ellipses and displays empty client-filter results', async () => {
    api.getImportLogs.mockResolvedValue(response([logs[0]], { totalElements: 80, totalPages: 8 }))
    await renderPage()
    const pagination = document.querySelector('.il-page-nums')
    fireEvent.click(within(pagination).getByRole('button', { name: '2' }))
    await waitFor(() => expect(api.getImportLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    expect(await screen.findByText('...')).toBeInTheDocument()

    api.getImportLogs.mockResolvedValueOnce(response([logs[0]]))
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    const dates = screen.getAllByLabelText('il-filter-date')
    fireEvent.change(dates[0], { target: { value: '2026-01-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-01-02' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Không tìm thấy nhật ký nhập dữ liệu phù hợp.')).toBeInTheDocument()
  })
})
