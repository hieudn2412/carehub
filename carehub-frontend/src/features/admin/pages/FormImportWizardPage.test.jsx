import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormImportWizardPage from './FormImportWizardPage.jsx'

const navigate = vi.fn()
const search = { current: new URLSearchParams() }
const api = vi.hoisted(() => ({
  getFormImportBatchById: vi.fn(),
  createFormImportBatch: vi.fn(),
  applyFormImportBatch: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [search.current],
}))
vi.mock('../api/adminApi', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))

const VALID_URL = 'https://docs.google.com/forms/d/e/abc/viewform'

const batch = (overrides = {}) => ({
  id: 5,
  status: 'VALIDATED',
  totalForms: 2,
  successForms: 2,
  warningForms: 1,
  failedForms: 0,
  rows: [
    {
      id: 1, code: 'HAND_HYGIENE_COMPLIANCE', sourceUrl: VALID_URL, status: 'READY',
      messages: [{ severity: 'INFO', message: 'Đã nhận diện 12 câu hỏi.' }],
    },
    {
      id: 2, code: 'TIEM_BAP', sourceUrl: `${VALID_URL}?rat-dai-${'x'.repeat(60)}`, status: 'WARNING',
      messages: [{ severity: 'WARNING', message: 'Có câu hỏi dạng chưa hỗ trợ.' }],
    },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  search.current = new URLSearchParams()
  api.getFormImportBatchById.mockResolvedValue({ data: { data: batch() } })
  api.createFormImportBatch.mockResolvedValue({ data: { data: batch() } })
  api.applyFormImportBatch.mockResolvedValue({
    data: { data: batch({ status: 'APPLIED', successForms: 2, failedForms: 0 }) },
  })
})

afterEach(() => { console.error.mockRestore?.() })

const renderStep1 = (query = '') => {
  search.current = new URLSearchParams(query)
  render(<FormImportWizardPage />)
}
const renderBatch = async (query = 'batchId=5') => {
  search.current = new URLSearchParams(query)
  render(<FormImportWizardPage />)
  await screen.findByText('TUAN_THU_VE_SINH_TAY')
}

const codeInputs = () => screen.getAllByPlaceholderText('Ví dụ: VE_SINH_TAY_LAM_SANG')
const urlInputs = () => screen.getAllByPlaceholderText('https://docs.google.com/forms/d/e/.../viewform')
const orderInputs = () => screen.getAllByRole('spinbutton')
const submitForm = () => fireEvent.submit(codeInputs()[0].closest('form'))

const fillSource = (index, { code, url, order }) => {
  if (code !== undefined) fireEvent.change(codeInputs()[index], { target: { value: code } })
  if (url !== undefined) fireEvent.change(urlInputs()[index], { target: { value: url } })
  if (order !== undefined) fireEvent.change(orderInputs()[index], { target: { value: order } })
}

describe('FormImportWizardPage - bước nhập nguồn', () => {
  it('khởi tạo với đúng một dòng trống ở chế độ tùy chỉnh', () => {
    renderStep1()
    expect(screen.getAllByText('Import tùy chỉnh').length).toBeGreaterThan(0)
    expect(screen.getByText('Nhập liên kết Google Form cần Import')).toBeInTheDocument()
    expect(codeInputs()).toHaveLength(1)
    expect(screen.getByText('1/25 form')).toBeInTheDocument()
    expect(screen.getByText('Chưa có mã biểu mẫu')).toBeInTheDocument()
    // một dòng duy nhất thì không cho xoá
    expect(screen.queryByLabelText('Xóa Google Form 1')).not.toBeInTheDocument()
  })

  it('nạp sẵn 18 biểu mẫu cũ khi có preset legacy', () => {
    renderStep1('preset=legacy-18')
    expect(screen.getAllByText('Bộ 18 form cũ').length).toBeGreaterThan(0)
    expect(screen.getByText('Import 18 Google Form cũ')).toBeInTheDocument()
    expect(codeInputs()).toHaveLength(18)
    expect(screen.getByText('18/25 form')).toBeInTheDocument()
    expect(codeInputs()[0]).toHaveValue('NHAN_DIEN_NGUOI_BENH')
  })

  it('nạp 18 form cũ từ chế độ tùy chỉnh', () => {
    renderStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Nạp 18 form cũ' }))
    expect(navigate).toHaveBeenCalledWith('/admin/form-imports/new?preset=legacy-18')
    expect(codeInputs()).toHaveLength(18)
  })

  it('quay về import tùy chỉnh từ chế độ 18 form cũ', () => {
    renderStep1('preset=legacy-18')
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang import mới' }))
    expect(navigate).toHaveBeenCalledWith('/admin/form-imports/new')
    expect(codeInputs()).toHaveLength(1)
  })

  it('thêm và xoá dòng Google Form', () => {
    renderStep1()
    fireEvent.click(screen.getByRole('button', { name: /Thêm Google Form/ }))
    expect(codeInputs()).toHaveLength(2)
    expect(screen.getByText('02')).toBeInTheDocument()
    // thứ tự tự tăng theo dòng lớn nhất
    expect(orderInputs()[1]).toHaveValue(1)

    fireEvent.click(screen.getByLabelText('Xóa Google Form 2'))
    expect(codeInputs()).toHaveLength(1)
  })

  it('bỏ qua thứ tự không phải số khi tính thứ tự dòng mới', () => {
    renderStep1()
    fireEvent.change(orderInputs()[0], { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Thêm Google Form/ }))
    expect(orderInputs()[1]).toHaveValue(0)
  })

  it('chặn thêm quá 25 Google Form', () => {
    renderStep1('preset=legacy-18')
    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Thêm Google Form/ }))
    }
    expect(codeInputs()).toHaveLength(25)
    expect(screen.getByRole('button', { name: /Thêm Google Form/ })).toBeDisabled()
  })

  it('chuẩn hoá mã tiếng Việt khi rời ô nhập', () => {
    renderStep1()
    fireEvent.change(codeInputs()[0], { target: { value: 'Tiêm bắp' } })
    fireEvent.blur(codeInputs()[0])
    expect(codeInputs()[0]).toHaveValue('TIEM_BAP')
  })

  it('hiện mã ngay trên tiêu đề dòng khi đã nhập', () => {
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP' })
    expect(screen.getByText('TIEM_BAP')).toBeInTheDocument()
  })
})

