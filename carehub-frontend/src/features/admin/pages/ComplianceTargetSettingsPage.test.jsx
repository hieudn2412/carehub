import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComplianceTargetSettingsPage from './ComplianceTargetSettingsPage.jsx'

const api = vi.hoisted(() => ({
  getForms: vi.fn(),
  getDepartments: vi.fn(),
  getComplianceTargets: vi.fn(),
}))
const modalProps = vi.hoisted(() => ({ current: null }))

vi.mock('../api/adminApi.js', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('./ChecklistQualityDashboardPage.jsx', () => ({
  ComplianceTargetModal: (props) => {
    modalProps.current = props
    return (
      <div role="dialog" aria-label="Cấu hình mục tiêu tuân thủ">
        <p>{props.form.formTitle}</p>
        <p>{props.form.formCode}</p>
        <span data-testid="modal-departments">{props.departments.length}</span>
        <button onClick={props.onSaved}>Lưu mục tiêu</button>
        <button onClick={props.onClose}>Đóng cấu hình</button>
      </div>
    )
  },
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
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ actions, activeCount, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      <span data-testid="active-count">{activeCount}</span>
      {isOpen && <div>{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
      <div>{actions}</div>
    </section>
  ),
}))

const form = (id, overrides = {}) => ({
  id,
  title: `Bảng kiểm ${id}`,
  code: 'HAND_HYGIENE_COMPLIANCE',
  status: 'PUBLISHED',
  currentPublishedVersion: { versionNumber: 2 },
  ...overrides,
})

const formsResponse = (content, overrides = {}) => ({
  data: { data: { content, totalElements: content.length, totalPages: 1, page: 0, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  modalProps.current = null
  api.getForms.mockResolvedValue(formsResponse([
    form(1),
    form(2, { title: null, code: null, status: 'DRAFT', currentPublishedVersion: null }),
  ]))
  api.getDepartments.mockResolvedValue({ data: { data: [{ id: 3, name: 'Khoa Ngoại', departmentCode: 'NGO' }] } })
  api.getComplianceTargets.mockResolvedValue({
    data: { data: { hospitalTarget: { targetPercent: 85.5 }, departmentTargets: [{ departmentId: 3 }, { departmentId: 4 }] } },
  })
})

const renderPage = async () => {
  render(<ComplianceTargetSettingsPage />)
  await screen.findByText('Bảng kiểm 1')
}
const searchBox = () => screen.getByLabelText('Tìm theo tên hoặc mã bảng kiểm')
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
const openTargetModal = (name = 'Bảng kiểm 1') =>
  fireEvent.click(within(screen.getByText(name).closest('tr')).getByRole('button', { name: /Cấu hình mục tiêu/ }))

describe('ComplianceTargetSettingsPage - danh sách bảng kiểm', () => {
  it('tải danh sách và mục tiêu của từng bảng kiểm', async () => {
    render(<ComplianceTargetSettingsPage />)
    expect(screen.getByText(/Đang tải danh sách bảng kiểm/)).toBeInTheDocument()

    await screen.findByText('Bảng kiểm 1')
    expect(api.getForms).toHaveBeenCalledWith({
      page: 0, size: 10, sort: 'updatedAt,desc', keyword: undefined, status: undefined,
    })
    await waitFor(() => expect(screen.getAllByText('85,50%')).toHaveLength(2))
    expect(api.getComplianceTargets).toHaveBeenCalledWith(1)
    expect(screen.getAllByText('2 khoa có mục tiêu riêng')).toHaveLength(2)
    expect(screen.getByText('TUAN_THU_VE_SINH_TAY')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('2 bảng kiểm')).toBeInTheDocument()
  })

  it('điền giá trị mặc định cho bảng kiểm thiếu tiêu đề, mã và phiên bản', async () => {
    await renderPage()
    const row = screen.getByText('Bảng kiểm chưa có tiêu đề').closest('tr')

    expect(within(row).getByText('#2')).toBeInTheDocument()
    expect(within(row).getByText('Chưa công bố')).toBeInTheDocument()
    expect(within(row).getByText('Bản nháp')).toBeInTheDocument()
  })

  it('hiện mục tiêu mặc định 80% khi máy chủ chưa cấu hình', async () => {
    api.getComplianceTargets.mockResolvedValue({ data: { data: { hospitalTarget: null, departmentTargets: null } } })
    await renderPage()

    await waitFor(() => expect(screen.getAllByText('80,00%')).toHaveLength(2))
    expect(screen.getAllByText('0 khoa có mục tiêu riêng')).toHaveLength(2)
  })

  it('coi mục tiêu không phải số là mặc định', async () => {
    api.getComplianceTargets.mockResolvedValue({ data: { data: { hospitalTarget: { targetPercent: 'abc' }, departmentTargets: [] } } })
    await renderPage()
    await waitFor(() => expect(screen.getAllByText('80,00%')).toHaveLength(2))
  })

  it('bỏ qua bảng kiểm không lấy được cấu hình mục tiêu', async () => {
    api.getComplianceTargets.mockRejectedValue(new Error('down'))
    await renderPage()
    await waitFor(() => expect(screen.getAllByText('80,00%')).toHaveLength(2))
  })

  it('suy ra trạng thái từ phiên bản đã công bố khi thiếu status', async () => {
    api.getForms.mockResolvedValue(formsResponse([
      form(1, { status: null, effectiveStatus: null }),
      form(2, { status: null, effectiveStatus: null, currentPublishedVersion: null }),
      form(3, { status: null, effectiveStatus: 'RETIRED' }),
    ]))
    await renderPage()

    expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Bản nháp')).toBeInTheDocument()
    expect(screen.getByText('Đã ngừng')).toBeInTheDocument()
  })

  it('giữ nguyên mã trạng thái lạ', async () => {
    api.getForms.mockResolvedValue(formsResponse([form(1, { status: 'ARCHIVED_X' })]))
    await renderPage()
    expect(screen.getByText('ARCHIVED_X')).toBeInTheDocument()
  })

  it('chịu được phản hồi dạng mảng phẳng', async () => {
    api.getForms.mockResolvedValue({ data: { data: [form(1)] } })
    await renderPage()
    expect(screen.getByText('Bảng kiểm 1')).toBeInTheDocument()
  })

  it('chịu được phản hồi dùng khoá items', async () => {
    api.getForms.mockResolvedValue({ data: { data: { items: [form(1)], totalElements: 1, totalPages: 1 } } })
    await renderPage()
    expect(screen.getByText('Bảng kiểm 1')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có bảng kiểm nào', async () => {
    api.getForms.mockResolvedValue(formsResponse([]))
    render(<ComplianceTargetSettingsPage />)

    expect(await screen.findByText('Chưa có bảng kiểm')).toBeInTheDocument()
    expect(screen.getByText('Tạo bảng kiểm trước khi cấu hình mục tiêu tuân thủ.')).toBeInTheDocument()
  })

  it('hiện lỗi kèm nút thử lại khi tải danh sách thất bại', async () => {
    api.getForms.mockRejectedValueOnce({ response: { data: { message: 'Không có quyền' } } })
    render(<ComplianceTargetSettingsPage />)

    expect(await screen.findByText('Không có quyền')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('Bảng kiểm 1')
  })

  it('làm mới dữ liệu bằng nút refresh', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByLabelText('Làm mới dữ liệu')).toBeEnabled())
    fireEvent.click(screen.getByLabelText('Làm mới dữ liệu'))

    await waitFor(() => expect(api.getForms).toHaveBeenCalledTimes(2))
  })
})

describe('ComplianceTargetSettingsPage - tìm kiếm và lọc', () => {
  it('áp dụng từ khoá và trạng thái rồi đóng bảng lọc', async () => {
    await renderPage()
    fireEvent.change(searchBox(), { target: { value: '  vệ sinh tay  ' } })
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'DRAFT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'vệ sinh tay', status: 'DRAFT',
    })))
    expect(screen.getByTestId('active-count')).toHaveTextContent('1')
    expect(screen.queryByLabelText('Trạng thái')).not.toBeInTheDocument()
  })

  it('đổi thông báo rỗng khi đang có bộ lọc', async () => {
    api.getForms.mockResolvedValue(formsResponse([]))
    render(<ComplianceTargetSettingsPage />)
    await screen.findByText('Chưa có bảng kiểm')

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByText('Không tìm thấy bảng kiểm phù hợp')).toBeInTheDocument()
    expect(screen.getByText('Hãy đổi từ khóa hoặc bộ lọc.')).toBeInTheDocument()
  })

  it('xoá bộ lọc trả mọi tham số về mặc định', async () => {
    await renderPage()
    fireEvent.change(searchBox(), { target: { value: 'abc' } })
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'DRAFT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('1'))

    openFilters()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('0'))
    expect(searchBox()).toHaveValue('')
  })

  it('nạp lại trạng thái đang áp dụng khi mở lại bảng lọc', async () => {
    await renderPage()
    openFilters()
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PUBLISHED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PUBLISHED' })))

    openFilters()
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('PUBLISHED')
  })
})

