import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChecklistCreatePage from './ChecklistCreatePage.jsx'

const navigate = vi.fn()
let routeParams = {}

const api = vi.hoisted(() => ({
  createForm: vi.fn(),
  createFormVersion: vi.fn(),
  deleteForm: vi.fn(),
  getFormById: vi.fn(),
  getFormVersionById: vi.fn(),
  getFormVersions: vi.fn(),
  updateForm: vi.fn(),
  updateFormVersion: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => routeParams,
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, back, breadcrumbs }) => (
    <main>
      <div data-testid="back-target">{back?.to}</div>
      <div data-testid="breadcrumbs">{breadcrumbs?.map((item) => item.label).join(' / ')}</div>
      {children}
    </main>
  ),
}))
vi.mock('../components/ChecklistReadOnlyVersion.jsx', () => ({
  default: ({ version }) => <div data-testid="read-only-version">{version?.title}</div>,
}))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button type="button" onClick={onConfirm}>Xác nhận</button>
      <button type="button" onClick={onCancel}>Hủy</button>
    </div>
  ) : null,
}))

const option = (key, label, order) => ({
  optionKey: key,
  value: label.toUpperCase(),
  label,
  displayOrder: order,
})

const versionQuestion = (overrides = {}) => ({
  questionKey: 'q-1',
  code: 'Q_1',
  title: 'Rửa tay đúng quy trình',
  fieldType: 'SINGLE_CHOICE',
  required: true,
  readOnly: false,
  critical: false,
  excludeFromScore: true,
  helpText: null,
  metricCode: null,
  validationConfig: null,
  displayConfig: null,
  options: [option('o-2', 'Đạt', 1), option('o-1', 'Không đạt', 0)],
  ...overrides,
})

const compatibleVersion = (overrides = {}) => ({
  id: 20,
  title: 'Phiên bản nháp',
  status: 'DRAFT',
  lockVersion: 4,
  settings: { subjectSelector: { lookupBy: 'employeeCode' } },
  sections: [{
    sectionKey: 'section-1',
    displayOrder: 0,
    items: [{
      itemKey: 'item-1',
      itemType: 'QUESTION',
      displayOrder: 0,
      question: versionQuestion(),
    }],
  }],
  ...overrides,
})

const formResponse = (overrides = {}) => ({
  data: { data: {
    id: 7,
    title: 'Bảng kiểm vệ sinh tay',
    description: 'Mô tả hiện tại',
    currentPublishedVersion: null,
    ...overrides,
  } },
})

const versionsResponse = (content = []) => ({ data: { data: { content } } })

beforeEach(() => {
  vi.resetAllMocks()
  routeParams = {}
  window.sessionStorage.clear()
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID: vi.fn(() => `uuid-${Math.random().toString(16).slice(2)}`) },
  })
  api.createForm.mockResolvedValue({ data: { data: { id: 7 } } })
  api.createFormVersion.mockResolvedValue({ data: { data: { id: 20 } } })
  api.updateForm.mockResolvedValue({ data: { data: {} } })
  api.updateFormVersion.mockResolvedValue({ data: { data: {} } })
  api.deleteForm.mockResolvedValue({ data: { data: null } })
})

const renderNewPage = () => render(<ChecklistCreatePage />)

const fillValidChoice = () => {
  fireEvent.change(screen.getByLabelText('Tiêu đề checklist'), { target: { value: 'Đánh giá tiêm truyền' } })
  fireEvent.change(screen.getByLabelText('Mô tả checklist'), { target: { value: '  Mô tả mẫu  ' } })
  fireEvent.change(screen.getByLabelText('Câu hỏi 1'), { target: { value: 'Thao tác đạt yêu cầu?' } })
  fireEvent.change(screen.getByLabelText('Tùy chọn 1'), { target: { value: 'Đạt' } })
  fireEvent.change(screen.getByLabelText('Tùy chọn 2'), { target: { value: 'Không đạt' } })
}

