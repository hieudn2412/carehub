import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuestionCategoryListPage from './QuestionCategoryListPage.jsx'

const showToast = vi.fn()
const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
}))

vi.mock('../api/questionCategoryApi.js', () => ({ questionCategoryApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onConfirm}>{confirmLabel}</button>
      <button onClick={onCancel}>{cancelLabel}</button>
    </div>
  ) : null,
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
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ value, onChange, options, disabled }) => (
    <select aria-label="Trạng thái danh mục" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))
vi.mock('../../../shared/components/AppliedFilterToolbar.jsx', () => ({
  default: ({ actions, children, isOpen, onApply, onReset, onSearchChange, onToggle, searchAriaLabel, searchValue }) => (
    <section>
      <input aria-label={searchAriaLabel} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} />
      <button onClick={onToggle}>Bộ lọc</button>
      {isOpen && (
        <div data-testid="filter-panel">
          {children}
          <button onClick={onApply}>Áp dụng</button>
          <button onClick={onReset}>Xóa bộ lọc</button>
        </div>
      )}
      <div>{actions}</div>
    </section>
  ),
}))

const activeCategory = {
  id: 1,
  code: 'DM-01',
  name: 'Kiểm soát nhiễm khuẩn',
  description: 'Quy trình vô khuẩn cơ bản',
  status: 'ACTIVE',
  questionCount: 42,
}
const inactiveCategory = {
  id: 2,
  code: 'DM-02',
  name: 'Chăm sóc người bệnh',
  description: null,
  status: 'INACTIVE',
  statusText: 'Tạm ngưng',
  questionCount: null,
}

const listResponse = (content) => ({ data: { data: content } })

beforeEach(() => {
  vi.clearAllMocks()
  api.listCategories.mockResolvedValue(listResponse([activeCategory, inactiveCategory]))
  api.createCategory.mockResolvedValue({ data: { success: true } })
  api.updateCategory.mockResolvedValue({ data: { success: true } })
  api.archiveCategory.mockResolvedValue({ data: { success: true } })
})

const renderPage = async () => {
  render(<QuestionCategoryListPage />)
  await screen.findByText('Kiểm soát nhiễm khuẩn')
}

const openCreateModal = () => fireEvent.click(screen.getByRole('button', { name: /Thêm danh mục/i }))
const modal = () => screen.getByRole('dialog', { name: /danh mục câu hỏi/i })

