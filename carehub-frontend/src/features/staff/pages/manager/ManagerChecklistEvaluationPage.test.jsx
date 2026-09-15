import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ManagerChecklistEvaluationPage from './ManagerChecklistEvaluationPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const route = { params: { id: '10' }, pathname: '/manager/quality/checklists/10/evaluate' }

const staff = vi.hoisted(() => ({
  getAssignedForm: vi.fn(),
  searchFormSubjects: vi.fn(),
  getFormSubmissionDraft: vi.fn(),
  createFormSubmission: vi.fn(),
  updateFormSubmission: vi.fn(),
  submitFormSubmission: vi.fn(),
}))
const admin = vi.hoisted(() => ({ getFormVersionById: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => route.params,
  useLocation: () => ({ pathname: route.pathname }),
}))
vi.mock('../../api/staffApi.js', () => ({ staffApi: staff }))
vi.mock('../../../admin/api/adminApi.js', () => ({ adminApi: admin }))
vi.mock('../../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../../shared/components/LoadingState.jsx', () => ({ default: ({ label }) => <div role="status">{label}</div> }))
vi.mock('../../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>{cancelText}</button>
      <button onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}))
vi.mock('../../../../shared/components/KeyboardDatePicker.jsx', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Chọn ngày" type="date" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  ),
}))
vi.mock('../../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, id, onChange, onSearch, options = [], placeholder, value, loading, emptyMessage }) => (
    <div>
      {onSearch && <input aria-label="Ô tìm nhân viên" onChange={(event) => onSearch(event.target.value)} />}
      <select aria-label={ariaLabel || placeholder} id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {loading && <span>Đang tải lựa chọn</span>}
      {options.length === 0 && emptyMessage && <span>{emptyMessage}</span>}
    </div>
  ),
}))

const question = (key, overrides = {}) => ({
  questionKey: key, title: `Câu hỏi ${key}`, fieldType: 'SHORT_TEXT',
  required: false, critical: false, readOnly: false, options: [], ...overrides,
})

const versionPayload = {
  versionNumber: 3,
  formCode: 'RUA_TAY',
  title: 'Rửa tay ngoại khoa',
  sections: [
    {
      displayOrder: 2, title: 'Phần sau',
      items: [
        { itemType: 'QUESTION', displayOrder: 1, question: question('q-number', { fieldType: 'NUMBER', title: 'Số lần rửa' }) },
        { itemType: 'QUESTION', displayOrder: 2, question: question('q-date', { fieldType: 'DATE', title: 'Ngày đánh giá' }) },
        { itemType: 'QUESTION', displayOrder: 3, question: question('q-time', { fieldType: 'TIME', title: 'Giờ đánh giá' }) },
        { itemType: 'QUESTION', displayOrder: 4, question: question('q-long', { fieldType: 'LONG_TEXT', title: 'Nhận xét' }) },
        { itemType: 'QUESTION', displayOrder: 5, question: question('q-text', { title: 'Ghi chú thêm' }) },
      ],
    },
    {
      displayOrder: 1, title: 'Phần đầu',
      items: [
        {
          itemType: 'QUESTION', displayOrder: 1,
          question: question('q-single', {
            fieldType: 'SINGLE_CHOICE', title: 'Có rửa tay không', required: true, critical: true,
            helpText: 'Quan sát trực tiếp',
            options: [{ optionKey: 'yes', label: 'Có', displayOrder: 1 }, { optionKey: 'no', label: 'Không', displayOrder: 2 }],
          }),
        },
        {
          itemType: 'QUESTION', displayOrder: 2,
          question: question('q-multi', {
            fieldType: 'MULTIPLE_CHOICE', title: 'Bước đã làm',
            options: [{ optionKey: 'a', label: 'Bước A' }, { optionKey: 'b', label: 'Bước B' }],
          }),
        },
        {
          itemType: 'QUESTION', displayOrder: 3,
          question: question('q-drop', {
            fieldType: 'DROPDOWN', title: 'Mức độ',
            options: [{ optionKey: 'high', label: 'Cao' }, { optionKey: 'low', label: 'Thấp' }],
          }),
        },
        { itemType: 'SECTION_NOTE', displayOrder: 4 },
        { itemType: 'QUESTION', displayOrder: 5, question: question('q-readonly', { readOnly: true }) },
      ],
    },
  ],
}

