import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImportModal from './ImportModal.jsx'

const api = vi.hoisted(() => ({ importUsers: vi.fn() }))

vi.mock('../api/adminApi.js', () => ({ adminApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children, back }) => (
    <main>
      <a href={back.to}>{back.label}</a>
      {children}
    </main>
  ),
}))

const xlsxFile = (name = 'nhan-vien.xlsx') => new File(['noi dung'], name, {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

const result = (overrides = {}) => ({
  totalRows: 10,
  insertedUsers: 6,
  updatedUsers: 3,
  failedRows: 1,
  newDepartments: 0,
  newPositions: 0,
  newEducationLevels: 0,
  rowResults: [
    { rowNumber: 2, employeeCode: 'NV001', status: 'SUCCESS', message: 'OK' },
    { rowNumber: 5, employeeCode: 'NV005', status: 'FAILED', message: 'Thiếu ngày sinh' },
  ],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api.importUsers.mockResolvedValue({ data: { success: true, data: result() } })
})

afterEach(() => { console.error.mockRestore?.() })

const dropzone = () => document.querySelector('.im-dropzone')
const fileInput = () => document.querySelector('input[type="file"]')
const importButton = () => screen.getByRole('button', { name: /import/i })
const chooseFile = (file = xlsxFile()) => fireEvent.change(fileInput(), { target: { files: [file] } })

describe('ImportModal - trạng thái ban đầu', () => {
  it('hiển thị hướng dẫn và chưa có kết quả', () => {
    render(<ImportModal />)

    expect(screen.getByRole('heading', { name: 'Import dữ liệu nhân viên' })).toBeInTheDocument()
    expect(screen.getByText(/Kéo & thả hoặc click/)).toBeInTheDocument()
    expect(screen.getByText('Chưa có kết quả import nào trong phiên làm việc hiện tại.')).toBeInTheDocument()
    expect(screen.getAllByText('–')).toHaveLength(4)
    expect(importButton()).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/admin/reference/employees')
  })
})

describe('ImportModal - chọn tệp', () => {
  it('chọn tệp bằng hộp thoại và hiển thị tên tệp', () => {
    render(<ImportModal />)
    chooseFile()

    expect(screen.getByText('nhan-vien.xlsx')).toBeInTheDocument()
    expect(importButton()).toBeEnabled()
  })

  it('bỏ qua khi hộp thoại không trả về tệp nào', () => {
    render(<ImportModal />)
    fireEvent.change(fileInput(), { target: { files: [] } })

    expect(screen.getByText(/Kéo & thả hoặc click/)).toBeInTheDocument()
  })

  it('mở hộp thoại khi bấm vào vùng thả tệp', () => {
    render(<ImportModal />)
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => {})

    fireEvent.click(dropzone())
    expect(click).toHaveBeenCalled()
  })

  it('nhận tệp khi kéo thả', () => {
    render(<ImportModal />)

    fireEvent.dragOver(dropzone())
    expect(dropzone().className).toContain('dragging')

    fireEvent.dragLeave(dropzone())
    expect(dropzone().className).not.toContain('dragging')

    fireEvent.drop(dropzone(), { dataTransfer: { files: [xlsxFile('keo-tha.xlsx')] } })
    expect(screen.getByText('keo-tha.xlsx')).toBeInTheDocument()
    expect(dropzone().className).toContain('has-file')
  })

  it('bỏ qua khi thả mà không có tệp', () => {
    render(<ImportModal />)
    fireEvent.drop(dropzone(), { dataTransfer: { files: [] } })

    expect(screen.getByText(/Kéo & thả hoặc click/)).toBeInTheDocument()
  })

  it('khoá vùng thả tệp trong lúc đang import', async () => {
    api.importUsers.mockReturnValue(new Promise(() => {}))
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    await screen.findByText('Đang xử lý...')
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => {})
    fireEvent.click(dropzone())
    fireEvent.dragOver(dropzone())

    expect(click).not.toHaveBeenCalled()
    expect(dropzone().className).not.toContain('dragging')
  })
})