describe('FormImportWizardPage - kiểm duyệt trước khi gửi', () => {
  it('chặn khi thiếu mã hoặc liên kết', async () => {
    renderStep1()
    submitForm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng nhập đầy đủ mã và liên kết cho mọi Google Form.')
    expect(api.createFormImportBatch).not.toHaveBeenCalled()
  })

  it('chặn liên kết không phải Google Form', async () => {
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP', url: 'https://example.com/form' })
    submitForm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Mọi liên kết phải bắt đầu bằng https://docs.google.com/forms.')
  })

  it('chặn thứ tự hiển thị âm hoặc không phải số nguyên', async () => {
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL, order: '-2' })
    submitForm()
    expect(await screen.findByRole('alert')).toHaveTextContent('Thứ tự hiển thị phải là số nguyên không âm.')
  })

  it('chặn mã trùng nhau trong cùng lô', async () => {
    renderStep1()
    fireEvent.click(screen.getByRole('button', { name: /Thêm Google Form/ }))
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL, order: '0' })
    fillSource(1, { code: 'TIEM_BAP', url: VALID_URL, order: '1' })
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Mã biểu mẫu không được trùng nhau trong cùng một lô import.')
  })

  it('chặn thứ tự hiển thị trùng nhau', async () => {
    renderStep1()
    fireEvent.click(screen.getByRole('button', { name: /Thêm Google Form/ }))
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL, order: '0' })
    fillSource(1, { code: 'THUT_THAO', url: VALID_URL, order: '0' })
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Thứ tự hiển thị không được trùng nhau trong cùng một lô import.')
  })

  it('gửi payload đã chuẩn hoá và chuyển sang bước kiểm tra', async () => {
    renderStep1()
    fillSource(0, { code: 'Tiêm bắp', url: `  ${VALID_URL}  `, order: '3' })
    submitForm()

    await waitFor(() => expect(api.createFormImportBatch).toHaveBeenCalledWith({
      forms: [{ code: 'TIEM_BAP', sourceUrl: VALID_URL, displayOrder: 3 }],
    }))
    expect(navigate).toHaveBeenCalledWith('/admin/form-imports/new?batchId=5', { replace: true })
  })

  it('hiện lỗi khi máy chủ từ chối tạo lô', async () => {
    api.createFormImportBatch.mockRejectedValue({ response: { data: { message: 'Google Form không công khai' } } })
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL })
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Google Form không công khai')
    expect(codeInputs()).toHaveLength(1)
  })

  it('dùng trường error khi phản hồi thiếu message', async () => {
    api.createFormImportBatch.mockRejectedValue({ response: { data: { error: 'RATE_LIMIT' } } })
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL })
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('RATE_LIMIT')
  })

  it('hiện lỗi mặc định khi phản hồi tạo lô không có id', async () => {
    api.createFormImportBatch.mockResolvedValue({ data: { data: {} } })
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL })
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể gửi Google Form để kiểm tra.')
  })

  it('khoá nút gửi trong lúc đang kiểm tra', async () => {
    let resolveCreate
    api.createFormImportBatch.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    renderStep1()
    fillSource(0, { code: 'TIEM_BAP', url: VALID_URL })
    submitForm()

    await waitFor(() => expect(screen.getByRole('button', { name: /Thêm Google Form/ })).toBeDisabled())
    await act(async () => { resolveCreate({ data: { data: batch() } }) })
  })
})