describe('QuestionCategoryListPage - hiển thị danh sách', () => {
  it('tải danh mục và hiển thị số câu hỏi, nhãn trạng thái', async () => {
    render(<QuestionCategoryListPage />)
    expect(screen.getByText('Đang tải danh mục câu hỏi...')).toBeInTheDocument()

    await screen.findByText('Kiểm soát nhiễm khuẩn')
    expect(api.listCategories).toHaveBeenCalledWith({ status: '' })
    expect(screen.getByText('42')).toBeInTheDocument()
    // questionCount null phải rơi về 0 thay vì render rỗng
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Hoạt động')).toBeInTheDocument()
    // statusText từ máy chủ được ưu tiên hơn nhãn suy ra từ status
    expect(screen.getByText('Tạm ngưng')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 2 trong tổng số 2 kết quả')).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi máy chủ trả về danh sách trống', async () => {
    api.listCategories.mockResolvedValue(listResponse([]))
    render(<QuestionCategoryListPage />)
    expect(await screen.findByText('Không tìm thấy danh mục câu hỏi nào.')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 0 trong tổng số 0 kết quả')).toBeInTheDocument()
  })

  it('báo lỗi qua toast khi tải danh sách thất bại', async () => {
    api.listCategories.mockRejectedValue({ response: { data: { message: 'Không có quyền truy cập' } } })
    render(<QuestionCategoryListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không có quyền truy cập', 'error'))
    expect(screen.getByText('Không tìm thấy danh mục câu hỏi nào.')).toBeInTheDocument()
  })

  it('dùng thông báo lỗi mặc định khi máy chủ không trả về message', async () => {
    api.listCategories.mockRejectedValue(new Error('network down'))
    render(<QuestionCategoryListPage />)
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Có lỗi xảy ra, vui lòng thử lại.', 'error'))
  })
})

describe('QuestionCategoryListPage - tìm kiếm và lọc', () => {
  it('lọc theo từ khoá sau khi hết debounce, khớp cả tên, mã và mô tả', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<QuestionCategoryListPage />)
      await screen.findByText('Kiểm soát nhiễm khuẩn')
      const search = screen.getByLabelText('Tìm danh mục câu hỏi')

      fireEvent.change(search, { target: { value: 'nhiễm khuẩn' } })
      // trước khi debounce chạy, danh sách vẫn nguyên vẹn
      expect(screen.getByText('Chăm sóc người bệnh')).toBeInTheDocument()
      act(() => void vi.advanceTimersByTime(300))
      await waitFor(() => expect(screen.queryByText('Chăm sóc người bệnh')).not.toBeInTheDocument())
      expect(screen.getByText('Kiểm soát nhiễm khuẩn')).toBeInTheDocument()

      // khớp theo mã danh mục
      fireEvent.change(search, { target: { value: 'dm-02' } })
      act(() => void vi.advanceTimersByTime(300))
      expect(await screen.findByText('Chăm sóc người bệnh')).toBeInTheDocument()
      expect(screen.queryByText('Kiểm soát nhiễm khuẩn')).not.toBeInTheDocument()

      // khớp theo mô tả
      fireEvent.change(search, { target: { value: 'vô khuẩn cơ bản' } })
      act(() => void vi.advanceTimersByTime(300))
      expect(await screen.findByText('Kiểm soát nhiễm khuẩn')).toBeInTheDocument()

      fireEvent.change(search, { target: { value: 'không khớp gì cả' } })
      act(() => void vi.advanceTimersByTime(300))
      expect(await screen.findByText('Không tìm thấy danh mục câu hỏi nào.')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('áp dụng và xoá bộ lọc trạng thái', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(screen.queryByText('Chăm sóc người bệnh')).not.toBeInTheDocument())
    expect(screen.getByText('Kiểm soát nhiễm khuẩn')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(await screen.findByText('Chăm sóc người bệnh')).toBeInTheDocument()
    expect(screen.getByLabelText('Tìm danh mục câu hỏi')).toHaveValue('')
  })
})

describe('QuestionCategoryListPage - phân trang', () => {
  const manyCategories = Array.from({ length: 63 }, (_, index) => ({
    id: index + 1,
    code: `DM-${index + 1}`,
    name: `Danh mục ${index + 1}`,
    description: '',
    status: 'ACTIVE',
    questionCount: index,
  }))

  it('chỉ hiển thị 10 dòng mỗi trang và chuyển trang được', async () => {
    api.listCategories.mockResolvedValue(listResponse(manyCategories))
    render(<QuestionCategoryListPage />)
    await screen.findByText('Danh mục 1')

    expect(screen.getByText('Hiển thị 10 trong tổng số 63 kết quả')).toBeInTheDocument()
    expect(screen.queryByText('Danh mục 11')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '>' }))
    expect(await screen.findByText('Danh mục 11')).toBeInTheDocument()
    expect(screen.queryByText('Danh mục 1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '<' }))
    expect(await screen.findByText('Danh mục 1')).toBeInTheDocument()
  })

  it('vô hiệu hoá nút lùi ở trang đầu và nút tiến ở trang cuối', async () => {
    api.listCategories.mockResolvedValue(listResponse(manyCategories))
    render(<QuestionCategoryListPage />)
    await screen.findByText('Danh mục 1')

    expect(screen.getByRole('button', { name: '<' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    expect(await screen.findByText('Danh mục 61')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '>' })).toBeDisabled()
    expect(screen.getByText('Hiển thị 3 trong tổng số 63 kết quả')).toBeInTheDocument()
  })

  it('rút gọn dải số trang bằng dấu ba chấm khi ở giữa', async () => {
    api.listCategories.mockResolvedValue(listResponse(manyCategories))
    render(<QuestionCategoryListPage />)
    await screen.findByText('Danh mục 1')

    // trang 1: không có ellipsis đầu, có ellipsis cuối + nút nhảy tới trang cuối
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(await screen.findByText('Danh mục 31')).toBeInTheDocument()
    // ở giữa dải, cả nút trang 1 lẫn trang cuối đều còn truy cập được
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
  })
})

describe('QuestionCategoryListPage - tạo danh mục', () => {
  it('gửi payload đã trim, đóng modal và tải lại danh sách', async () => {
    await renderPage()
    openCreateModal()
    expect(within(modal()).getByText('Tạo danh mục câu hỏi')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Tự sinh nếu bỏ trống'), { target: { value: '  DM-09  ' } })
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: '  An toàn người bệnh  ' } })
    fireEvent.change(screen.getByPlaceholderText('Mô tả danh mục kiến thức...'), { target: { value: '  Mô tả  ' } })
    fireEvent.change(screen.getByLabelText('Trạng thái danh mục'), { target: { value: 'INACTIVE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith({
      code: 'DM-09',
      name: 'An toàn người bệnh',
      description: 'Mô tả',
      status: 'INACTIVE',
    }))
    expect(showToast).toHaveBeenCalledWith('Đã tạo danh mục câu hỏi.', 'success')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /danh mục câu hỏi/i })).not.toBeInTheDocument())
    expect(api.listCategories).toHaveBeenCalledTimes(2)
  })

  it('gửi code null khi người dùng bỏ trống mã danh mục', async () => {
    await renderPage()
    openCreateModal()
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: 'Không mã' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith(expect.objectContaining({ code: null })))
  })

  it('chặn gửi khi tên chỉ gồm khoảng trắng', async () => {
    await renderPage()
    openCreateModal()
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Tên danh mục không được để trống.', 'warning'))
    expect(api.createCategory).not.toHaveBeenCalled()
    expect(modal()).toBeInTheDocument()
  })

  it('giữ modal mở và báo lỗi khi máy chủ từ chối', async () => {
    api.createCategory.mockRejectedValue({ response: { data: { message: 'Mã danh mục đã tồn tại' } } })
    await renderPage()
    openCreateModal()
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: 'Trùng mã' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Mã danh mục đã tồn tại', 'error'))
    expect(modal()).toBeInTheDocument()
    expect(api.listCategories).toHaveBeenCalledTimes(1)
  })

  it('khoá các nút trong lúc đang lưu', async () => {
    let resolveCreate
    api.createCategory.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
    await renderPage()
    openCreateModal()
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: 'Đang lưu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mới' }))

    expect(await screen.findByRole('button', { name: 'Đang lưu...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...')).toBeDisabled()
    await act(async () => { resolveCreate({ data: {} }) })
  })

  it('đóng modal bằng nút X, nút Hủy và click ra nền', async () => {
    await renderPage()

    openCreateModal()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại danh mục' }))
    expect(screen.queryByRole('dialog', { name: /danh mục câu hỏi/i })).not.toBeInTheDocument()

    openCreateModal()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByRole('dialog', { name: /danh mục câu hỏi/i })).not.toBeInTheDocument()

    openCreateModal()
    fireEvent.click(modal().parentElement)
    expect(screen.queryByRole('dialog', { name: /danh mục câu hỏi/i })).not.toBeInTheDocument()
  })

  it('không đóng modal khi click vào bên trong hộp thoại', async () => {
    await renderPage()
    openCreateModal()
    fireEvent.click(modal())
    expect(modal()).toBeInTheDocument()
  })

  it('xoá sạch dữ liệu đã nhập khi mở lại modal', async () => {
    await renderPage()
    openCreateModal()
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: 'Bản nháp bỏ dở' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))

    openCreateModal()
    expect(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...')).toHaveValue('')
  })
})