describe('ImportModal - tải template', () => {
  it('tạo và tải tệp template CSV', () => {
    render(<ImportModal />)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture() {
      expect(this.getAttribute('download')).toBe('carehub_employee_template.csv')
      expect(this.getAttribute('href')).toContain('data:text/csv')
    })

    fireEvent.click(screen.getByRole('button', { name: /Tải template xuống/ }))

    expect(click).toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
})

describe('ImportModal - thực hiện import', () => {
  it('import thành công và hiển thị thống kê', async () => {
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(screen.getByText('Đang xử lý...')).toBeInTheDocument()
    await waitFor(() => expect(api.importUsers).toHaveBeenCalledWith(expect.any(File)))

    expect(await screen.findByText('Nhập dữ liệu thành công! Đã xử lý 10 hàng.')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    // tệp được xoá sau khi import xong
    expect(screen.getByText(/Kéo & thả hoặc click/)).toBeInTheDocument()
    expect(importButton()).toBeDisabled()
  })

  it('hiện bảng các hàng lỗi', async () => {
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    const table = await screen.findByRole('table')
    expect(within(table).getByText('5')).toBeInTheDocument()
    expect(within(table).getByText('NV005')).toBeInTheDocument()
    expect(within(table).getByText('Thiếu ngày sinh')).toBeInTheDocument()
    expect(within(table).queryByText('NV001')).not.toBeInTheDocument()
  })

  it('hiện gạch ngang khi hàng lỗi thiếu mã nhân viên', async () => {
    api.importUsers.mockResolvedValue({
      data: { success: true, data: result({ rowResults: [{ rowNumber: 4, employeeCode: null, status: 'FAILED', message: 'Sai định dạng' }] }) },
    })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    const table = await screen.findByRole('table')
    expect(within(table).getByText('–')).toBeInTheDocument()
  })

  it('chúc mừng khi không có hàng lỗi nào', async () => {
    api.importUsers.mockResolvedValue({ data: { success: true, data: result({ failedRows: 0, rowResults: [] }) } })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Chúc mừng! Không có lỗi nào xảy ra trong đợt import này.')).toBeInTheDocument()
  })

  it('chịu được kết quả không có danh sách hàng', async () => {
    api.importUsers.mockResolvedValue({ data: { success: true, data: result({ rowResults: null }) } })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Chúc mừng! Không có lỗi nào xảy ra trong đợt import này.')).toBeInTheDocument()
  })

  it('hiện thống kê dữ liệu tham chiếu mới tạo', async () => {
    api.importUsers.mockResolvedValue({
      data: { success: true, data: result({ newDepartments: 2, newPositions: 0, newEducationLevels: 1 }) },
    })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Phòng ban mới tạo')).toBeInTheDocument()
    expect(screen.getByText('Chức danh mới tạo')).toBeInTheDocument()
    expect(screen.getByText('Trình độ mới tạo')).toBeInTheDocument()
  })

  it('ẩn thống kê tham chiếu khi không tạo mới gì', async () => {
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    await screen.findByRole('table')
    expect(screen.queryByText('Phòng ban mới tạo')).not.toBeInTheDocument()
  })

  it('hiện lỗi khi máy chủ trả về không thành công', async () => {
    api.importUsers.mockResolvedValue({ data: { success: false, message: 'Tệp không đúng định dạng' } })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Tệp không đúng định dạng')).toBeInTheDocument()
    expect(screen.getByText('nhan-vien.xlsx')).toBeInTheDocument()
  })

  it('hiện lỗi mặc định khi phản hồi không có thông báo', async () => {
    api.importUsers.mockResolvedValue({ data: null })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Nhập dữ liệu không thành công.')).toBeInTheDocument()
  })

  it('hiện lỗi từ máy chủ khi request thất bại', async () => {
    api.importUsers.mockRejectedValue({ response: { data: { message: 'Tệp vượt quá 10MB' } } })
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Tệp vượt quá 10MB')).toBeInTheDocument()
    expect(console.error).toHaveBeenCalled()
  })

  it('hiện lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.importUsers.mockRejectedValue(new Error('down'))
    render(<ImportModal />)
    chooseFile()
    fireEvent.click(importButton())

    expect(await screen.findByText('Lỗi máy chủ hoặc kết nối mạng không thành công.')).toBeInTheDocument()
  })
})