describe('FormImportWizardPage - bước xem kết quả kiểm tra', () => {
  it('tải chi tiết lô và hiển thị các thẻ chỉ số', async () => {
    await renderBatch()

    expect(api.getFormImportBatchById).toHaveBeenCalledWith('5')
    expect(screen.getByText('LÔ IMPORT #5')).toBeInTheDocument()
    expect(screen.getByText('Đã kiểm tra, sẵn sàng import')).toBeInTheDocument()
    expect(screen.getByText('Có thể import')).toBeInTheDocument()
    expect(screen.getByText('Sẵn sàng')).toBeInTheDocument()
    expect(screen.getByText('Có cảnh báo')).toBeInTheDocument()
    expect(screen.getByText('Đã nhận diện 12 câu hỏi.')).toBeInTheDocument()
    expect(screen.getByText('Có câu hỏi dạng chưa hỗ trợ.')).toBeInTheDocument()
    // ẩn nút đổi chế độ khi đã có lô
    expect(screen.queryByRole('button', { name: /Nạp 18 form cũ/ })).not.toBeInTheDocument()
  })

  it('rút gọn URL dài quá 50 ký tự', async () => {
    await renderBatch()
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument()
  })

  it('dịch thông báo trùng mã của backend sang tiếng Việt', async () => {
    api.getFormImportBatchById.mockResolvedValue({
      data: { data: batch({ rows: [{ id: 1, code: 'TIEM_BAP', sourceUrl: VALID_URL, status: 'CONFLICT',
        messages: [{ severity: 'ERROR', message: 'Form code already exists' }] }] }) },
    })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)
    expect(await screen.findByText('Mã biểu mẫu đã tồn tại trong hệ thống.')).toBeInTheDocument()
    expect(screen.getByText('Xung đột')).toBeInTheDocument()
  })

  it('giữ nguyên mã trạng thái lạ của dòng', async () => {
    api.getFormImportBatchById.mockResolvedValue({
      data: { data: batch({ rows: [{ id: 1, code: 'TIEM_BAP', sourceUrl: VALID_URL, status: 'UNKNOWN' }] }) },
    })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)
    expect(await screen.findByText('UNKNOWN')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi lô chưa có dòng nào', async () => {
    api.getFormImportBatchById.mockResolvedValue({ data: { data: batch({ rows: [] }) } })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)
    expect(await screen.findByText('Chưa có dữ liệu phân tích cho lô import này.')).toBeInTheDocument()
  })

  it('hiện lỗi kèm nút thử tải lại khi tải chi tiết thất bại', async () => {
    api.getFormImportBatchById.mockRejectedValueOnce({ response: { data: { message: 'Lô không tồn tại' } } })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Lô không tồn tại')
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    await waitFor(() => expect(api.getFormImportBatchById).toHaveBeenCalledTimes(2))
    await screen.findByText('TUAN_THU_VE_SINH_TAY')
  })

  it('hiện lỗi mặc định khi phản hồi chi tiết rỗng', async () => {
    api.getFormImportBatchById.mockResolvedValue({ data: { data: null } })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải kết quả kiểm tra lô import.')
  })
})

