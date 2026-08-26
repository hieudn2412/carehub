import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingRecordListPage from './TrainingRecordListPage.jsx'

const setSearchParams = vi.fn()
const search = { current: new URLSearchParams() }
const api = vi.hoisted(() => ({ getRecordOptions: vi.fn(), listRecords: vi.fn() }))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
  useSearchParams: () => [search.current, setSearchParams],
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange, min, max }) => (
    <input type="date" value={value || ''} min={min} max={max} onChange={(event) => onChange(event.target.value)} />
  ),
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
vi.mock('../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset }) => (
    <>
      <button onClick={onApply}>Áp dụng</button>
      <button onClick={onReset}>Xóa bộ lọc</button>
    </>
  ),
}))

const THIS_YEAR = new Date().getFullYear()
const FROM = `${THIS_YEAR}-01-01`

const record = (id, overrides = {}) => ({
  id,
  employeeCode: `NV00${id}`,
  employeeName: `Nhân viên ${id}`,
  employeeDepartmentNameSnapshot: 'Khoa Ngoại',
  title: `Khoá học ${id}`,
  provider: 'Bệnh viện Việt Đức',
  activityTypeName: 'Đào tạo trực tiếp',
  startDate: '2026-08-01',
  endDate: '2026-08-02',
  declaredHours: 8,
  evidenceCount: 2,
  failedEvidenceCount: 0,
  workflowStatus: 'DRAFT',
  updatedAt: '2026-08-20T03:00:00Z',
  ...overrides,
})

