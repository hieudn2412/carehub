import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScoringFormulaPage from './ScoringFormulaPage.jsx'

const showToast = vi.fn()
const api = vi.hoisted(() => ({
  getFormScoringConfigurations: vi.fn(),
  updateFormScoringConfiguration: vi.fn(),
  retryFormScoringRecalculationJob: vi.fn(),
}))

vi.mock('../api/adminApi.js', () => ({ adminApi: api }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({
  default: ({ isOpen, title, message, confirmText, onConfirm, onCancel }) => isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button onClick={onCancel}>Không tính lại</button>
      <button onClick={onConfirm}>{confirmText}</button>
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

const row = (overrides = {}) => ({
  formId: 7, versionId: 20, versionNumber: 2, versionStatus: 'PUBLISHED',
  formTitle: 'Rửa tay ngoại khoa', formCode: 'RUA_TAY',
  criticalWeightPercent: 60, normalWeightPercent: 40,
  passingScore: 7.5, passingScoreMode: 'DEFAULT', passingScoreOverride: null,
  submittedCount: 12, canEditCriticalWeight: false, lockVersion: 3,
  latestJob: null, ...overrides,
})

const listResponse = (content, overrides = {}) => ({
  data: { data: { content, totalPages: 1, totalElements: content.length, ...overrides } },
})

beforeEach(() => {
  vi.clearAllMocks()
  api.getFormScoringConfigurations.mockResolvedValue(listResponse([row()]))
  api.updateFormScoringConfiguration.mockResolvedValue({ data: { data: { recalculationScheduled: false } } })
  api.retryFormScoringRecalculationJob.mockResolvedValue({ data: { success: true } })
})

afterEach(() => vi.useRealTimers())

const renderPage = async (rows) => {
  if (rows) api.getFormScoringConfigurations.mockResolvedValue(listResponse(rows))
  render(<ScoringFormulaPage />)
  await screen.findByText('Rửa tay ngoại khoa')
}
const openEditor = () => fireEvent.click(screen.getByLabelText('Chỉnh công thức Rửa tay ngoại khoa phiên bản 2'))
const save = () => fireEvent.click(screen.getByRole('button', { name: /Lưu cấu hình/ }))

describe('ScoringFormulaPage - danh sách cấu hình', () => {
  it('tải và hiển thị đầy đủ cột', async () => {
    render(<ScoringFormulaPage />)
    expect(screen.getByText(/Đang tải công thức/)).toBeInTheDocument()

    await screen.findByText('Rửa tay ngoại khoa')
    expect(api.getFormScoringConfigurations).toHaveBeenCalledWith({
      keyword: undefined, status: undefined, page: 0, size: 20, sort: 'updatedAt,desc',
    })
    expect(screen.getByText('RUA_TAY')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('7.5/10')).toBeInTheDocument()
    expect(screen.getByText('Công thức mặc định')).toBeInTheDocument()
    expect(screen.getByText('Chưa phát sinh')).toBeInTheDocument()
    expect(screen.getByText('1 phiên bản')).toBeInTheDocument()
  })

  it.each([
    ['DRAFT', 'Bản nháp'],
    ['RETIRED', 'Đã retired'],
    [null, 'Bản nháp'],
  ])('hiển thị nhãn trạng thái %s', async (versionStatus, label) => {
    await renderPage([row({ versionStatus })])
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('hiện Chưa tính được khi điểm sàn không phải số', async () => {
    // Number(null) là 0 nên chỉ chuỗi không parse được mới rơi vào nhánh này.
    await renderPage([row({ passingScore: 'chưa có' })])
    expect(screen.getByText('Chưa tính được/10')).toBeInTheDocument()
  })

  it('hiện nhãn Tùy chỉnh cho phiên bản có điểm sàn riêng', async () => {
    await renderPage([row({ passingScoreMode: 'CUSTOM' })])
    expect(screen.getByText('Tùy chỉnh')).toBeInTheDocument()
  })

  it.each([
    ['PENDING', 'Đang chờ'],
    ['RUNNING', 'Đang tính lại'],
    ['COMPLETED', 'Đã đồng bộ'],
    ['FAILED', 'Tính lại thất bại'],
  ])('hiển thị nhãn tác vụ %s', async (status, label) => {
    await renderPage([row({ latestJob: { id: 99, status } })])
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('hiện thông báo rỗng khi không có phiên bản phù hợp', async () => {
    api.getFormScoringConfigurations.mockResolvedValue(listResponse([]))
    render(<ScoringFormulaPage />)
    expect(await screen.findByText('Không có phiên bản phù hợp')).toBeInTheDocument()
  })

  it('chịu được phản hồi thiếu mảng content', async () => {
    api.getFormScoringConfigurations.mockResolvedValue({ data: { data: null } })
    render(<ScoringFormulaPage />)
    expect(await screen.findByText('Không có phiên bản phù hợp')).toBeInTheDocument()
  })

  it('hiện lỗi khi tải danh sách thất bại', async () => {
    api.getFormScoringConfigurations.mockRejectedValue({ response: { data: { message: 'Không có quyền' } } })
    render(<ScoringFormulaPage />)
    expect(await screen.findByText(/Không có quyền/)).toBeInTheDocument()
  })

  it('dùng thông báo mặc định khi lỗi không có nội dung', async () => {
    api.getFormScoringConfigurations.mockRejectedValue(new Error('down'))
    render(<ScoringFormulaPage />)
    expect(await screen.findByText(/Không thể tải cấu hình công thức chỉ số/)).toBeInTheDocument()
  })

  it('tải lại dữ liệu bằng nút refresh', async () => {
    await renderPage()
    fireEvent.click(screen.getByLabelText('Tải lại dữ liệu'))
    await waitFor(() => expect(api.getFormScoringConfigurations).toHaveBeenCalledTimes(2))
  })

  it('tự làm mới mỗi 3 giây khi có tác vụ đang chạy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getFormScoringConfigurations.mockResolvedValue(listResponse([row({ latestJob: { id: 99, status: 'RUNNING' } })]))
    render(<ScoringFormulaPage />)
    await screen.findByText('Rửa tay ngoại khoa')

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(api.getFormScoringConfigurations).toHaveBeenCalledTimes(2)
  })

  it('không tự làm mới khi không còn tác vụ chạy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<ScoringFormulaPage />)
    await screen.findByText('Rửa tay ngoại khoa')

    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(api.getFormScoringConfigurations).toHaveBeenCalledTimes(1)
  })

  it('khoá nút chỉnh công thức khi tác vụ đang chạy', async () => {
    await renderPage([row({ latestJob: { id: 99, status: 'PENDING' } })])
    expect(screen.getByLabelText('Chỉnh công thức Rửa tay ngoại khoa phiên bản 2')).toBeDisabled()
  })
})

describe('ScoringFormulaPage - chạy lại tác vụ lỗi', () => {
  it('chạy lại tác vụ thất bại', async () => {
    await renderPage([row({ latestJob: { id: 99, status: 'FAILED' } })])
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    await waitFor(() => expect(api.retryFormScoringRecalculationJob).toHaveBeenCalledWith(99))
    expect(showToast).toHaveBeenCalledWith('Đã đưa tác vụ tính lại vào hàng chờ.', 'success')
    await waitFor(() => expect(api.getFormScoringConfigurations).toHaveBeenCalledTimes(2))
  })

  it('báo lỗi khi chạy lại thất bại', async () => {
    api.retryFormScoringRecalculationJob.mockRejectedValue({ response: { data: { message: 'Hàng chờ đầy' } } })
    await renderPage([row({ latestJob: { id: 99, status: 'FAILED' } })])
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Hàng chờ đầy', 'error'))
  })

  it('dùng thông báo mặc định khi lỗi chạy lại không có nội dung', async () => {
    api.retryFormScoringRecalculationJob.mockRejectedValue(new Error('down'))
    await renderPage([row({ latestJob: { id: 99, status: 'FAILED' } })])
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Không thể chạy lại tác vụ.', 'error'))
  })

  it('chỉ hiện nút thử lại cho tác vụ thất bại', async () => {
    await renderPage([row({ latestJob: { id: 99, status: 'COMPLETED' } })])
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument()
  })
})

describe('ScoringFormulaPage - bộ lọc và phân trang', () => {
  it('áp dụng từ khoá và trạng thái', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Tìm quy trình hoặc phiên bản'), { target: { value: '  rửa tay  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PUBLISHED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => expect(api.getFormScoringConfigurations).toHaveBeenLastCalledWith(expect.objectContaining({
      keyword: 'rửa tay', status: 'PUBLISHED', page: 0,
    })))
    expect(screen.getByTestId('active-count')).toHaveTextContent('2')
  })

  it('xoá bộ lọc trả mọi tham số về mặc định', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Tìm quy trình hoặc phiên bản'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Bộ lọc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('1'))

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(screen.getByTestId('active-count')).toHaveTextContent('0'))
  })

  it('chuyển trang tiến và lùi', async () => {
    api.getFormScoringConfigurations.mockResolvedValue(listResponse([row()], { totalPages: 3, totalElements: 45 }))
    await renderPage()

    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(api.getFormScoringConfigurations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))

    fireEvent.click(screen.getByRole('button', { name: 'Trước' }))
    await waitFor(() => expect(api.getFormScoringConfigurations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 })))
  })

  it('hiện ít nhất một trang khi backend trả về 0 trang', async () => {
    api.getFormScoringConfigurations.mockResolvedValue(listResponse([row()], { totalPages: 0 }))
    await renderPage()
    expect(screen.getByText('Trang 1 / 1')).toBeInTheDocument()
  })
})