describe('FormImportWizardPage - áp dụng import', () => {
  it('chỉ hiện nút áp dụng khi lô đã kiểm tra xong và còn dòng dùng được', async () => {
    await renderBatch()
    expect(screen.getAllByRole('button', { name: /Lưu kết quả & Áp dụng Import/ })).toHaveLength(2)
  })

  it('ẩn nút áp dụng khi lô thất bại hoàn toàn', async () => {
    api.getFormImportBatchById.mockResolvedValue({
      data: { data: batch({ status: 'FAILED', rows: [{ id: 1, code: 'TIEM_BAP', sourceUrl: VALID_URL, status: 'BLOCKED' }] }) },
    })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)
    await screen.findByText('Kiểm tra thất bại')
    expect(screen.queryByRole('button', { name: /Áp dụng Import/ })).not.toBeInTheDocument()
  })

  it('ẩn nút áp dụng khi mọi dòng đều không dùng được', async () => {
    api.getFormImportBatchById.mockResolvedValue({
      data: { data: batch({ status: 'VALIDATED', rows: [{ id: 1, code: 'TIEM_BAP', sourceUrl: VALID_URL, status: 'BLOCKED' }] }) },
    })
    search.current = new URLSearchParams('batchId=5')
    render(<FormImportWizardPage />)
    await screen.findByText('Không hỗ trợ')
    expect(screen.queryByRole('button', { name: /Áp dụng Import/ })).not.toBeInTheDocument()
  })

  it('áp dụng thành công và hiện băng rôn hoàn tất', async () => {
    await renderBatch()
    fireEvent.click(screen.getAllByRole('button', { name: /Áp dụng Import/ })[0])

    await waitFor(() => expect(api.applyFormImportBatch).toHaveBeenCalledWith('5'))
    expect(await screen.findByRole('status')).toHaveTextContent('Import hoàn tất.')
    expect(screen.getByText('Đã import')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xem danh sách checklist' }))
    expect(navigate).toHaveBeenCalledWith('/admin/quality/checklists')
  })

  it('hiện băng rôn hoàn tất một phần khi còn form lỗi', async () => {
    api.applyFormImportBatch.mockResolvedValue({
      data: { data: batch({ status: 'APPLIED_PARTIAL', successForms: 1, failedForms: 1 }) },
    })
    await renderBatch()
    fireEvent.click(screen.getAllByRole('button', { name: /Áp dụng Import/ })[0])

    expect(await screen.findByRole('status')).toHaveTextContent('Import hoàn tất một phần.')
    expect(screen.getByText('Đã import một phần')).toBeInTheDocument()
  })

  it('hiện băng rôn thất bại khi không form nào được tạo', async () => {
    api.applyFormImportBatch.mockResolvedValue({
      data: { data: batch({ status: 'APPLIED', successForms: 0, failedForms: 2 }) },
    })
    await renderBatch()
    fireEvent.click(screen.getAllByRole('button', { name: /Áp dụng Import/ })[0])

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Import thất bại.')
    expect(screen.getAllByText('Import thất bại').length).toBeGreaterThan(0)
  })

  it('tải lại chi tiết khi phản hồi áp dụng không có dữ liệu', async () => {
    api.applyFormImportBatch.mockResolvedValue({ data: { data: null } })
    await renderBatch()
    fireEvent.click(screen.getAllByRole('button', { name: /Áp dụng Import/ })[0])

    await waitFor(() => expect(api.getFormImportBatchById).toHaveBeenCalledTimes(2))
  })

  it('hiện lỗi khi áp dụng thất bại', async () => {
    api.applyFormImportBatch.mockRejectedValue({ response: { data: { message: 'Không ghi được vào CSDL' } } })
    await renderBatch()
    fireEvent.click(screen.getAllByRole('button', { name: /Áp dụng Import/ })[0])

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Không ghi được vào CSDL'))
  })

  it('khoá nút áp dụng trong lúc đang ghi dữ liệu', async () => {
    let resolveApply
    api.applyFormImportBatch.mockReturnValue(new Promise((resolve) => { resolveApply = resolve }))
    await renderBatch()
    fireEvent.click(screen.getAllByRole('button', { name: /Áp dụng Import/ })[0])

    await waitFor(() => expect(screen.getAllByRole('button')[0]).toBeDisabled())
    await act(async () => { resolveApply({ data: { data: batch({ status: 'APPLIED' }) } }) })
  })
})
