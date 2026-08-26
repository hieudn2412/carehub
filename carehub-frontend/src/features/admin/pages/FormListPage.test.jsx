import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FormListPage from './FormListPage.jsx'

const navigate = vi.fn()
const api = vi.hoisted(() => ({
  getForms: vi.fn(),
  getDepartments: vi.fn(),
  deleteForm: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p><button onClick={onConfirm}>Xác nhận</button><button onClick={onCancel}>Hủy</button>
    </div>
  ) : null,
}))
vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options }) => (
    <label>{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
  ),
}))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ actions, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchValue }) => (
    <section>
      <input aria-label="Tìm kiếm checklist" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      {isOpen && <div data-testid="filter-panel">{children}<button onClick={onApply}>Áp dụng</button><button onClick={onReset}>Xóa bộ lọc</button></div>}
      <div data-testid="toolbar-actions">{actions}</div>
    </section>
  ),
}))

const activeForm = {
  id: 11,
  code: 'QT-11',
  title: 'Rửa tay ngoại khoa',
  description: 'Quy trình vô khuẩn',
  createdAt: '2026-08-20T10:00:00Z',
  status: 'PUBLISHED',
  activeAssignmentCount: 3,
  responseCount: 8,
  ownerDepartment: { id: 2, name: 'Ngoại' },
  currentPublishedVersion: { id: 101, versionNumber: 2, passingScore: 7 },
}
const draftForm = {
  id: 12,
  code: 'QT-12',
  title: 'Tiêm truyền',
  description: '',
  createdAt: 'not-a-date',
  status: 'DRAFT',
  activeAssignmentCount: null,
  responseCount: null,
  currentPublishedVersion: null,
}