describe('ComplianceTargetSettingsPage - phân trang', () => {
  it('chuyển trang tiến và lùi', async () => {
    api.getForms.mockResolvedValue(formsResponse([form(1)], { totalElements: 25, totalPages: 3 }))
    await renderPage()

    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))

    fireEvent.click(screen.getByRole('button', { name: 'Trước' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 })))
  })

  it('hiển thị đúng dải kết quả đang xem', async () => {
    api.getForms.mockResolvedValue(formsResponse([form(1)], { totalElements: 25, totalPages: 3 }))
    await renderPage()
    expect(screen.getByText('1–10')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    expect(await screen.findByText('11–20')).toBeInTheDocument()
  })

  it('hiện ít nhất một trang khi backend trả về 0 trang', async () => {
    api.getForms.mockResolvedValue(formsResponse([form(1)], { totalElements: 1, totalPages: 0 }))
    await renderPage()
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })
})

describe('ComplianceTargetSettingsPage - cấu hình mục tiêu', () => {
  it('mở hộp thoại kèm thông tin bảng kiểm và nạp danh sách khoa', async () => {
    await renderPage()
    openTargetModal()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Bảng kiểm 1')).toBeInTheDocument()
    expect(within(dialog).getByText('TUAN_THU_VE_SINH_TAY')).toBeInTheDocument()
    await waitFor(() => expect(api.getDepartments).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('modal-departments')).toHaveTextContent('1'))
    expect(modalProps.current.form.versionNumber).toBe(2)
    expect(modalProps.current.isAdmin).toBe(true)
  })

  it('loại bỏ khoa thiếu id hoặc tên', async () => {
    api.getDepartments.mockResolvedValue({
      data: { data: [{ id: 3, name: 'Khoa Ngoại' }, { id: null, name: 'Không id' }, { departmentId: 4 }] },
    })
    await renderPage()
    openTargetModal()

    await waitFor(() => expect(screen.getByTestId('modal-departments')).toHaveTextContent('1'))
  })

  it('nhận dữ liệu khoa theo tên trường thay thế', async () => {
    api.getDepartments.mockResolvedValue({
      data: { data: { content: [{ departmentId: 7, departmentName: 'Khoa Dược', code: 'DUOC' }] } },
    })
    await renderPage()
    openTargetModal()

    await waitFor(() => expect(screen.getByTestId('modal-departments')).toHaveTextContent('1'))
  })

  it('hiện lỗi khi nạp danh sách khoa thất bại', async () => {
    api.getDepartments.mockRejectedValue({ response: { data: { message: 'Không tải được khoa' } } })
    await renderPage()
    openTargetModal()

    expect(await screen.findByText('Không tải được khoa')).toBeInTheDocument()
  })

  it('đóng hộp thoại mà không tải lại dữ liệu', async () => {
    await renderPage()
    openTargetModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Đóng cấu hình' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.getForms).toHaveBeenCalledTimes(1)
  })

  it('tải lại danh sách sau khi lưu mục tiêu', async () => {
    await renderPage()
    openTargetModal()
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu mục tiêu' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(api.getForms).toHaveBeenCalledTimes(2))
  })
})