describe('ChecklistCreatePage - tạo mới', () => {
  it('edits question types, options, duplicates and removes questions', async () => {
    renderNewPage()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Tạo mới checklist')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Trắc nghiệm/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Trả lời ngắn' }))
    expect(screen.getByText('Người trả lời nhập câu trả lời ngắn')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Trả lời ngắn/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Đoạn văn' }))
    expect(screen.getByText('Người trả lời nhập đoạn văn bản')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Đoạn văn/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Menu thả xuống' }))
    expect(screen.getAllByLabelText(/Tùy chọn/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Thêm tùy chọn/ }))
    expect(screen.getAllByLabelText(/Tùy chọn/)).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Tùy chọn 3'), { target: { value: 'Không áp dụng' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa tùy chọn' })[2])
    expect(screen.getAllByLabelText(/Tùy chọn/)).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Câu hỏi 1'), { target: { value: 'Câu gốc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nhân bản câu hỏi' }))
    expect(screen.getByDisplayValue('Câu gốc (bản sao)')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Xóa câu hỏi' })[1])
    expect(screen.queryByDisplayValue('Câu gốc (bản sao)')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa câu hỏi' }))
    expect(screen.getByRole('alert')).toHaveTextContent('ít nhất một câu hỏi')

    fireEvent.click(screen.getByRole('button', { name: 'Thêm câu hỏi' }))
    expect(screen.getAllByLabelText(/^Câu hỏi \d+$/)).toHaveLength(2)
  })

  it('validates choices and creates a form with normalized option values', async () => {
    renderNewPage()
    fireEvent.change(screen.getByLabelText('Tùy chọn 1'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('ít nhất 2 tùy chọn')

    fillValidChoice()
    fireEvent.click(screen.getByLabelText(/Tra cứu đối tượng bằng mã nhân viên/))
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))

    await waitFor(() => expect(api.createForm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Đánh giá tiêm truyền',
      description: 'Mô tả mẫu',
      subjectType: 'USER',
      ownerDepartmentId: null,
    })))
    expect(api.createFormVersion).toHaveBeenCalledWith(7, expect.objectContaining({
      title: 'Đánh giá tiêm truyền',
      settings: expect.objectContaining({
        subjectSelector: expect.objectContaining({ lookupBy: 'employeeCode' }),
        evaluatorSource: 'CURRENT_USER',
      }),
    }))
    const payload = api.createFormVersion.mock.calls[0][1]
    expect(payload.sections[0].items[0].question.options).toEqual([
      expect.objectContaining({ label: 'Đạt', value: 'AT_1' }),
      expect.objectContaining({ label: 'Không đạt', value: 'KHONG_AT_2' }),
    ])
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/7/edit')
    expect(window.sessionStorage.getItem('carehub.pendingChecklistDraft')).toBeNull()
  })

  it('keeps a recoverable pending draft when version creation fails', async () => {
    api.createFormVersion.mockRejectedValueOnce({ response: { status: 500 } })
    renderNewPage()
    fillValidChoice()
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('chưa tạo được bản nháp')
    expect(screen.getByRole('button', { name: /Thử tạo lại bản nháp/ })).toBeInTheDocument()
    expect(JSON.parse(window.sessionStorage.getItem('carehub.pendingChecklistDraft')).formId).toBe(7)
  })

  it('restores, retries and discards a pending draft', async () => {
    window.sessionStorage.setItem('carehub.pendingChecklistDraft', JSON.stringify({
      formId: 17,
      editor: {
        title: 'Mẫu đang dở',
        description: 'Khôi phục mô tả',
        enableEmployeeCodeLookup: false,
        questions: [{
          id: 'existing-q', itemKey: null, questionKey: null, code: null,
          title: 'Câu khôi phục', fieldType: 'SHORT_TEXT', options: [],
        }],
      },
    }))
    renderNewPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Đang khôi phục checklist #17')
    fireEvent.click(screen.getByRole('button', { name: /Thử tạo lại bản nháp/ }))
    await waitFor(() => expect(api.updateForm).toHaveBeenCalledWith(17, expect.any(Object)))
    expect(api.createFormVersion).toHaveBeenCalledWith(17, expect.any(Object))

    cleanup()
    window.sessionStorage.setItem('carehub.pendingChecklistDraft', JSON.stringify({
      formId: 18,
      editor: { title: 'Xóa tôi', description: '', enableEmployeeCodeLookup: false, questions: [{ id: 'q', title: '', fieldType: 'SHORT_TEXT', options: [] }] },
    }))
    render(<ChecklistCreatePage />)
    fireEvent.click(screen.getAllByRole('button', { name: /Hủy bản nháp/ }).at(-1))
    const dialog = screen.getByRole('dialog', { name: 'Hủy bản nháp checklist' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(api.deleteForm).toHaveBeenCalledWith(18))
  })

  it('recovers from a duplicate draft conflict and reports recovery failures', async () => {
    api.createFormVersion.mockRejectedValueOnce({ response: { status: 409 } })
    api.getFormVersions.mockResolvedValueOnce(versionsResponse([{ id: 30 }]))
    api.getFormVersionById.mockResolvedValueOnce({ data: { data: { id: 30, lockVersion: 8 } } })
    renderNewPage()
    fillValidChoice()
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))
    await waitFor(() => expect(api.updateFormVersion).toHaveBeenCalledWith(7, 30, expect.objectContaining({ lockVersion: 8 })))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/7/edit')

    cleanup()
    vi.resetAllMocks()
    api.createForm.mockResolvedValue({ data: { data: { id: 9 } } })
    api.createFormVersion.mockRejectedValueOnce({ response: { status: 409 } })
    api.getFormVersions.mockResolvedValueOnce(versionsResponse([]))
    render(<ChecklistCreatePage />)
    fillValidChoice()
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent('Không tìm thấy bản nháp')
  })

  it('handles invalid storage, missing create id and create conflicts', async () => {
    window.sessionStorage.setItem('carehub.pendingChecklistDraft', '{bad json')
    renderNewPage()
    expect(window.sessionStorage.getItem('carehub.pendingChecklistDraft')).toBeNull()

    api.createForm.mockResolvedValueOnce({ data: { data: {} } })
    fillValidChoice()
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tạo checklist mới')

    api.createForm.mockRejectedValueOnce({ response: { status: 409 } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu bản nháp/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('được cập nhật ở nơi khác'))
  })
})

