import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getFormAssignmentOverview: vi.fn(),
  getDepartments: vi.fn(),
  getFormAssignmentForms: vi.fn(),
  getFormAssignmentAssignees: vi.fn(),
  getFormAssignmentItems: vi.fn(),
  getFormAssignmentItemAllowedDepartments: vi.fn(),
  updateFormAssignmentItemValidity: vi.fn(),
  bulkRevokeFormAssignmentItems: vi.fn(),
  getFormAssignmentFormCandidates: vi.fn(),
  getFormAssignmentAssigneeCandidates: vi.fn(),
  getFormAssignmentManagerCandidates: vi.fn(),
  previewBulkFormAssignment: vi.fn(),
  bulkAssignForms: vi.fn(),
}))

vi.mock('../api/adminApi', () => ({ adminApi: api }))

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, breadcrumbs }) => (
    <main data-testid="app-shell" data-breadcrumbs={breadcrumbs.map((item) => item.label).join(' / ')}>
      {children}
    </main>
  ),
}))

vi.mock('../../../shared/components/Modal.jsx', () => ({
  default: ({ title, children, footer, onClose }) => (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <button type="button" onClick={onClose}>Đóng modal</button>
      {children}
      {footer}
    </section>
  ),
}))

vi.mock('../../../shared/components/FilterSelectField.jsx', () => ({
  default: ({ label, value, onChange, options = [] }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))

vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ placeholder, options = [], value = [], onChange, onSearch, loading }) => {
    const firstValue = String(options[0]?.value || (
      placeholder.includes('bảng kiểm') ? 101
        : placeholder.includes('người nhận') ? 201
          : 1
    ))
    return (
      <div data-testid={`select-${placeholder}`}>
        <span>{loading ? 'Đang tìm' : `Đã chọn ${value.length}`}</span>
        <button type="button" onClick={() => onSearch?.('tim-kiem')}>Tìm {placeholder}</button>
        <button type="button" onClick={() => onChange([firstValue])}>Chọn đầu tiên {placeholder}</button>
        {placeholder.includes('25 bảng kiểm') && (
          <button type="button" onClick={() => onChange(Array.from({ length: 26 }, (_, index) => String(index + 1)))}>
            Chọn quá giới hạn
          </button>
        )}
      </div>
    )
  },
}))