describe('ScoringFormulaPage - chỉnh công thức', () => {
  it('mở hộp thoại với dữ liệu hiện tại và khoá tỷ trọng của bản đã công bố', async () => {
    await renderPage()
    openEditor()

    const dialog = screen.getByRole('dialog', { name: /Rửa tay ngoại khoa · v2/ })
    expect(within(dialog).getByRole('spinbutton')).toBeDisabled()
    expect(within(dialog).getByText(/Tỷ trọng được khóa sau khi version được công bố/)).toBeInTheDocument()
    expect(within(dialog).getByText('7.5/10')).toBeInTheDocument()
    expect(within(dialog).getByText(/12 kết quả sẽ được tính lại/)).toBeInTheDocument()
  })

  it('cho sửa tỷ trọng với bản nháp và cập nhật phần còn lại', async () => {
    await renderPage([row({ versionStatus: 'DRAFT', canEditCriticalWeight: true })])
    openEditor()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '70' } })

    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.queryByText(/kết quả sẽ được tính lại/)).not.toBeInTheDocument()
  })

  it('chặn tỷ trọng ngoài khoảng 0-100 hoặc không nguyên', async () => {
    await renderPage([row({ versionStatus: 'DRAFT', canEditCriticalWeight: true })])
    openEditor()

    for (const invalid of ['150', '-5', '60.5']) {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: invalid } })
      save()
      expect(await screen.findByText(/Tỷ trọng câu trọng yếu phải là số nguyên từ 0 đến 100/)).toBeInTheDocument()
      expect(api.updateFormScoringConfiguration).not.toHaveBeenCalled()
    }
  })

  it('chặn điểm sàn tuỳ chỉnh không hợp lệ', async () => {
    await renderPage([row({ versionStatus: 'DRAFT' })])
    openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh' }))

    for (const invalid of ['11', '-1', '7.55']) {
      fireEvent.change(screen.getAllByRole('spinbutton').at(-1), { target: { value: invalid } })
      save()
      expect(await screen.findByText(/Điểm sàn phải từ 0 đến 10/)).toBeInTheDocument()
      expect(api.updateFormScoringConfiguration).not.toHaveBeenCalled()
    }
  })

  it('lưu ngay với bản nháp mà không hỏi xác nhận', async () => {
    await renderPage([row({ versionStatus: 'DRAFT', canEditCriticalWeight: true })])
    openEditor()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '70' } })
    save()

    await waitFor(() => expect(api.updateFormScoringConfiguration).toHaveBeenCalledWith(7, 20, {
      criticalWeightPercent: 70,
      passingScore: { mode: 'DEFAULT', value: null },
      lockVersion: 3,
    }))
    expect(showToast).toHaveBeenCalledWith('Đã cập nhật công thức tính điểm.', 'success')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('hỏi xác nhận trước khi lưu bản đã công bố', async () => {
    await renderPage()
    openEditor()
    save()

    const confirm = screen.getByRole('dialog', { name: 'Tính lại kết quả của phiên bản?' })
    expect(within(confirm).getByText(/12 bài đã nộp/)).toBeInTheDocument()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Tạo tác vụ' }))

    await waitFor(() => expect(api.updateFormScoringConfiguration).toHaveBeenCalledWith(7, 20, {
      passingScore: { mode: 'DEFAULT', value: null }, lockVersion: 3,
    }))
  })

  it('huỷ xác nhận thì không gọi API', async () => {
    await renderPage()
    openEditor()
    save()
    fireEvent.click(screen.getByRole('button', { name: 'Không tính lại' }))

    expect(api.updateFormScoringConfiguration).not.toHaveBeenCalled()
  })

  it('gửi điểm sàn tuỳ chỉnh và báo tác vụ tính lại', async () => {
    api.updateFormScoringConfiguration.mockResolvedValue({ data: { data: { recalculationScheduled: true } } })
    await renderPage([row({ versionStatus: 'DRAFT' })])
    openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh' }))
    fireEvent.change(screen.getAllByRole('spinbutton').at(-1), { target: { value: '8.5' } })
    save()

    await waitFor(() => expect(api.updateFormScoringConfiguration).toHaveBeenCalledWith(7, 20, expect.objectContaining({
      passingScore: { mode: 'CUSTOM', value: 8.5 },
    })))
    expect(showToast).toHaveBeenCalledWith('Đã tạo tác vụ tính lại kết quả.', 'success')
  })

  it('nạp sẵn điểm sàn tuỳ chỉnh đã lưu', async () => {
    await renderPage([row({ versionStatus: 'DRAFT', passingScoreMode: 'CUSTOM', passingScoreOverride: 6.5 })])
    openEditor()
    expect(screen.getAllByRole('spinbutton').at(-1)).toHaveValue(6.5)
  })

  it('quay lại chế độ mặc định', async () => {
    await renderPage([row({ versionStatus: 'DRAFT', passingScoreMode: 'CUSTOM', passingScoreOverride: 6.5 })])
    openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Công thức mặc định' }))

    expect(screen.getByText('Điểm sàn hiện tại theo công thức cũ')).toBeInTheDocument()
  })

  it('hiện lỗi khi lưu thất bại', async () => {
    api.updateFormScoringConfiguration.mockRejectedValue({ response: { data: { message: 'Phiên bản đã đổi' } } })
    await renderPage([row({ versionStatus: 'DRAFT' })])
    openEditor()
    save()

    expect(await screen.findByText(/Phiên bản đã đổi/)).toBeInTheDocument()
  })

  it('dùng thông báo mặc định khi lỗi lưu không có nội dung', async () => {
    api.updateFormScoringConfiguration.mockRejectedValue(new Error('down'))
    await renderPage([row({ versionStatus: 'DRAFT' })])
    openEditor()
    save()

    expect(await screen.findByText(/Không thể cập nhật công thức tính điểm/)).toBeInTheDocument()
  })

  it('đóng hộp thoại bằng nút Hủy và click nền', async () => {
    await renderPage()

    openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    openEditor()
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('không đóng khi bấm vào bên trong hộp thoại', async () => {
    await renderPage()
    openEditor()
    fireEvent.mouseDown(screen.getByRole('dialog', { name: /Rửa tay ngoại khoa/ }))
    expect(screen.getByRole('dialog', { name: /Rửa tay ngoại khoa/ })).toBeInTheDocument()
  })

  it('khoá thao tác trong lúc đang lưu', async () => {
    let resolveSave
    api.updateFormScoringConfiguration.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    await renderPage([row({ versionStatus: 'DRAFT' })])
    openEditor()
    save()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled())
    fireEvent.mouseDown(screen.getByRole('presentation'))
    expect(screen.getByRole('dialog', { name: /Rửa tay ngoại khoa/ })).toBeInTheDocument()

    await act(async () => { resolveSave({ data: { data: {} } }) })
  })
})