describe('QuestionCategoryListPage - cập nhật danh mục', () => {
  it('nạp sẵn dữ liệu dòng và khoá ô mã danh mục', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Chỉnh sửa danh mục')[0])

    expect(within(modal()).getByText('Cập nhật danh mục câu hỏi')).toBeInTheDocument()
    const codeInput = screen.getByPlaceholderText('Tự sinh nếu bỏ trống')
    expect(codeInput).toHaveValue('DM-01')
    expect(codeInput).toBeDisabled()
    expect(codeInput).toHaveAttribute('title', 'Mã danh mục là định danh ổn định và không thể thay đổi')
    expect(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...')).toHaveValue('Kiểm soát nhiễm khuẩn')
    expect(screen.getByPlaceholderText('Mô tả danh mục kiến thức...')).toHaveValue('Quy trình vô khuẩn cơ bản')
  })

  it('gửi id kèm payload rồi tải lại danh sách', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Chỉnh sửa danh mục')[0])
    fireEvent.change(screen.getByPlaceholderText('Nhập tên danh mục câu hỏi...'), { target: { value: 'Tên mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith(1, {
      code: 'DM-01',
      name: 'Tên mới',
      description: 'Quy trình vô khuẩn cơ bản',
      status: 'ACTIVE',
    }))
    expect(showToast).toHaveBeenCalledWith('Đã cập nhật danh mục câu hỏi.', 'success')
    expect(api.listCategories).toHaveBeenCalledTimes(2)
  })

  it('điền chuỗi rỗng cho mã và mô tả khi máy chủ trả về null', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Chỉnh sửa danh mục')[1])

    expect(screen.getByPlaceholderText('Mô tả danh mục kiến thức...')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith(2, expect.objectContaining({
      description: '',
      status: 'INACTIVE',
    })))
  })
})