vi.mock('../../../shared/components/DateTimePicker24h.jsx', () => ({
  default: ({ value, onChange, disabled }) => (
    <input
      aria-label="Ngày giờ"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

import ChecklistAssignmentPage from './ChecklistAssignmentPage.jsx'

const departments = [
  { id: 1, name: 'Khoa Điều dưỡng' },
  { id: 2, name: 'Khoa Cấp cứu' },
]

const formRows = {
  content: [
    {
      formId: 101,
      formTitle: 'Bảng kiểm rửa tay',
      versionNumber: 2,
      ownerDepartmentName: 'Khoa Điều dưỡng',
      recipientCount: 3,
      nearestExpiry: '2030-01-02T09:30:00Z',
    },
  ],
  totalElements: 12,
  totalPages: 2,
}

const assigneeRows = {
  content: [
    {
      assigneeId: 201,
      fullName: 'Nguyễn Văn An',
      employeeCode: 'NV201',
      departmentName: 'Khoa Điều dưỡng',
      roleCodes: ['USER', 'MANAGER'],
      formCount: 4,
      nearestExpiry: null,
    },
  ],
  totalElements: 1,
  totalPages: 1,
}

const drawerItems = [
  {
    assignmentItemId: 501,
    assigneeName: 'Nguyễn Văn An',
    employeeCode: 'NV201',
    departmentName: 'Khoa Điều dưỡng',
    formTitle: 'Bảng kiểm rửa tay',
    versionNumber: 2,
    allowedDepartmentCount: 0,
    allowedDepartments: [],
    validUntil: null,
  },
  {
    assignmentItemId: 502,
    assigneeName: 'Trần Thị Bình',
    employeeCode: 'NV202',
    departmentName: 'Khoa Cấp cứu',
    formTitle: 'Bảng kiểm tiêm truyền',
    versionNumber: 1,
    allowedDepartmentCount: 2,
    allowedDepartments: [{ id: 1 }, { id: 2 }],
    validUntil: '2030-02-03T10:00:00Z',
  },
]

const pageResponse = (data) => ({ data: { data } })

function renderPage(initialEntry = '/admin/quality/assignments') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ChecklistAssignmentPage />
    </MemoryRouter>,
  )
}

async function waitForInitialFormTable() {
  await screen.findByText('Bảng kiểm rửa tay')
  expect(api.getFormAssignmentOverview).toHaveBeenCalled()
  expect(api.getFormAssignmentForms).toHaveBeenCalled()
}

async function openWizardAtStepFour({ useManagers = true } = {}) {
  fireEvent.click(screen.getByRole('button', { name: /Giao bảng kiểm/ }))
  await screen.findByText('Chọn bảng kiểm đang công bố')
  await waitFor(() => expect(api.getFormAssignmentFormCandidates).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn tối đa/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))

  await screen.findByText('Chọn người chấm')
  if (useManagers) {
    fireEvent.click(screen.getByRole('button', { name: /Chọn tất cả quản lý/ }))
    await waitFor(() => expect(api.getFormAssignmentManagerCandidates).toHaveBeenCalled())
  } else {
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn người nhận/ }))
  }
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))

  await screen.findByText('Chọn khoa/phòng được chấm')
  fireEvent.click(screen.getByRole('button', { name: /Chọn tất cả khoa\/phòng/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
  await screen.findByText('Thiết lập hạn và xác nhận')
}

beforeEach(() => {
  vi.clearAllMocks()

  api.getFormAssignmentOverview.mockResolvedValue(pageResponse({
    assignedFormCount: 4,
    recipientCount: 6,
    activePairCount: 8,
    expiringSoonCount: 2,
  }))
  api.getDepartments.mockResolvedValue(pageResponse(departments))
  api.getFormAssignmentForms.mockResolvedValue(pageResponse(formRows))
  api.getFormAssignmentAssignees.mockResolvedValue(pageResponse(assigneeRows))
  api.getFormAssignmentItems.mockResolvedValue(pageResponse({
    content: drawerItems,
    totalElements: drawerItems.length,
    totalPages: 1,
  }))
  api.getFormAssignmentItemAllowedDepartments.mockResolvedValue(pageResponse([
    { departmentId: 1, departmentName: 'Khoa Điều dưỡng' },
    { departmentId: 2, departmentName: 'Khoa Cấp cứu' },
  ]))
  api.updateFormAssignmentItemValidity.mockResolvedValue(pageResponse({}))
  api.bulkRevokeFormAssignmentItems.mockResolvedValue(pageResponse({}))
  api.getFormAssignmentFormCandidates.mockResolvedValue(pageResponse({
    content: [{ formId: 101, title: 'Bảng kiểm rửa tay', code: 'RT', versionNumber: 2, departmentName: 'Khoa Điều dưỡng' }],
    totalElements: 1,
    totalPages: 1,
  }))
  api.getFormAssignmentAssigneeCandidates.mockResolvedValue(pageResponse({
    content: [{ assigneeId: 201, fullName: 'Nguyễn Văn An', employeeCode: 'NV201', departmentName: 'Khoa Điều dưỡng', roleCodes: ['USER'] }],
    totalElements: 1,
    totalPages: 1,
  }))
  api.getFormAssignmentManagerCandidates.mockResolvedValue(pageResponse([
    { assigneeId: 202, fullName: 'Quản lý Khoa', employeeCode: 'QL202', departmentName: 'Khoa Điều dưỡng', roleCodes: ['MANAGER'] },
  ]))
  api.previewBulkFormAssignment.mockResolvedValue(pageResponse({
    totalPairs: 4,
    newCount: 2,
    updatedCount: 1,
    restoredCount: 1,
    unchangedCount: 0,
  }))
  api.bulkAssignForms.mockResolvedValue(pageResponse({
    totalPairs: 4,
    createdCount: 2,
    updatedCount: 1,
    restoredCount: 1,
  }))
})

describe('ChecklistAssignmentPage', () => {
  it('loads overview and form rows, then applies search, filters, metrics, pagination and reload', async () => {
    renderPage()
    await waitForInitialFormTable()

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-breadcrumbs', 'Giám sát tuân thủ / Giao bảng kiểm')
    expect(screen.getByRole('button', { name: /Số bảng kiểm đang được giao/ })).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: /Số người đang nhận bảng kiểm/ })).toHaveTextContent('6')
    expect(screen.getByRole('button', { name: /Tổng số cặp quyền hiệu lực/ })).toHaveTextContent('8')
    expect(screen.getByRole('button', { name: /Quyền hết hạn trong 7 ngày/ })).toHaveTextContent('2')
    expect(screen.getByText((_, element) => element?.textContent === 'Hiển thị 1-10 / 12')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByLabelText('Khoa sở hữu').querySelector('option[value="1"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Khoa sở hữu'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Tình trạng hạn'), { target: { value: 'true' } })
    await waitFor(() => expect(api.getFormAssignmentForms).toHaveBeenLastCalledWith(expect.objectContaining({
      ownerDepartmentId: '1',
      expiringSoon: 'true',
    })))

    fireEvent.change(screen.getByPlaceholderText('Tìm theo tên hoặc mã bảng kiểm...'), { target: { value: 'rửa tay' } })
    await waitFor(() => expect(api.getFormAssignmentForms).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'rửa tay' })), { timeout: 1500 })

    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(api.getFormAssignmentForms).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    fireEvent.click(screen.getByRole('button', { name: 'Trước' }))

    fireEvent.click(screen.getByRole('button', { name: /Tổng số cặp quyền hiệu lực/ }))
    await waitFor(() => expect(screen.getByPlaceholderText('Tìm theo tên hoặc mã bảng kiểm...')).toHaveValue(''))
    fireEvent.click(screen.getByRole('button', { name: /Tải lại/ }))
    await waitFor(() => expect(api.getFormAssignmentOverview.mock.calls.length).toBeGreaterThan(1))
  })

  it('switches to recipient rows and supports recipient-specific filters and metrics', async () => {
    renderPage()
    await waitForInitialFormTable()

    fireEvent.click(screen.getByRole('tab', { name: 'Theo người nhận' }))
    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(screen.getByText('Nhân viên, Quản lý cấp Khoa')).toBeInTheDocument()
    expect(screen.getByText('Không giới hạn')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByLabelText('Khoa/phòng').querySelector('option[value="2"]')).not.toBeNull())
    fireEvent.change(screen.getByLabelText('Khoa/phòng'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'MANAGER' } })
    fireEvent.change(screen.getByLabelText('Tình trạng hạn'), { target: { value: 'true' } })
    await waitFor(() => expect(api.getFormAssignmentAssignees).toHaveBeenLastCalledWith(expect.objectContaining({
      departmentId: '2',
      roleCode: 'MANAGER',
      expiringSoon: 'true',
    })))

    fireEvent.click(screen.getByRole('button', { name: /Quyền hết hạn trong 7 ngày/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(api.getFormAssignmentAssignees).toHaveBeenLastCalledWith(expect.objectContaining({
      departmentId: undefined,
      roleCode: undefined,
      expiringSoon: undefined,
    })))

    fireEvent.click(screen.getByRole('button', { name: /Số bảng kiểm đang được giao/ }))
    expect(await screen.findByText('Bảng kiểm rửa tay')).toBeInTheDocument()
  })

  it('opens form details, manages selection, validity, revoke, scopes and closing interactions', async () => {
    renderPage()
    await waitForInitialFormTable()
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }))

    const drawer = await screen.findByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })
    expect(within(drawer).getByText('Nguyễn Văn An')).toBeInTheDocument()
    expect(within(drawer).getByText('Trần Thị Bình')).toBeInTheDocument()

    fireEvent.click(within(drawer).getByText('Tất cả khoa/phòng'))
    const allScopeModal = await screen.findByRole('dialog', { name: /Khoa\/phòng áp dụng/ })
    expect(within(allScopeModal).getByText('Áp dụng cho tất cả khoa/phòng')).toBeInTheDocument()
    fireEvent.click(within(allScopeModal).getByRole('button', { name: 'Đóng modal' }))

    fireEvent.click(within(drawer).getByText('2 khoa/phòng'))
    await waitFor(() => expect(api.getFormAssignmentItemAllowedDepartments).toHaveBeenCalledWith(502))
    const scopedModal = await screen.findByRole('dialog', { name: /Khoa\/phòng áp dụng/ })
    expect(within(scopedModal).getByText('Danh sách các khoa/phòng được phân quyền (2 khoa):')).toBeInTheDocument()
    fireEvent.click(within(scopedModal).getAllByRole('button', { name: 'Đóng' })[0])

    fireEvent.click(within(drawer).getByLabelText('Chọn tất cả quyền đang hiển thị'))
    fireEvent.change(within(drawer).getByLabelText('Ngày giờ'), { target: { value: '2031-04-05T10:30' } })
    fireEvent.click(within(drawer).getByRole('button', { name: /Cập nhật hạn/ }))
    await waitFor(() => expect(api.updateFormAssignmentItemValidity).toHaveBeenCalledWith({
      assignmentItemIds: [501, 502],
      validUntil: new Date('2031-04-05T10:30').toISOString(),
    }))
    expect(await screen.findByText('Đã cập nhật hạn cho 2 quyền.')).toBeInTheDocument()

    fireEvent.click(within(drawer).getByRole('button', { name: /Thu hồi/ }))
    await waitFor(() => expect(api.bulkRevokeFormAssignmentItems).toHaveBeenCalledWith({ assignmentItemIds: [501, 502] }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Xem chi tiết/ }))
    const reopened = await screen.findByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })
    fireEvent.click(within(reopened).getByLabelText('Đóng chi tiết'))
    expect(screen.queryByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })).not.toBeInTheDocument()
  })

  it('opens recipient details and can clear an individual item selection', async () => {
    renderPage('/admin/quality/assignments?tab=assignees')
    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }))

    const drawer = await screen.findByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })
    expect(within(drawer).getByText('Chi tiết theo người nhận')).toBeInTheDocument()
    expect(within(drawer).getByText('NV201')).toBeInTheDocument()
    expect(within(drawer).getByText('Bảng kiểm rửa tay')).toBeInTheDocument()

    const checkboxes = within(drawer).getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    expect(checkboxes[1]).toBeChecked()
    fireEvent.click(checkboxes[1])
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('runs the four-step wizard, previews pairs and submits a bulk assignment', async () => {
    renderPage()
    await waitForInitialFormTable()
    await openWizardAtStepFour()

    await waitFor(() => expect(api.previewBulkFormAssignment).toHaveBeenCalledWith({
      formIds: [101],
      assigneeIds: [202],
      departmentIds: [1, 2],
      validUntil: null,
    }))
    expect(await screen.findByText('4 cặp quyền')).toBeInTheDocument()
    expect(screen.getByText('Tạo mới: 2')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Ngày giờ'), { target: { value: '2032-06-07T09:15' } })
    await waitFor(() => expect(api.previewBulkFormAssignment).toHaveBeenLastCalledWith(expect.objectContaining({
      validUntil: new Date('2032-06-07T09:15').toISOString(),
    })))
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận giao/ }))
    await waitFor(() => expect(api.bulkAssignForms).toHaveBeenCalledWith(expect.objectContaining({
      formIds: [101], assigneeIds: [202], departmentIds: [1, 2],
    })))
    expect(await screen.findByText('Đã xử lý 4 cặp quyền. Tạo mới 2, cập nhật 1, khôi phục 1.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /Giao bảng kiểm/ })).not.toBeInTheDocument()
  })

  it('supports manual candidate selection, search callbacks, back navigation, removal and closing the wizard', async () => {
    renderPage()
    await waitForInitialFormTable()
    fireEvent.click(screen.getByRole('button', { name: /Giao bảng kiểm/ }))
    await screen.findByText('Chọn bảng kiểm đang công bố')

    fireEvent.click(screen.getByRole('button', { name: /Tìm Tìm và chọn tối đa/ }))
    await waitFor(() => expect(api.getFormAssignmentFormCandidates).toHaveBeenCalledWith({ keyword: 'tim-kiem', page: 0, size: 50 }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn tối đa/ }))
    expect(screen.getAllByText('Bảng kiểm rửa tay').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn Bảng kiểm rửa tay' }))
    expect(screen.getByText('Chưa chọn bảng kiểm nào.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn tối đa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: /Tìm Tìm và chọn người nhận/ }))
    await waitFor(() => expect(api.getFormAssignmentAssigneeCandidates).toHaveBeenCalledWith({ keyword: 'tim-kiem', page: 0, size: 50 }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn người nhận/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn khoa\/phòng/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByText('Thiết lập hạn và xác nhận')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(screen.getByText('Chọn khoa/phòng được chấm')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Đóng giao bảng kiểm'))
    expect(screen.queryByRole('dialog', { name: /Giao bảng kiểm/ })).not.toBeInTheDocument()
  })

  it('validates selection limits and invalid validity dates without submitting', async () => {
    renderPage()
    await waitForInitialFormTable()
    fireEvent.click(screen.getByRole('button', { name: /Giao bảng kiểm/ }))
    await screen.findByText('Chọn bảng kiểm đang công bố')
    fireEvent.click(screen.getByRole('button', { name: 'Chọn quá giới hạn' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Chỉ được chọn tối đa 25 bảng kiểm.')
    fireEvent.click(within(screen.getByRole('alert')).getByLabelText('Đóng thông báo lỗi'))

    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn tối đa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn người nhận/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn khoa\/phòng/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    fireEvent.change(screen.getByLabelText('Ngày giờ'), { target: { value: 'invalid-date' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày hết hạn không hợp lệ')
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận giao/ }))
    expect(api.bulkAssignForms).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Ngày giờ'), { target: { value: '2020-01-01T00:00' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày hết hạn phải sau thời điểm hiện tại.')
  })

  it('surfaces preview, submit, manager selection, drawer and initial-load API failures', async () => {
    api.getFormAssignmentManagerCandidates.mockRejectedValueOnce({ response: { data: { details: [{ message: 'Không tải được quản lý' }] } } })
    api.previewBulkFormAssignment.mockRejectedValueOnce({ response: { data: { details: { message: 'Preview bị từ chối' } } } })
    renderPage()
    await waitForInitialFormTable()
    fireEvent.click(screen.getByRole('button', { name: /Giao bảng kiểm/ }))
    await screen.findByText('Chọn bảng kiểm đang công bố')
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn tối đa/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn tất cả quản lý/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được quản lý')
    fireEvent.click(screen.getByRole('button', { name: /Chọn đầu tiên Tìm và chọn người nhận/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    fireEvent.click(screen.getByRole('button', { name: /Chọn tất cả khoa\/phòng/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Preview bị từ chối')

    api.bulkAssignForms.mockRejectedValueOnce({ response: { data: { message: 'Không thể lưu quyền' } } })
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận giao/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể lưu quyền')

    fireEvent.click(screen.getByLabelText('Đóng giao bảng kiểm'))
    api.getFormAssignmentItems.mockRejectedValueOnce({ response: { data: { message: 'Chi tiết lỗi' } } })
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chi tiết lỗi')
    await waitFor(() => expect(api.getFormAssignmentItems).toHaveBeenCalled())
  })

  it('handles list and overview failures, empty data, dismissing alerts and the initial formId drawer', async () => {
    api.getFormAssignmentOverview.mockRejectedValueOnce({ response: { data: { message: 'Tổng quan lỗi' } } })
    api.getDepartments.mockRejectedValueOnce(new Error('department failure'))
    api.getFormAssignmentForms.mockRejectedValueOnce({ response: { data: { message: 'Danh sách lỗi' } } })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Tổng quan lỗi|Danh sách lỗi/)
    expect(await screen.findByText('Chưa có quyền hiệu lực phù hợp với bộ lọc.')).toBeInTheDocument()
    fireEvent.click(within(alert).getByLabelText('Đóng thông báo'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    api.getFormAssignmentForms.mockResolvedValue(pageResponse([]))
    api.getFormAssignmentOverview.mockResolvedValue(pageResponse({}))
    api.getDepartments.mockResolvedValue(pageResponse([]))
    renderPage('/admin/quality/assignments?formId=101')
    const drawer = await screen.findByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })
    expect(api.getFormAssignmentItems).toHaveBeenCalledWith({ formId: 101, assigneeId: undefined, page: 0, size: 100 })
    expect(within(drawer).getByText('Bảng kiểm rửa tay')).toBeInTheDocument()
  })

  it('rejects drawer mutations without selection and handles scope and mutation failures', async () => {
    renderPage()
    await waitForInitialFormTable()
    fireEvent.click(screen.getByRole('button', { name: /Xem chi tiết/ }))
    const drawer = await screen.findByRole('dialog', { name: 'Chi tiết quyền giao bảng kiểm' })

    // Disabled controls guard the UI; exercise one selected item and API rejection paths.
    fireEvent.click(within(drawer).getAllByRole('checkbox')[1])
    api.updateFormAssignmentItemValidity.mockRejectedValueOnce({ response: { data: { message: 'Cập nhật thất bại' } } })
    fireEvent.click(within(drawer).getByRole('button', { name: /Cập nhật hạn/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cập nhật thất bại')

    api.bulkRevokeFormAssignmentItems.mockRejectedValueOnce(new Error('network'))
    fireEvent.click(within(drawer).getByRole('button', { name: /Thu hồi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể cập nhật quyền đã chọn.')

    api.getFormAssignmentItemAllowedDepartments.mockRejectedValueOnce(new Error('scope network'))
    fireEvent.click(within(drawer).getByText('2 khoa/phòng'))
    await waitFor(() => expect(api.getFormAssignmentItemAllowedDepartments).toHaveBeenCalled())
    expect(await screen.findByText('Áp dụng cho tất cả khoa/phòng')).toBeInTheDocument()
  })
})