const pageResponse = (content, overrides = {}) => ({
  data: { data: { content, page: 0, totalPages: 1, totalElements: content.length, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  search.current = new URLSearchParams()
  api.getRecordOptions.mockResolvedValue({
    data: { data: { activityTypes: [{ id: 1, name: 'Đào tạo trực tiếp' }], professionalFields: [] } },
  })
  api.listRecords.mockResolvedValue(pageResponse([
    record(1),
    record(2, { workflowStatus: 'SUBMITTED', provider: null, employeeDepartmentNameSnapshot: null, declaredHours: null, failedEvidenceCount: 3, endDate: null, updatedAt: null }),
  ]))
})

afterEach(() => { console.error.mockRestore?.() })

const renderPage = async (query = '') => {
  search.current = new URLSearchParams(query)
  render(<TrainingRecordListPage />)
  await screen.findByText('Khoá học 1')
}
const applyFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
const dateInputs = () => screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/)
const paramsOf = (call) => Object.fromEntries(call[0].entries())

describe('TrainingRecordListPage - danh sách', () => {
  it('tải hồ sơ với khoảng ngày mặc định và hiển thị đủ cột', async () => {
    render(<TrainingRecordListPage />)
    expect(screen.getByText('Loading records...')).toBeInTheDocument()

    await screen.findByText('Khoá học 1')
    expect(api.listRecords).toHaveBeenCalledWith(expect.objectContaining({
      page: 0, size: 10, sort: 'updatedAt,desc', dateFrom: FROM,
    }))
    expect(screen.getByText('NV001')).toBeInTheDocument()
    expect(screen.getByText('Bệnh viện Việt Đức')).toBeInTheDocument()
    expect(screen.getByText('Declared: 8')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('DRAFT')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('SUBMITTED')).toBeInTheDocument()
  })

  it('điền gạch ngang cho các trường còn thiếu', async () => {
    await renderPage()
    const row = screen.getByText('Khoá học 2').closest('tr')
    expect(within(row).getAllByText('-').length).toBeGreaterThanOrEqual(3)
    expect(within(row).getByText('Declared: -')).toBeInTheDocument()
    expect(within(row).getByText('/ failed')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có hồ sơ', async () => {
    api.listRecords.mockResolvedValue(pageResponse([]))
    render(<TrainingRecordListPage />)
    expect(await screen.findByText('No training records found.')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải hồ sơ thất bại', async () => {
    api.listRecords.mockRejectedValue({ response: { data: { message: 'Không có quyền xem' } } })
    render(<TrainingRecordListPage />)
    expect(await screen.findByText('Không có quyền xem')).toBeInTheDocument()
  })

  it('vẫn hiển thị danh sách khi nạp tuỳ chọn thất bại', async () => {
    api.getRecordOptions.mockRejectedValue(new Error('down'))
    await renderPage()
    expect(within(screen.getByLabelText('Activity')).getAllByRole('option')).toHaveLength(1)
  })

  it('chỉ hiện liên kết sửa và minh chứng cho hồ sơ nháp', async () => {
    await renderPage()
    const draftRow = screen.getByText('Khoá học 1').closest('tr')
    expect(within(draftRow).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/training/records/1/edit')
    expect(within(draftRow).getByRole('link', { name: 'Evidence' })).toBeInTheDocument()

    const submittedRow = screen.getByText('Khoá học 2').closest('tr')
    expect(within(submittedRow).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(submittedRow).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/training/records/2')
  })
})

describe('TrainingRecordListPage - bộ lọc', () => {
  it('nạp sẵn bộ lọc từ query string', async () => {
    await renderPage('keyword=hồi sức&activityTypeId=1&workflowStatus=DRAFT&hasEvidence=true&dateFrom=2026-02-01&dateTo=2026-03-01&page=1&size=20')

    expect(api.listRecords).toHaveBeenCalledWith({
      page: 1, size: 20, sort: 'updatedAt,desc',
      keyword: 'hồi sức', dateFrom: '2026-02-01', dateTo: '2026-03-01',
      activityTypeId: '1', workflowStatus: 'DRAFT', hasEvidence: 'true',
    })
    expect(screen.getByPlaceholderText('Title, provider, employee')).toHaveValue('hồi sức')
  })

  it('áp dụng bộ lọc và ghi vào query string', async () => {
    await renderPage()
    fireEvent.change(screen.getByPlaceholderText('Title, provider, employee'), { target: { value: '  cấp cứu  ' } })
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'SUBMITTED' } })
    fireEvent.change(screen.getByLabelText('Evidence'), { target: { value: 'false' } })
    applyFilters()

    await waitFor(() => expect(setSearchParams).toHaveBeenCalled())
    const params = paramsOf(setSearchParams.mock.calls.at(-1))
    expect(params).toMatchObject({
      keyword: 'cấp cứu', activityTypeId: '1', workflowStatus: 'SUBMITTED', hasEvidence: 'false', page: '0', size: '10',
    })
  })

  it('bỏ qua từ khoá chỉ gồm khoảng trắng', async () => {
    await renderPage()
    fireEvent.change(screen.getByPlaceholderText('Title, provider, employee'), { target: { value: '   ' } })
    applyFilters()

    const params = paramsOf(setSearchParams.mock.calls.at(-1))
    expect(params.keyword).toBeUndefined()
  })

  it('chặn áp dụng khi khoảng ngày không hợp lệ', async () => {
    await renderPage()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    applyFilters()

    expect(screen.getByRole('alert')).toHaveTextContent('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('xoá lỗi ngày khi người dùng sửa lại', async () => {
    await renderPage()
    fireEvent.change(dateInputs()[0], { target: { value: `${THIS_YEAR + 5}-01-01` } })
    applyFilters()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(dateInputs()[1], { target: { value: `${THIS_YEAR}-12-31` } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc đưa query string về khoảng ngày mặc định', async () => {
    await renderPage('keyword=abc&workflowStatus=DRAFT')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    const params = paramsOf(setSearchParams.mock.calls.at(-1))
    expect(params).toEqual({ dateFrom: FROM, dateTo: expect.any(String) })
    expect(screen.getByPlaceholderText('Title, provider, employee')).toHaveValue('')
  })
})

describe('TrainingRecordListPage - phân trang', () => {
  it('chuyển trang tiến và lùi', async () => {
    api.listRecords.mockResolvedValue(pageResponse([record(1)], { page: 1, totalPages: 3 }))
    await renderPage('page=1')

    expect(screen.getByText('Page 2 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(paramsOf(setSearchParams.mock.calls.at(-1)).page).toBe('2')

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(paramsOf(setSearchParams.mock.calls.at(-1)).page).toBe('0')
  })

  it('vô hiệu nút lùi ở trang đầu và nút tiến ở trang cuối', async () => {
    api.listRecords.mockResolvedValue(pageResponse([record(1)], { page: 0, totalPages: 1 }))
    await renderPage()

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('hiện ít nhất một trang khi backend trả về 0 trang', async () => {
    api.listRecords.mockResolvedValue(pageResponse([record(1)], { page: 0, totalPages: 0 }))
    await renderPage()
    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument()
  })
})
