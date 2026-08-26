import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminQualityHistoryVersionPage from './AdminQualityHistoryVersionPage.jsx'

const navigate = vi.fn()
const setSearchParams = vi.fn()
let query = ''
const api = vi.hoisted(() => ({
  getFormById: vi.fn(), getFormVersionById: vi.fn(), getFormHistoryById: vi.fn(), getFormHistoryVersionById: vi.fn(),
  getFormHistoryVersions: vi.fn(), getFormVersionSubmissions: vi.fn(), getFormVersionSubmissionSummary: vi.fn(),
  getUsers: vi.fn(), getUserById: vi.fn(), getDepartments: vi.fn(), getFormAssignmentsByForm: vi.fn(),
  createFormAssignment: vi.fn(), revokeFormAssignmentItem: vi.fn(), exportFormVersionResponses: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/admin/reports/checklist-dashboard/results/forms/9/versions/22', search: query ? `?${query}` : '' }),
  useParams: () => ({ formId: '9', versionId: '22' }),
  useSearchParams: () => [new URLSearchParams(query), setSearchParams],
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children, back, breadcrumbs }) => <main data-back={back?.to} data-breadcrumbs={breadcrumbs?.map((x) => x.label).join('|')}>{children}</main> }))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ children, errorMessage, isOpen, onApply, onReset, onSearchChange, onToggle, searchValue }) => <section>
    <input aria-label="Tìm nhân viên được đánh giá" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
    <button onClick={onToggle}>Bộ lọc</button>{errorMessage && <span role="alert">{errorMessage}</span>}
    {isOpen && <div data-testid="filters">{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
  </section>,
}))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({ default: ({ value, onChange }) => <input aria-label="date-filter" value={value} onChange={(event) => onChange(event.target.value)} /> }))
vi.mock('../../../shared/components/DateTimePicker24h.jsx', () => ({ default: ({ id, value, onChange }) => <input id={id} aria-label="valid-until" value={value} onChange={(event) => onChange(event.target.value)} /> }))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, value, onChange, onSearch, options = [], multiple, disabled }) => <div>
    {onSearch && <input aria-label={`${ariaLabel}-search`} onChange={(event) => onSearch(event.target.value)} />}
    <select aria-label={ariaLabel} disabled={disabled} multiple={multiple} value={value} onChange={(event) => onChange?.(multiple ? Array.from(event.target.selectedOptions, (option) => option.value) : event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>,
}))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({ default: ({ isOpen, title, message, onCancel, onConfirm }) => isOpen ? <div role="dialog" aria-label={title}><p>{message}</p><button onClick={onConfirm}>Xác nhận thu hồi</button><button onClick={onCancel}>Hủy</button></div> : null }))

const form = { id: 9, code: 'SURGICAL_HAND_SCRUB', title: 'Thụt tháo', description: 'Mô tả quy trình' }
const version = { id: 22, versionId: 22, versionNumber: 2, title: 'Thụt tháo v2', description: 'Mô tả phiên bản', status: 'PUBLISHED' }
const submissions = [
  { id: 101, subject: { fullName: 'Nguyễn An', department: 'Khoa Ngoại' }, submittedBy: { fullName: 'Quản lý Một' }, submittedAt: '2026-08-20T10:30:00Z', convertedScore: 8.25, result: 'PASSED' },
  { id: 102, subject: {}, submittedBy: {}, updatedAt: '2026-08-19T10:30:00Z', convertedScore: 'bad', result: 'FAILED_SCORE' },
  { id: 103, subject: { fullName: 'Lê Bình' }, submittedBy: { fullName: 'Admin' }, updatedAt: '2026-08-18T10:30:00Z', convertedScore: 4, result: 'FAILED_CRITICAL' },
  { id: 104, subject: { fullName: 'Phạm C' }, submittedBy: { fullName: 'Admin' }, updatedAt: null, convertedScore: 0, result: 'UNKNOWN' },
]
const pageResponse = (content = submissions, overrides = {}) => ({ data: { data: { content, page: 0, size: 10, totalElements: content.length, totalPages: 1, ...overrides } } })
const listResponse = (content, totalPages = 1) => ({ data: { data: { content, totalPages } } })
const managers = [
  { id: 7, fullName: 'Quản lý Bảy', employeeCode: 'QL007' },
  { id: 8, name: 'Quản lý Tám', employeeCode: 'QL008' },
]
const assignment = { assignmentItemId: 501, formVersionId: 22, effectiveStatus: 'ACTIVE', itemStatus: 'ACTIVE', manager: managers[0], validUntil: '2026-12-31T10:00:00Z' }

