import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClassificationRuleListPage from './ClassificationRuleListPage.jsx'

const navigate = vi.fn()
const showToast = vi.fn()
const api = vi.hoisted(() => ({ listRules: vi.fn(), disableRule: vi.fn() }))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../api/classificationRuleApi.js', () => ({ classificationRuleApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/AdminFilterDisclosure.jsx', () => ({
  default: ({ activeCount, children }) => <div data-testid="filters" data-active={activeCount}>{children}</div>,
}))
vi.mock('../../../shared/components/FilterActionButtons.jsx', () => ({
  default: ({ onApply, onReset }) => (
    <>
      <button onClick={onApply}>Áp dụng</button>
      <button onClick={onReset}>Xóa bộ lọc</button>
    </>
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

const rule = (id, overrides = {}) => ({
  id,
  name: `Quy tắc ${id}`,
  categoryName: 'An toàn người bệnh',
  keywords: 'nhận diện, vòng tay, mã bệnh nhân',
  sourcePattern: 'quy trình nhận diện',
  priority: id,
  enabled: true,
  statusText: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.listRules.mockResolvedValue({
    data: { data: [
      rule(1),
      rule(2, { name: 'Quy tắc tạm ngưng', enabled: false, keywords: 'a, b, c, d, e', sourcePattern: null, priority: 0, categoryName: 'Kiểm soát nhiễm khuẩn' }),
    ] },
  })
  api.disableRule.mockResolvedValue({ data: { success: true } })
})

const renderPage = async () => {
  render(<ClassificationRuleListPage />)
  await screen.findByText('Quy tắc 1')
}
const searchBox = () => screen.getByPlaceholderText('Tìm quy tắc...')
const rowOf = (name) => screen.getByText(name).closest('tr')

describe('ClassificationRuleListPage - danh sách', () => {
  it('tải và hiển thị quy tắc phân loại', async () => {
    render(<ClassificationRuleListPage />)
    expect(screen.getByText('Đang tải quy tắc phân loại...')).toBeInTheDocument()

    await screen.findByText('Quy tắc 1')
    expect(api.listRules).toHaveBeenCalledWith({})
    expect(screen.getByText('An toàn người bệnh')).toBeInTheDocument()
    expect(screen.getByText('quy trình nhận diện')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Hoạt động')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Tạm ngưng')).toBeInTheDocument()
  })

  it('rút gọn danh sách từ khoá quá 3 mục', async () => {
    await renderPage()
    expect(screen.getByText('nhận diện, vòng tay, mã bệnh nhân')).toBeInTheDocument()
    expect(screen.getByText('a, b, c...')).toBeInTheDocument()
  })

  it('điền gạch ngang cho nguồn trống và 0 cho ưu tiên thiếu', async () => {
    await renderPage()
    const row = rowOf('Quy tắc tạm ngưng')
    expect(within(row).getByText('-')).toBeInTheDocument()
    expect(within(row).getByText('0')).toBeInTheDocument()
  })

  it('ưu tiên nhãn trạng thái từ máy chủ', async () => {
    api.listRules.mockResolvedValue({ data: { data: [rule(1, { statusText: 'Đang chạy thử' })] } })
    await renderPage()
    expect(screen.getByText('Đang chạy thử')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi chưa có quy tắc nào', async () => {
    api.listRules.mockResolvedValue({ data: { data: [] } })
    render(<ClassificationRuleListPage />)
    expect(await screen.findByText('Chưa có quy tắc phân loại nào được tạo.')).toBeInTheDocument()
  })

  it('báo lỗi khi tải danh sách thất bại', async () => {
    api.listRules.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<ClassificationRuleListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền', 'error'))
  })

  it('điều hướng sang trang tạo mới và trang chỉnh sửa', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Thêm quy tắc/ }))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/classification-rules/new')

    fireEvent.click(screen.getByLabelText('Chỉnh sửa quy tắc Quy tắc 1'))
    expect(navigate).toHaveBeenCalledWith('/admin/evaluation/classification-rules/1/edit')
  })
})

describe('ClassificationRuleListPage - tìm kiếm và lọc', () => {
  it('tìm theo tên, danh mục, từ khoá và nguồn', async () => {
    await renderPage()

    fireEvent.change(searchBox(), { target: { value: 'tạm ngưng' } })
    await waitFor(() => expect(screen.queryByText('Quy tắc 1')).not.toBeInTheDocument())

    fireEvent.change(searchBox(), { target: { value: 'kiểm soát' } })
    expect(await screen.findByText('Quy tắc tạm ngưng')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'vòng tay' } })
    expect(await screen.findByText('Quy tắc 1')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'quy trình nhận diện' } })
    expect(await screen.findByText('Quy tắc 1')).toBeInTheDocument()

    fireEvent.change(searchBox(), { target: { value: 'không có' } })
    expect(await screen.findByText('Chưa có quy tắc phân loại nào được tạo.')).toBeInTheDocument()
  })

  it('lọc theo trạng thái hoạt động và tạm ngưng', async () => {
    await renderPage()

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'true' } })
    await waitFor(() => expect(screen.queryByText('Quy tắc tạm ngưng')).not.toBeInTheDocument())
    expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '1')

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'false' } })
    expect(await screen.findByText('Quy tắc tạm ngưng')).toBeInTheDocument()
    expect(screen.queryByText('Quy tắc 1')).not.toBeInTheDocument()
  })

  it('xoá bộ lọc trả danh sách về đầy đủ', async () => {
    await renderPage()
    fireEvent.change(searchBox(), { target: { value: 'tạm ngưng' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'false' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))

    expect(await screen.findByText('Quy tắc 1')).toBeInTheDocument()
    expect(searchBox()).toHaveValue('')
    expect(screen.getByTestId('filters')).toHaveAttribute('data-active', '0')
  })

  it('nút Áp dụng không làm đổi kết quả', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByText('Quy tắc 1')).toBeInTheDocument()
  })
})

describe('ClassificationRuleListPage - tạm ngưng quy tắc', () => {
  it('hỏi xác nhận rồi tạm ngưng và tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Tạm ngưng quy tắc Quy tắc 1'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Quy tắc 1/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạm ngưng quy tắc' }))

    await waitFor(() => expect(api.disableRule).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã tạm ngưng quy tắc phân loại.', 'success')
    await waitFor(() => expect(api.listRules).toHaveBeenCalledTimes(2))
  })

  it('không tạm ngưng khi người dùng huỷ', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Tạm ngưng quy tắc Quy tắc 1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hủy' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.disableRule).not.toHaveBeenCalled()
  })

  it('báo lỗi khi tạm ngưng thất bại', async () => {
    api.disableRule.mockRejectedValue({ response: { data: { message: 'Quy tắc đang được dùng' } } })
    await renderPage()
    fireEvent.click(screen.getByLabelText('Tạm ngưng quy tắc Quy tắc 1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Tạm ngưng quy tắc' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Quy tắc đang được dùng', 'error'))
    expect(api.listRules).toHaveBeenCalledTimes(1)
  })

  it('khoá nút tạm ngưng với quy tắc đã tạm ngưng', async () => {
    await renderPage()
    expect(screen.getByLabelText('Tạm ngưng quy tắc Quy tắc tạm ngưng')).toBeDisabled()
  })
})