const assignedForm = { formId: 10, formCode: 'RUA_TAY', title: 'Rửa tay ngoại khoa', version: versionPayload }

const subjects = [
  { userId: 501, fullName: 'Nguyễn Văn A', employeeCode: 'NV001', department: 'Khoa Ngoại', position: 'Điều dưỡng' },
  { userId: 502, fullName: null, employeeCode: 'NV002', department: null, position: null },
]

const draftSubmission = {
  id: 900, lockVersion: 1,
  answers: [
    { questionKey: 'q-single', optionKey: 'yes', value: {} },
    { questionKey: 'q-multi', value: { optionKeys: ['a'] } },
    { questionKey: 'q-number', value: { numberValue: 3 } },
    { questionKey: 'q-date', value: { dateValue: '2026-08-01' } },
    { questionKey: 'q-time', value: { timeValue: '08:30' } },
    { questionKey: 'q-text', value: { textValue: 'ghi chú' } },
    { questionKey: 'q-drop', value: { optionKey: 'high' } },
    { questionKey: 'q-unknown', value: {} },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  route.params = { id: '10' }
  route.pathname = '/manager/quality/checklists/10/evaluate'
  staff.getAssignedForm.mockResolvedValue({ data: { data: assignedForm } })
  staff.searchFormSubjects.mockResolvedValue({ data: { data: { content: subjects } } })
  staff.getFormSubmissionDraft.mockResolvedValue({ status: 204, data: {} })
  staff.createFormSubmission.mockResolvedValue({ data: { data: { id: 900, lockVersion: 1, answers: [] } } })
  staff.updateFormSubmission.mockResolvedValue({ data: { data: { id: 900, lockVersion: 2, answers: [] } } })
  staff.submitFormSubmission.mockResolvedValue({ data: { data: { id: 900 } } })
  admin.getFormVersionById.mockResolvedValue({ data: { data: versionPayload } })
})

const renderPage = async () => {
  render(<ManagerChecklistEvaluationPage />)
  await screen.findByText('Chọn nhân viên được đánh giá')
  await waitFor(() => expect(staff.searchFormSubjects).toHaveBeenCalled())
  await screen.findByRole('option', { name: 'Nguyễn Văn A (NV001)' })
}

const subjectSelect = () => screen.getByLabelText('Tìm nhân viên theo tên hoặc mã')
const pickSubject = async (userId = '501') => {
  fireEvent.change(subjectSelect(), { target: { value: userId } })
  await waitFor(() => expect(staff.getFormSubmissionDraft).toHaveBeenCalled())
}
const startEvaluation = async () => {
  fireEvent.click(screen.getByRole('button', { name: /đánh giá/ }))
  await screen.findByText('BƯỚC 2/2 · THỰC HIỆN ĐÁNH GIÁ')
}
const enterFlow = async (userId = '501') => {
  await renderPage()
  await pickSubject(userId)
  await startEvaluation()
}
const goToQuestion = (index) => fireEvent.click(screen.getByLabelText(new RegExp(`^Đi đến câu ${index}`)))