beforeEach(() => {
  vi.resetAllMocks()
  query = ''
  api.getFormById.mockResolvedValue({ data: { data: form } })
  api.getFormVersionById.mockResolvedValue({ data: { data: version } })
  api.getFormHistoryById.mockResolvedValue({ data: { data: form } })
  api.getFormHistoryVersionById.mockResolvedValue({ data: { data: version } })
  api.getFormHistoryVersions.mockResolvedValue({ data: { data: [{ ...version, versionNumber: 2 }, { id: 21, versionId: 21, versionNumber: 1, status: 'RETIRED' }, null] } })
  api.getFormVersionSubmissions.mockResolvedValue(pageResponse())
  api.getFormVersionSubmissionSummary.mockResolvedValue({ data: { data: { total: 4, passed: 1, failed: 3, averageConvertedScore: 6.125 } } })
  api.getUsers.mockResolvedValue(listResponse(managers))
  api.getUserById.mockResolvedValue({ data: { data: managers[0] } })
  api.getDepartments.mockResolvedValue({ data: { data: [{ id: 3, name: 'Khoa Ngoại', code: 'NGOAI' }] } })
  api.getFormAssignmentsByForm.mockResolvedValue(listResponse([assignment]))
  api.createFormAssignment.mockResolvedValue({ data: { success: true } })
  api.revokeFormAssignmentItem.mockResolvedValue({ data: { success: true } })
  api.exportFormVersionResponses.mockResolvedValue({ data: new Blob(['excel']) })
  Object.defineProperty(globalThis.URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:history') })
  Object.defineProperty(globalThis.URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  HTMLAnchorElement.prototype.click = vi.fn()
})

const renderAdmin = async () => {
  render(<AdminQualityHistoryVersionPage />)
  await screen.findByText('Thụt tháo v2')
  await screen.findByText('Nguyễn An')
}

describe('AdminQualityHistoryVersionPage', () => {
  it('renders metadata, summary, varied submission rows and detail navigation', async () => {
    await renderAdmin()
    expect(screen.getByText('Mô tả phiên bản')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('6,13')).toBeInTheDocument()
    expect(screen.getByText('8,25/10')).toBeInTheDocument()
    expect(screen.getByText('Chưa đạt điểm')).toBeInTheDocument()
    expect(screen.getByText('Không đạt câu trọng yếu')).toBeInTheDocument()
    expect(screen.getByText('Chưa tính điểm')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Xem chi tiết kết quả của Nguyễn An'))
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/results/101?returnTo='))
  })

  it('opens filters, loads references, validates dates and applies/reset filters', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    await waitFor(() => expect(api.getDepartments).toHaveBeenCalled())
    await waitFor(() => expect(api.getFormAssignmentsByForm).toHaveBeenCalled())
    await screen.findByRole('option', { name: 'Quản lý Bảy' })
    fireEvent.change(screen.getByLabelText('Tìm nhân viên được đánh giá'), { target: { value: ' Nguyễn ' } })
    await waitFor(() => expect(screen.getByLabelText('Phiên bản').querySelector('option[value="21"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Phiên bản'), { target: { value: '21' } })
    await waitFor(() => expect(screen.getByLabelText('Lọc theo người thực hiện chấm').querySelector('option[value="7"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lọc theo người thực hiện chấm'), { target: { value: '7' } })
    await waitFor(() => expect(screen.getByLabelText('Lọc theo khoa phòng').querySelector('option[value="3"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Lọc theo khoa phòng'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Lọc theo kết quả'), { target: { value: 'PASSED' } })
    const dates = screen.getAllByLabelText('date-filter')
    fireEvent.change(dates[0], { target: { value: '2026-09-01' } })
    fireEvent.change(dates[1], { target: { value: '2026-08-01' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(dates[0], { target: { value: '2026-01-01' } })
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Áp dụng' }))
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/versions/21?'), { replace: true })
    expect(navigate.mock.calls.at(-1)[0]).toContain('submittedByUserId=7')
    expect(navigate.mock.calls.at(-1)[0]).toContain('departmentId=3')
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.click(within(screen.getByTestId('filters')).getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(setSearchParams).toHaveBeenCalled()
  })

  it('exports Excel and reports export failures', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }))
    await waitFor(() => expect(api.exportFormVersionResponses).toHaveBeenCalledWith('9', '22', expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) })))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:history')

    api.exportFormVersionResponses.mockRejectedValueOnce({ response: { data: { message: 'Không xuất được' } } })
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không xuất được')
  })

  it('paginates, changes page size and renders long pagination with ellipses', async () => {
    query = 'page=4&size=20'
    api.getFormVersionSubmissions.mockResolvedValue(pageResponse([submissions[0]], { page: 4, size: 20, totalElements: 220, totalPages: 11 }))
    render(<AdminQualityHistoryVersionPage />)
    await screen.findByText('Nguyễn An')
    expect(screen.getAllByText('…').length).toBeGreaterThan(0)
    fireEvent.change(document.querySelector('.aqh-pagination select'), { target: { value: '50' } })
    expect(setSearchParams).toHaveBeenCalled()
  })

  it('shows and retries metadata loading errors', async () => {
    api.getFormById.mockRejectedValueOnce({ response: { data: { message: 'Metadata lỗi' } } })
    render(<AdminQualityHistoryVersionPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Metadata lỗi')
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('Thụt tháo v2')).toBeInTheDocument()

  })

  it('shows, retries and clears result loading errors', async () => {
    api.getFormVersionSubmissions.mockRejectedValueOnce({ response: { data: { message: 'Kết quả lỗi' } } })
    render(<AdminQualityHistoryVersionPage />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Kết quả lỗi')
    api.getFormVersionSubmissions.mockResolvedValueOnce(pageResponse([]))
    fireEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chưa có kết quả phù hợp')).toBeInTheDocument()
  })

  it('manages version assignments: select, remove, add and revoke', async () => {
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Người được giao/ }))
    const modal = await screen.findByRole('dialog', { name: 'Người được giao' })
    await waitFor(() => expect(api.getUsers).toHaveBeenCalled())
    expect(within(modal).getByText('Quản lý Bảy')).toBeInTheDocument()
    const managerSelect = within(modal).getByLabelText('Tìm và chọn người nhận mới')
    managerSelect.querySelector('option[value="8"]').selected = true
    fireEvent.change(managerSelect)
    expect(within(modal).getByLabelText('Bỏ chọn Quản lý Tám')).toBeInTheDocument()
    fireEvent.click(within(modal).getByLabelText('Bỏ chọn Quản lý Tám'))
    expect(within(modal).getByText('Chưa chọn người nhận nào.')).toBeInTheDocument()
    managerSelect.querySelector('option[value="8"]').selected = true
    fireEvent.change(managerSelect)
    fireEvent.change(within(modal).getByLabelText('valid-until'), { target: { value: '2026-12-31T12:00' } })
    fireEvent.submit(within(modal).getByRole('button', { name: /Thêm người nhận/ }).closest('form'))
    await waitFor(() => expect(api.createFormAssignment).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: [8], formVersionIds: [22] })))
    fireEvent.click(within(modal).getByRole('button', { name: /Thu hồi/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi' }))
    await waitFor(() => expect(api.revokeFormAssignmentItem).toHaveBeenCalledWith(501))
  })

  it('reports assignment load/create failures and closes its modal', async () => {
    api.getUsers.mockRejectedValueOnce({ response: { status: 403 } })
    await renderAdmin()
    fireEvent.click(screen.getByRole('button', { name: /Người được giao/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('không có quyền')
    fireEvent.click(screen.getByLabelText('Đóng cửa sổ quản lý phân quyền'))
    expect(screen.queryByRole('dialog', { name: 'Người được giao' })).not.toBeInTheDocument()
  })

  it('uses manager-only history APIs and hides evaluator/export/assignment controls', async () => {
    render(<AdminQualityHistoryVersionPage role="manager" />)
    await screen.findByText('Thụt tháo v2')
    await screen.findByText('Nguyễn An')
    expect(api.getFormHistoryById).toHaveBeenCalledWith('9')
    expect(api.getFormHistoryVersionById).toHaveBeenCalledWith('9', '22')
    expect(screen.queryByRole('button', { name: 'Xuất Excel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Người được giao/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    expect(screen.queryByLabelText('Lọc theo người thực hiện chấm')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Lọc theo khoa phòng')).toBeDisabled()
  })
})