describe('ChecklistCreatePage - chi tiết', () => {
  const prepareDetail = ({ form = {}, versions = [{ id: 20, status: 'DRAFT' }], version = compatibleVersion() } = {}) => {
    routeParams = { id: '7' }
    api.getFormById.mockResolvedValue(formResponse(form))
    api.getFormVersions.mockResolvedValue(versionsResponse(versions))
    api.getFormVersionById.mockResolvedValue({ data: { data: version } })
  }

  it('loads a compatible draft, navigates management actions and updates it', async () => {
    prepareDetail()
    render(<ChecklistCreatePage />)
    expect(await screen.findByDisplayValue('Bảng kiểm vệ sinh tay')).toBeDisabled()
    expect(screen.getByDisplayValue('Không đạt')).toBeDisabled()
    expect(screen.getByLabelText(/Tra cứu đối tượng bằng mã nhân viên/)).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /Giao bảng kiểm/ }))
    fireEvent.click(screen.getByRole('button', { name: /Quản lý phiên bản/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklist-assignments?formId=7')
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists/7/edit')

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    fireEvent.change(screen.getByLabelText('Tiêu đề checklist'), { target: { value: 'Tên cập nhật' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    await waitFor(() => expect(api.updateFormVersion).toHaveBeenCalledWith('7', 20, expect.objectContaining({
      title: 'Tên cập nhật', lockVersion: 4,
    })))
    expect(api.updateForm).toHaveBeenCalledWith('7', expect.objectContaining({ title: 'Tên cập nhật' }))
  })

  it('creates a draft from the published version and uses a default empty editor when no version exists', async () => {
    prepareDetail({
      form: { currentPublishedVersion: { id: 44 } },
      versions: [{ id: 44, status: 'PUBLISHED' }],
      version: compatibleVersion({ id: 44, status: 'PUBLISHED' }),
    })
    render(<ChecklistCreatePage />)
    await screen.findByDisplayValue('Bảng kiểm vệ sinh tay')
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    await waitFor(() => expect(api.createFormVersion).toHaveBeenCalledWith('7', expect.any(Object)))

    cleanup()
    vi.resetAllMocks()
    routeParams = { id: '8' }
    api.getFormById.mockResolvedValue(formResponse({ currentPublishedVersion: null }))
    api.getFormVersions.mockResolvedValue(versionsResponse([]))
    render(<ChecklistCreatePage />)
    expect(await screen.findByLabelText('Câu hỏi 1')).toBeDisabled()
    expect(api.getFormVersionById).not.toHaveBeenCalled()
  })

  it('shows an advanced version read-only and blocks the simple editor', async () => {
    const advanced = compatibleVersion({
      title: 'Cấu trúc nâng cao',
      sections: [{
        sectionKey: 's1', displayOrder: 0,
        items: [{ itemKey: 'note', itemType: 'INSTRUCTION', displayOrder: 0, description: 'Lưu ý' }],
      }],
    })
    prepareDetail({ version: advanced })
    render(<ChecklistCreatePage />)
    expect(await screen.findByTestId('read-only-version')).toHaveTextContent('Cấu trúc nâng cao')
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lưu thay đổi/ })).not.toBeInTheDocument()
  })

  it('reloads on cancel and reports metadata update failure after saving content', async () => {
    prepareDetail()
    render(<ChecklistCreatePage />)
    await screen.findByDisplayValue('Bảng kiểm vệ sinh tay')
    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    fireEvent.change(screen.getByLabelText('Tiêu đề checklist'), { target: { value: 'Không lưu metadata' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy chỉnh sửa' }))
    await waitFor(() => expect(api.getFormById).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    api.updateForm.mockRejectedValueOnce({ response: { data: { message: 'Metadata lỗi' } } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Metadata lỗi')
    expect(screen.getByRole('button', { name: /Lưu thay đổi/ })).toBeInTheDocument()
  })

  it('renders API validation errors for malformed form, versions and version content', async () => {
    routeParams = { id: '7' }
    api.getFormById.mockResolvedValue({ data: { data: null } })
    api.getFormVersions.mockResolvedValue(versionsResponse([]))
    render(<ChecklistCreatePage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Phản hồi chi tiết checklist không hợp lệ')

    cleanup()
    vi.resetAllMocks()
    api.getFormById.mockResolvedValue(formResponse({ currentPublishedVersion: { id: 20 } }))
    api.getFormVersions.mockResolvedValue(versionsResponse([{ id: 20, status: 'PUBLISHED' }]))
    api.getFormVersionById.mockResolvedValue({ data: { data: null } })
    render(<ChecklistCreatePage />)
    expect((await screen.findAllByRole('alert')).at(-1)).toHaveTextContent('Không thể tải cấu trúc checklist')
  })
})