describe('ManagerChecklistEvaluationPage - tải quy trình', () => {
  it('tải quy trình được giao và mở bước chọn nhân viên', async () => {
    render(<ManagerChecklistEvaluationPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải quy trình...')

    await screen.findByText('Chọn nhân viên được đánh giá')
    expect(staff.getAssignedForm).toHaveBeenCalledWith('10')
    expect(screen.getByText('Rửa tay ngoại khoa · Phiên bản v3')).toBeInTheDocument()
  })

  it('gọi API quản trị khi vào thẳng từ trang admin theo versionId', async () => {
    route.params = { id: '10', versionId: '55' }
    render(<ManagerChecklistEvaluationPage />)

    await screen.findByText('Chọn nhân viên được đánh giá')
    expect(admin.getFormVersionById).toHaveBeenCalledWith('10', '55')
    expect(staff.getAssignedForm).not.toHaveBeenCalled()
    // chế độ admin không lọc nhân viên theo phân công
    await waitFor(() => expect(staff.searchFormSubjects).toHaveBeenCalled())
    expect(staff.searchFormSubjects.mock.calls[0][0].assignmentItemId).toBeUndefined()
  })

  it.each([
    [403, 'Bạn không có quyền truy cập quy trình này hoặc phân quyền đã hết hiệu lực.'],
    [404, 'Không tìm thấy quy trình được phân quyền.'],
  ])('hiện thông báo riêng cho lỗi %i', async (status, message) => {
    staff.getAssignedForm.mockRejectedValue({ response: { status } })
    render(<ManagerChecklistEvaluationPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('hiện lỗi kết nối khi không có phản hồi từ máy chủ', async () => {
    staff.getAssignedForm.mockRejectedValue(new Error('network'))
    render(<ManagerChecklistEvaluationPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối đến máy chủ')
  })

  it('dùng message của máy chủ cho các lỗi khác', async () => {
    staff.getAssignedForm.mockRejectedValue({ response: { status: 500, data: { message: 'Lỗi hệ thống' } } })
    render(<ManagerChecklistEvaluationPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi hệ thống')
  })

  it('báo lỗi khi phản hồi thiếu phiên bản', async () => {
    staff.getAssignedForm.mockResolvedValue({ data: { data: { formId: 10 } } })
    render(<ManagerChecklistEvaluationPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối đến máy chủ')
  })
})

describe('ManagerChecklistEvaluationPage - chọn nhân viên', () => {
  it('tìm nhân viên theo từ khoá sau debounce', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Ô tìm nhân viên'), { target: { value: '  NV001  ' } })

    await waitFor(() => expect(staff.searchFormSubjects).toHaveBeenLastCalledWith({
      assignmentItemId: 10, keyword: 'NV001', page: 0, size: 20,
    }))
  })

  it('gửi keyword undefined khi ô tìm trống', async () => {
    await renderPage()
    expect(staff.searchFormSubjects).toHaveBeenCalledWith(expect.objectContaining({ keyword: undefined }))
  })

  it('chịu được phản hồi dạng mảng phẳng', async () => {
    staff.searchFormSubjects.mockResolvedValue({ data: { data: subjects } })
    render(<ManagerChecklistEvaluationPage />)
    expect(await screen.findByRole('option', { name: 'Nguyễn Văn A (NV001)' })).toBeInTheDocument()
  })

  it('hiện nhãn mặc định cho nhân viên thiếu tên và đơn vị', async () => {
    await renderPage()
    expect(screen.getByRole('option', { name: 'Chưa có tên (NV002)' })).toBeInTheDocument()
  })

  it('hiện lỗi khi tìm nhân viên thất bại', async () => {
    staff.searchFormSubjects.mockRejectedValue(new Error('down'))
    render(<ManagerChecklistEvaluationPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách nhân viên')
  })

  it('hiện thông tin nhân viên đã chọn và kiểm tra bản nháp', async () => {
    await renderPage()
    await pickSubject()

    expect(staff.getFormSubmissionDraft).toHaveBeenCalledWith({ assignmentItemId: 10, subjectUserId: 501 })
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Khoa Ngoại')).toBeInTheDocument()
    expect(screen.getByText('Điều dưỡng')).toBeInTheDocument()
  })

  it('hiện Chưa xác định cho khoa phòng và chức danh còn trống', async () => {
    await renderPage()
    await pickSubject('502')
    expect(screen.getAllByText('Chưa xác định')).toHaveLength(2)
  })

  it('báo lỗi khi id nhân viên không có trong danh sách', async () => {
    await renderPage()
    fireEvent.change(subjectSelect(), { target: { value: '' } })
    expect(await screen.findByText('Không tìm thấy thông tin nhân viên đã chọn.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /đánh giá/ })).toBeDisabled()
  })

  it('đổi nhãn nút thành Tiếp tục đánh giá khi đã có bản nháp', async () => {
    staff.getFormSubmissionDraft.mockResolvedValue({ status: 200, data: { data: draftSubmission } })
    await renderPage()
    await pickSubject()
    expect(await screen.findByRole('button', { name: /Tiếp tục đánh giá/ })).toBeInTheDocument()
  })

  it('báo lỗi khi kiểm tra bản nháp thất bại', async () => {
    staff.getFormSubmissionDraft.mockRejectedValue({ response: { data: { message: 'Không đọc được bản nháp' } } })
    await renderPage()
    await pickSubject()
    expect(await screen.findByText('Không đọc được bản nháp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /đánh giá/ })).toBeDisabled()
  })

  it('huỷ bỏ và quay lại danh sách của quản lý', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    expect(navigate).toHaveBeenCalledWith('/manager/quality/checklists')
  })

  it('quay lại danh sách nhân viên khi đang ở luồng staff', async () => {
    route.pathname = '/staff/checklists/10/evaluate'
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    expect(navigate).toHaveBeenCalledWith('/staff/checklists')
  })

  it('quay lại danh sách checklist admin khi vào thẳng theo versionId', async () => {
    route.params = { id: '10', versionId: '55' }
    render(<ManagerChecklistEvaluationPage />)
    await screen.findByText('Chọn nhân viên được đánh giá')
    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists')
  })
})

describe('ManagerChecklistEvaluationPage - làm bài đánh giá', () => {
  it('sắp xếp câu hỏi theo thứ tự phần, bỏ câu chỉ đọc và mục không phải câu hỏi', async () => {
    await enterFlow()
    // 3 câu phần đầu + 5 câu phần sau = 8 (loại readOnly và SECTION_NOTE)
    expect(screen.getByText('Câu 1/8')).toBeInTheDocument()
    expect(screen.getByText('Có rửa tay không')).toBeInTheDocument()
    expect(screen.getByText('Phần đầu')).toBeInTheDocument()
    expect(screen.getByText('Trọng yếu')).toBeInTheDocument()
    expect(screen.getByText('Quan sát trực tiếp')).toBeInTheDocument()
  })

  it('hiện thông báo khi phiên bản không có câu hỏi thực hiện được', async () => {
    staff.getAssignedForm.mockResolvedValue({
      data: { data: { ...assignedForm, version: { ...versionPayload, sections: [] } } },
    })
    await enterFlow()
    expect(screen.getByRole('alert')).toHaveTextContent('Phiên bản này chưa có câu hỏi có thể thực hiện.')
  })

  it('điều hướng bằng nút câu trước, câu tiếp theo và lưới số câu', async () => {
    await enterFlow()
    expect(screen.getByRole('button', { name: /Câu trước/ })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Câu tiếp theo/ }))
    expect(screen.getByText('Câu 2/8')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Câu trước/ }))
    expect(screen.getByText('Câu 1/8')).toBeInTheDocument()

    goToQuestion(8)
    expect(screen.getByText('Câu 8/8')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Câu tiếp theo/ })).toBeDisabled()
  })

  it('trả lời được mọi loại trường và cập nhật tiến độ', async () => {
    await enterFlow()

    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    expect(screen.getAllByText('1/8').length).toBeGreaterThan(0)

    goToQuestion(2)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bước A' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bước B' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bước A' }))
    expect(screen.getByRole('checkbox', { name: 'Bước B' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Bước A' })).not.toBeChecked()

    goToQuestion(3)
    fireEvent.change(screen.getByLabelText('Chọn một đáp án'), { target: { value: 'high' } })

    goToQuestion(4)
    fireEvent.change(screen.getByPlaceholderText('Nhập số'), { target: { value: '5' } })

    goToQuestion(5)
    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-08-25' } })

    goToQuestion(6)
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '09:15' } })

    goToQuestion(7)
    fireEvent.change(screen.getByPlaceholderText('Nhập câu trả lời...'), { target: { value: 'Nhận xét dài' } })

    goToQuestion(8)
    fireEvent.change(screen.getByPlaceholderText('Nhập câu trả lời'), { target: { value: 'Ghi chú' } })

    expect(screen.getAllByText('8/8').length).toBeGreaterThan(0)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('khôi phục câu trả lời từ bản nháp và nhảy tới câu chưa trả lời đầu tiên', async () => {
    staff.getFormSubmissionDraft.mockResolvedValue({ status: 200, data: { data: draftSubmission } })
    await enterFlow()

    // 7/8 câu đã có đáp án, câu còn thiếu là q-long (vị trí 7)
    expect(screen.getAllByText('7/8').length).toBeGreaterThan(0)
    expect(screen.getByText('Câu 7/8')).toBeInTheDocument()
    expect(screen.getByText('Đã lưu')).toBeInTheDocument()
  })

  it('bắt đầu ở câu 1 khi bản nháp đã trả lời hết', async () => {
    staff.getAssignedForm.mockResolvedValue({
      data: { data: { ...assignedForm, version: {
        ...versionPayload,
        sections: [{ displayOrder: 1, title: 'Phần đầu', items: [
          { itemType: 'QUESTION', displayOrder: 1, question: question('q-text', { title: 'Ghi chú thêm' }) },
        ] }],
      } } },
    })
    staff.getFormSubmissionDraft.mockResolvedValue({ status: 200, data: { data: draftSubmission } })
    await enterFlow()
    expect(screen.getByText('Câu 1/1')).toBeInTheDocument()
  })
})

describe('ManagerChecklistEvaluationPage - tự động lưu', () => {
  it('tạo bản nháp rồi lưu câu trả lời sau khi ngừng thao tác', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    expect(screen.getByText('Chờ tự động lưu...')).toBeInTheDocument()

    await waitFor(() => expect(staff.createFormSubmission).toHaveBeenCalledWith({
      assignmentItemId: 10,
      subject: { type: 'USER', userId: 501 },
    }), { timeout: 4000 })
    await waitFor(() => expect(staff.updateFormSubmission).toHaveBeenCalledWith(900, {
      lockVersion: 1,
      answers: [{ questionKey: 'q-single', optionKey: 'yes' }],
    }))
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument()
  })

  it('gửi đúng kiểu dữ liệu cho từng loại trường', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    goToQuestion(2)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bước A' }))
    goToQuestion(4)
    fireEvent.change(screen.getByPlaceholderText('Nhập số'), { target: { value: '5' } })
    goToQuestion(5)
    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-08-25' } })
    goToQuestion(6)
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: '09:15' } })

    await waitFor(() => expect(staff.updateFormSubmission).toHaveBeenCalled(), { timeout: 4000 })
    const answers = staff.updateFormSubmission.mock.calls.at(-1)[1].answers
    expect(answers).toEqual(expect.arrayContaining([
      { questionKey: 'q-single', optionKey: 'yes' },
      { questionKey: 'q-multi', optionKeys: ['a'] },
      { questionKey: 'q-number', numberValue: 5 },
      { questionKey: 'q-date', dateValue: '2026-08-25' },
      { questionKey: 'q-time', timeValue: '09:15' },
    ]))
  })

  it('hiện lỗi kèm nút thử lại khi tự động lưu thất bại', async () => {
    staff.updateFormSubmission.mockRejectedValue({ response: { status: 500, data: { message: 'Máy chủ bận' } } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    expect(await screen.findByText('Máy chủ bận', {}, { timeout: 4000 })).toBeInTheDocument()
    staff.updateFormSubmission.mockResolvedValue({ data: { data: { id: 900, lockVersion: 3, answers: [] } } })
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument()
  })

  it('dùng thông báo mặc định khi lỗi lưu không có message', async () => {
    staff.updateFormSubmission.mockRejectedValue({ response: { status: 500, data: {} } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    expect(await screen.findByText('Không thể tự động lưu bản nháp.', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('khôi phục bản nháp trùng khớp khi tạo mới bị 409', async () => {
    staff.createFormSubmission.mockRejectedValue({ response: { status: 409 } })
    staff.getFormSubmissionDraft
      .mockResolvedValueOnce({ status: 204, data: {} })
      .mockResolvedValue({ status: 200, data: { data: { id: 901, lockVersion: 4, answers: [] } } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    await waitFor(() => expect(staff.updateFormSubmission).toHaveBeenCalledWith(901, expect.objectContaining({ lockVersion: 4 })), { timeout: 4000 })
  })

  it('báo xung đột khi bản nháp phía máy chủ đã khác', async () => {
    staff.createFormSubmission.mockRejectedValue({ response: { status: 409 } })
    staff.getFormSubmissionDraft
      .mockResolvedValueOnce({ status: 204, data: {} })
      .mockResolvedValue({ status: 200, data: { data: draftSubmission } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    expect(await screen.findByText(/Bản nháp đã được thay đổi ở nơi khác/, {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('ném lại lỗi gốc khi 409 mà không tìm được bản nháp', async () => {
    staff.createFormSubmission.mockRejectedValue({ response: { status: 409, data: { message: 'Đã có bản nháp' } } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    expect(await screen.findByText('Đã có bản nháp', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('tải lại bản nháp và lưu lại khi cập nhật bị 409', async () => {
    staff.updateFormSubmission
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValue({ data: { data: { id: 900, lockVersion: 9, answers: [] } } })
    staff.getFormSubmissionDraft
      .mockResolvedValueOnce({ status: 204, data: {} })
      .mockResolvedValue({ status: 200, data: { data: { id: 900, lockVersion: 8, answers: [] } } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    await waitFor(() => expect(staff.updateFormSubmission).toHaveBeenCalledWith(900, expect.objectContaining({ lockVersion: 8 })), { timeout: 4000 })
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument()
  })

  it('ném lại lỗi 409 khi cập nhật mà không còn bản nháp', async () => {
    staff.updateFormSubmission.mockRejectedValue({ response: { status: 409, data: { message: 'Xung đột phiên bản' } } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    expect(await screen.findByText('Xung đột phiên bản', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('cảnh báo rời trang khi còn thay đổi chưa lưu', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('không cảnh báo rời trang khi chưa có thay đổi', async () => {
    await enterFlow()
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('ManagerChecklistEvaluationPage - nộp kết quả', () => {
  const answerRequired = () => fireEvent.click(screen.getByRole('radio', { name: 'Có' }))

  it('chặn nộp khi còn câu bắt buộc chưa trả lời', async () => {
    await enterFlow()
    goToQuestion(5)
    fireEvent.click(screen.getByRole('button', { name: /Nộp kết quả/ }))

    expect(showToast).toHaveBeenCalledWith('Vui lòng hoàn thành 1 câu hỏi bắt buộc.', 'warning')
    expect(screen.getByText('Câu 1/8')).toBeInTheDocument()
    expect(screen.getByText('Bắt buộc')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('xoá dấu bắt buộc khi câu đó được trả lời', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('button', { name: /Nộp kết quả/ }))
    expect(screen.getByText('Bắt buộc')).toBeInTheDocument()

    answerRequired()
    expect(screen.queryByText('Bắt buộc')).not.toBeInTheDocument()
  })

  it('hỏi xác nhận rồi nộp và quay lại danh sách', async () => {
    await enterFlow()
    answerRequired()
    await screen.findByText('Đã lưu', {}, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Nộp kết quả/ }))

    const dialog = screen.getByRole('dialog', { name: 'Xác nhận nộp kết quả' })
    expect(within(dialog).getByText(/Nguyễn Văn A \(NV001\)/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nộp kết quả' }))

    await waitFor(() => expect(staff.submitFormSubmission).toHaveBeenCalledWith(900, { lockVersion: 2 }))
    expect(showToast).toHaveBeenCalledWith('Đã nộp kết quả đánh giá quy trình.', 'success')
    expect(navigate).toHaveBeenCalledWith('/manager/quality/checklists')
  })

  it('đóng hộp thoại khi bấm Xem lại', async () => {
    await enterFlow()
    answerRequired()
    await screen.findByText('Đã lưu', {}, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Nộp kết quả/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(staff.submitFormSubmission).not.toHaveBeenCalled()
  })

  it('báo lỗi khi nộp thất bại', async () => {
    staff.submitFormSubmission.mockRejectedValue({ response: { data: { message: 'Đợt đánh giá đã đóng' } } })
    await enterFlow()
    answerRequired()
    await screen.findByText('Đã lưu', {}, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: /Nộp kết quả/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Nộp kết quả' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Đợt đánh giá đã đóng', 'error'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('không toast lỗi khi nguyên nhân là xung đột bản nháp', async () => {
    staff.updateFormSubmission.mockRejectedValue({ response: { status: 409, data: {} } })
    staff.getFormSubmissionDraft
      .mockResolvedValueOnce({ status: 204, data: {} })
      .mockResolvedValue({ status: 200, data: { data: draftSubmission } })
    await enterFlow()
    answerRequired()
    await screen.findByText(/Bản nháp đã được thay đổi/, {}, { timeout: 4000 })

    // nút nộp bị khoá khi đang ở trạng thái lỗi lưu
    expect(screen.getByRole('button', { name: /Nộp kết quả/ })).toBeDisabled()
  })
})

describe('ManagerChecklistEvaluationPage - đổi nhân viên và ngăn kéo', () => {
  it('lưu nốt bản nháp rồi quay lại bước chọn nhân viên', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    fireEvent.click(screen.getByRole('button', { name: /Đổi nhân viên/ }))

    expect(await screen.findByText('Chọn nhân viên được đánh giá')).toBeInTheDocument()
    expect(staff.updateFormSubmission).toHaveBeenCalled()
  })

  it('quay lại ngay khi không có gì cần lưu', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('button', { name: /Đổi nhân viên/ }))

    expect(await screen.findByText('Chọn nhân viên được đánh giá')).toBeInTheDocument()
    expect(staff.updateFormSubmission).not.toHaveBeenCalled()
  })

  it('báo lỗi và ở lại khi không lưu được trước lúc đổi nhân viên', async () => {
    staff.updateFormSubmission.mockRejectedValue({ response: { status: 500, data: {} } })
    await enterFlow()
    fireEvent.click(screen.getByRole('radio', { name: 'Có' }))
    fireEvent.click(screen.getByRole('button', { name: /Đổi nhân viên/ }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      'Chưa thể lưu bản nháp. Vui lòng thử lại trước khi đổi nhân viên.', 'error',
    ), { timeout: 4000 })
    expect(screen.getByText('BƯỚC 2/2 · THỰC HIỆN ĐÁNH GIÁ')).toBeInTheDocument()
  })

  it('mở và đóng ngăn kéo danh sách câu trên thiết bị nhỏ', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('button', { name: /Danh sách câu$/ }))

    const drawer = await screen.findByRole('dialog', { name: 'Danh sách câu hỏi và tiến độ' })
    expect(within(drawer).getByText('Tổng quan đánh giá')).toBeInTheDocument()

    fireEvent.click(within(drawer).getByLabelText('Đóng danh sách câu'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('đóng ngăn kéo khi bấm ra nền và khi chọn câu hỏi', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('button', { name: /Danh sách câu$/ }))
    fireEvent.mouseDown(screen.getByRole('presentation'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Danh sách câu$/ }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getAllByLabelText(/^Đi đến câu 3/)[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Câu 3/8')).toBeInTheDocument()
  })

  it('không đóng ngăn kéo khi bấm vào bên trong', async () => {
    await enterFlow()
    fireEvent.click(screen.getByRole('button', { name: /Danh sách câu$/ }))
    const drawer = await screen.findByRole('dialog')
    fireEvent.mouseDown(drawer)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