describe('QuestionCategoryListPage - lưu trữ danh mục', () => {
  it('hỏi xác nhận kèm tên danh mục trước khi lưu trữ', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Lưu trữ danh mục')[0])

    const confirm = screen.getByRole('dialog', { name: 'Xác nhận lưu trữ danh mục' })
    expect(within(confirm).getByText(/"Kiểm soát nhiễm khuẩn"/)).toBeInTheDocument()

    fireEvent.click(within(confirm).getByRole('button', { name: 'Lưu trữ' }))
    await waitFor(() => expect(api.archiveCategory).toHaveBeenCalledWith(1))
    expect(showToast).toHaveBeenCalledWith('Đã lưu trữ danh mục câu hỏi.', 'success')
    await waitFor(() => expect(api.listCategories).toHaveBeenCalledTimes(2))
  })

  it('không gọi API khi người dùng bấm Hủy', async () => {
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Lưu trữ danh mục')[0])
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Xác nhận lưu trữ danh mục' })).getByRole('button', { name: 'Hủy' }))

    expect(screen.queryByRole('dialog', { name: 'Xác nhận lưu trữ danh mục' })).not.toBeInTheDocument()
    expect(api.archiveCategory).not.toHaveBeenCalled()
  })

  it('báo lỗi và không tải lại danh sách khi lưu trữ thất bại', async () => {
    api.archiveCategory.mockRejectedValue({ response: { data: { message: 'Danh mục đang được sử dụng' } } })
    await renderPage()
    fireEvent.click(screen.getAllByTitle('Lưu trữ danh mục')[0])
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Xác nhận lưu trữ danh mục' })).getByRole('button', { name: 'Lưu trữ' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Danh mục đang được sử dụng', 'error'))
    expect(api.listCategories).toHaveBeenCalledTimes(1)
  })
})