const pageResponse = (content = [activeForm, draftForm], overrides = {}) => ({
  data: { data: { content, totalElements: content.length, totalPages: 1, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.getForms.mockResolvedValue(pageResponse())
  api.getDepartments.mockResolvedValue({ data: { data: { content: [{ id: 2, name: 'Khoa Ngoại' }] } } })
  api.deleteForm.mockResolvedValue({ data: { success: true } })
})

const renderPage = async () => {
  render(<FormListPage />)
  await screen.findByText('Rửa tay ngoại khoa')
}

describe('FormListPage', () => {
  it('renders checklist data and opens every row destination', async () => {
    await renderPage()
    expect(screen.getByText('Quy trình vô khuẩn')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('7.0/10')).toBeInTheDocument()
    expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Bản nháp')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa có').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTitle('Quản lý người được giao Rửa tay ngoại khoa'))
    expect(navigate).toHaveBeenLastCalledWith('/admin/quality/checklist-assignments?formId=11')
    fireEvent.click(screen.getByLabelText('Thực hiện đánh giá Rửa tay ngoại khoa'))
    expect(navigate).toHaveBeenLastCalledWith('/admin/quality/checklists/11/evaluate/101')
    fireEvent.click(screen.getByLabelText('Xem chi tiết Rửa tay ngoại khoa'))
    expect(navigate).toHaveBeenLastCalledWith('/admin/quality/checklists/11/detail')
    fireEvent.click(screen.getAllByText('Tạo biểu mẫu mới')[0])
    expect(navigate).toHaveBeenLastCalledWith('/admin/quality/checklists/new')
  })

  it('opens import options, routes both presets and closes with Escape', async () => {
    await renderPage()
    const importButtons = screen.getAllByRole('button', { name: /Import Google Form/ })
    fireEvent.click(importButtons[0])
    fireEvent.click(screen.getAllByRole('menuitem', { name: /Import 18 form cũ/ })[0])
    expect(navigate).toHaveBeenLastCalledWith('/admin/form-imports/new?preset=legacy-18')

    fireEvent.click(importButtons[0])
    fireEvent.click(screen.getAllByRole('menuitem', { name: /Import form mới/ })[0])
    expect(navigate).toHaveBeenLastCalledWith('/admin/form-imports/new')

    fireEvent.click(importButtons[0])
    fireEvent.keyDown(importButtons[0].closest('.flp-import-menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('loads department choices lazily and applies normalized filters', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    await waitFor(() => expect(api.getDepartments).toHaveBeenCalledTimes(1))
    await screen.findByRole('option', { name: 'Khoa Ngoại' })
    fireEvent.change(screen.getByLabelText('Tìm kiếm checklist'), { target: { value: '  QT 11  ' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PUBLISHED' } })
    await waitFor(() => expect(screen.getByLabelText('Khoa/phòng').querySelector('option[value="2"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Khoa/phòng'), { target: { value: '2' } })
    fireEvent.click(within(screen.getByTestId('filter-panel')).getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'QT 11', status: 'PUBLISHED', ownerDepartmentId: 2, page: 0,
    })))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: undefined, status: undefined, ownerDepartmentId: undefined,
    })))
  })

  it('retires a form, caches it and displays the retired list', async () => {
    api.getForms.mockImplementation((params) => Promise.resolve(
      params.status === 'RETIRED' ? pageResponse([]) : pageResponse(),
    ))
    await renderPage()
    fireEvent.click(screen.getByLabelText('Ngừng hoạt động Rửa tay ngoại khoa'))
    const dialog = screen.getByRole('dialog', { name: 'Ngừng hoạt động checklist' })
    expect(dialog).toHaveTextContent('Rửa tay ngoại khoa')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(api.deleteForm).toHaveBeenCalledWith(11))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'RETIRED', includeDeleted: true })))
    expect(JSON.parse(localStorage.getItem('carehub.admin.retiredForms'))[0]).toEqual(expect.objectContaining({ id: 11, status: 'RETIRED' }))
    expect(await screen.findByText('Đã ngừng')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ngừng hoạt động Rửa tay ngoại khoa')).not.toBeInTheDocument()
  })

  it('cancels retirement and reports a failed retirement', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Ngừng hoạt động Rửa tay ngoại khoa'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' }))
    expect(api.deleteForm).not.toHaveBeenCalled()

    api.deleteForm.mockRejectedValueOnce({ response: { status: 403 } })
    fireEvent.click(screen.getByLabelText('Ngừng hoạt động Rửa tay ngoại khoa'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền')
  })

  it.each([
    [new Error('offline'), 'Không thể kết nối'],
    [{ response: { status: 401 } }, 'Phiên đăng nhập đã hết hạn'],
    [{ response: { status: 403 } }, 'không có quyền'],
    [{ response: { status: 500 } }, 'Không thể tải danh sách'],
  ])('shows load errors and retries (%#)', async (error, expected) => {
    api.getForms.mockRejectedValueOnce(error).mockResolvedValueOnce(pageResponse())
    render(<FormListPage />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(expected)
    fireEvent.click(within(alert).getByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('Rửa tay ngoại khoa')).toBeInTheDocument()
  })

  it('handles malformed data and department load errors', async () => {
    api.getForms.mockResolvedValueOnce({ data: { data: { content: null } } })
    render(<FormListPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối')

    api.getForms.mockResolvedValue(pageResponse())
    api.getDepartments.mockRejectedValueOnce(new Error('departments'))
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/ }))
    await screen.findByText('Rửa tay ngoại khoa')
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    await waitFor(() => expect(api.getDepartments).toHaveBeenCalled())
    expect(screen.queryByRole('option', { name: 'Khoa Ngoại' })).not.toBeInTheDocument()
  })

  it('paginates through a long result and ignores unavailable/current pages', async () => {
    api.getForms.mockResolvedValue(pageResponse([activeForm], { totalElements: 70, totalPages: 7 }))
    await renderPage()
    const nav = screen.getByRole('navigation', { name: 'Phân trang checklist' })
    expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual(['Trước', '1', '2', '3', '4', '5', 'Sau'])
    fireEvent.click(within(nav).getByRole('button', { name: '3' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(api.getForms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })))
  })

  it('shows each empty-state message, including cached retired matches', async () => {
    api.getForms.mockResolvedValue(pageResponse([], { totalElements: 0, totalPages: 0 }))
    render(<FormListPage />)
    expect(await screen.findByText('Chưa có checklist nào')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tìm kiếm checklist'), { target: { value: 'không có' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.click(within(screen.getByTestId('filter-panel')).getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Không tìm thấy checklist phù hợp')).toBeInTheDocument()

    localStorage.setItem('carehub.admin.retiredForms', JSON.stringify([{ ...activeForm, status: 'RETIRED', deleted: true }]))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'RETIRED' } })
    fireEvent.change(screen.getByLabelText('Tìm kiếm checklist'), { target: { value: 'QT-11' } })
    fireEvent.click(within(screen.getByTestId('filter-panel')).getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Rửa tay ngoại khoa')).toBeInTheDocument()
  })
})
