import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingLegacyImportPage from './TrainingLegacyImportPage.jsx'

const api = vi.hoisted(() => ({
  getRecordOptions: vi.fn(),
  listLegacyImportBatches: vi.fn(),
  previewLegacyImport: vi.fn(),
  applyLegacyImport: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}))
vi.mock('../api/trainingApi.js', () => ({ trainingApi: api }))
vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <main>{children}</main> }))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({
  default: ({ label, value, onChange, options }) => (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  ),
}))
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({
  default: ({ ariaLabel, value, onChange, options }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const row = (id, overrides = {}) => ({
  id,
  sourceRowNumber: id + 1,
  validationStatus: 'VALID',
  normalizedData: {
    employeeCode: `NV00${id}`, employeeName: `Nhân viên ${id}`, title: `Khoá học ${id}`,
    startDate: '2026-08-01', durationRawText: '8 giờ', durationValue: 8, durationUnit: 'HOUR',
    declaredHours: 8, legacyExternalUrl: 'https://drive/minh-chung',
  },
  rawData: {},
  errors: [],
  warnings: [],
  trainingRecordId: null,
  ...overrides,
})

const batchPayload = (overrides = {}) => ({
  id: 90, totalRows: 3, successRows: 1, warningRows: 1, failedRows: 1, status: 'PREVIEW',
  rows: [
    row(1),
    row(2, { validationStatus: 'WARNING', warnings: ['Trùng hồ sơ đã có'], trainingRecordId: 500 }),
    row(3, {
      validationStatus: 'FAILED', errors: ['Không tìm thấy nhân viên'],
      normalizedData: null, rawData: { employeeCode: 'NV999', title: 'Khoá thô', trainingDate: '2026-07-01', duration: '4h' },
    }),
  ],
  ...overrides,
})

const makeFile = () => new File(['x'], 'du-lieu-cu.xlsx')

beforeEach(() => {
  vi.clearAllMocks()
  api.getRecordOptions.mockResolvedValue({
    data: { data: {
      activityTypes: [{ id: 1, name: 'Đào tạo trực tiếp' }, { id: 2, name: 'Hội thảo' }],
      professionalFields: [{ id: 9, name: 'Kiểm soát nhiễm khuẩn' }],
    } },
  })
  api.listLegacyImportBatches.mockResolvedValue({
    data: { data: { content: [
      { id: 80, originalFilename: 'lo-cu.xlsx', status: 'APPLIED', successRows: 10, warningRows: 2, failedRows: 1, importedAt: '2026-08-20T03:00:00Z' },
      { id: 81, originalFilename: 'lo-moi.xlsx', status: 'PREVIEW', successRows: 5, warningRows: 0, failedRows: 0, importedAt: null },
    ] } },
  })
  api.previewLegacyImport.mockResolvedValue({ data: { data: batchPayload() } })
  api.applyLegacyImport.mockResolvedValue({ data: { data: batchPayload({ status: 'APPLIED' }) } })
})

const renderPage = async () => {
  render(<TrainingLegacyImportPage />)
  await waitFor(() => expect(screen.queryByText('Loading import data...')).not.toBeInTheDocument())
}
const fileInput = () => document.querySelector('input[type="file"]')
const pickFile = () => fireEvent.change(fileInput(), { target: { files: [makeFile()] } })
const doPreview = () => fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
const runPreview = async () => {
  pickFile()
  doPreview()
  await screen.findByText('Preview complete')
}

describe('TrainingLegacyImportPage - khởi tạo', () => {
  it('nạp tuỳ chọn và danh sách lô import gần đây', async () => {
    render(<TrainingLegacyImportPage />)
    expect(screen.getByText('Loading import data...')).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByText('Loading import data...')).not.toBeInTheDocument())
    expect(api.getRecordOptions).toHaveBeenCalled()
    expect(api.listLegacyImportBatches).toHaveBeenCalledWith({ page: 0, size: 5 })
    expect(screen.getByRole('option', { name: 'Đào tạo trực tiếp' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Kiểm soát nhiễm khuẩn' })).toBeInTheDocument()
    expect(screen.getByText('lo-cu.xlsx')).toBeInTheDocument()
    expect(screen.getByText('10/2/1')).toBeInTheDocument()
  })

  it('chọn sẵn hình thức đào tạo đầu tiên', async () => {
    await renderPage()
    expect(screen.getByLabelText('Activity type')).toHaveValue('1')
  })

  it('hiện gạch ngang khi lô import chưa có thời điểm', async () => {
    await renderPage()
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('hiện thông báo khi chưa có lô import nào', async () => {
    api.listLegacyImportBatches.mockResolvedValue({ data: { data: { content: [] } } })
    await renderPage()
    expect(screen.getByText('Chưa có batch import.')).toBeInTheDocument()
  })

  it('chịu được phản hồi tuỳ chọn rỗng', async () => {
    api.getRecordOptions.mockResolvedValue({ data: { data: null } })
    api.listLegacyImportBatches.mockResolvedValue({ data: { data: null } })
    await renderPage()
    expect(screen.getByLabelText('Activity type')).toHaveValue('')
    expect(screen.getByText('Chưa có batch import.')).toBeInTheDocument()
  })

  it('hiện lỗi khi nạp dữ liệu import thất bại', async () => {
    api.getRecordOptions.mockRejectedValue({ response: { data: { message: 'Không có quyền import' } } })
    render(<TrainingLegacyImportPage />)
    expect(await screen.findByText('Không có quyền import')).toBeInTheDocument()
  })

  it('báo lỗi kết nối khi máy chủ không phản hồi', async () => {
    api.getRecordOptions.mockRejectedValue(new Error('down'))
    render(<TrainingLegacyImportPage />)
    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })

  it('hiện thông báo khi chưa preview lô nào', async () => {
    await renderPage()
    expect(screen.getByText('Chưa có batch preview.')).toBeInTheDocument()
  })
})

describe('TrainingLegacyImportPage - preview', () => {
  it('chặn preview khi chưa chọn file', async () => {
    await renderPage()
    doPreview()

    expect(screen.getByText('Chọn file Excel và activity type trước khi preview')).toBeInTheDocument()
    expect(api.previewLegacyImport).not.toHaveBeenCalled()
  })

  it('chặn preview khi chưa chọn hình thức đào tạo', async () => {
    await renderPage()
    pickFile()
    fireEvent.change(screen.getByLabelText('Activity type'), { target: { value: '' } })
    doPreview()

    expect(screen.getByText('Chọn file Excel và activity type trước khi preview')).toBeInTheDocument()
  })

  it('gửi file kèm hình thức và lĩnh vực đã chọn', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Activity type'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Tìm và chọn lĩnh vực chuyên môn'), { target: { value: '9' } })
    await runPreview()

    expect(api.previewLegacyImport).toHaveBeenCalledWith({
      file: expect.any(File), activityTypeId: '2', professionalFieldId: '9',
    })
  })

  it('hiển thị tổng hợp và bảng kết quả preview', async () => {
    await renderPage()
    await runPreview()

    expect(screen.getByText('Total: 3')).toBeInTheDocument()
    expect(screen.getByText('Success: 1')).toBeInTheDocument()
    expect(screen.getByText('Status: PREVIEW')).toBeInTheDocument()
    expect(screen.getByText('NV001')).toBeInTheDocument()
    expect(screen.getByText('Khoá học 1')).toBeInTheDocument()
    expect(screen.getAllByText('8 giờ').length).toBeGreaterThan(0)
    expect(screen.getByText(/Trùng hồ sơ đã có/)).toBeInTheDocument()
    expect(screen.getByText(/Không tìm thấy nhân viên/)).toBeInTheDocument()
  })

  it('rơi về dữ liệu thô khi thiếu dữ liệu chuẩn hoá', async () => {
    await renderPage()
    await runPreview()

    expect(screen.getByText('NV999')).toBeInTheDocument()
    expect(screen.getByText('Khoá thô')).toBeInTheDocument()
    expect(screen.getByText('2026-07-01')).toBeInTheDocument()
    expect(screen.getByText('4h')).toBeInTheDocument()
  })

  it('tạo liên kết tới hồ sơ đã import', async () => {
    await renderPage()
    await runPreview()
    expect(screen.getByRole('link', { name: '#500' })).toHaveAttribute('href', '/training/records/500')
  })

  it('hiện lỗi khi preview thất bại', async () => {
    api.previewLegacyImport.mockRejectedValue({ response: { data: { message: 'File sai định dạng' } } })
    await renderPage()
    pickFile()
    doPreview()

    expect(await screen.findByText('File sai định dạng')).toBeInTheDocument()
  })

  it('báo lỗi kết nối khi preview không có phản hồi', async () => {
    api.previewLegacyImport.mockRejectedValue(new Error('down'))
    await renderPage()
    pickFile()
    doPreview()

    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })

  it('khoá nút trong lúc đang preview', async () => {
    let resolvePreview
    api.previewLegacyImport.mockReturnValue(new Promise((resolve) => { resolvePreview = resolve }))
    await renderPage()
    pickFile()
    doPreview()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled())
    await act(async () => { resolvePreview({ data: { data: batchPayload() } }) })
  })

  it('bỏ chọn file khi người dùng huỷ hộp chọn tệp', async () => {
    await renderPage()
    pickFile()
    fireEvent.change(fileInput(), { target: { files: [] } })
    doPreview()

    expect(screen.getByText('Chọn file Excel và activity type trước khi preview')).toBeInTheDocument()
  })
})

describe('TrainingLegacyImportPage - áp dụng lô import', () => {
  it('khoá các nút apply khi chưa có lô preview', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: 'Apply Valid' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apply Selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apply All Warnings' })).toBeDisabled()
  })

  it('áp dụng các dòng hợp lệ', async () => {
    await renderPage()
    await runPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Apply Valid' }))

    await waitFor(() => expect(api.applyLegacyImport).toHaveBeenCalledWith(90, { commitWarnings: false, confirmedRowIds: [] }))
    expect(await screen.findByText('Apply complete')).toBeInTheDocument()
    expect(screen.getByText('Status: APPLIED')).toBeInTheDocument()
  })

  it('áp dụng toàn bộ dòng cảnh báo', async () => {
    await renderPage()
    await runPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Apply All Warnings' }))

    await waitFor(() => expect(api.applyLegacyImport).toHaveBeenCalledWith(90, { commitWarnings: true }))
  })

  it('khoá nút áp dụng cảnh báo khi lô không có dòng cảnh báo', async () => {
    api.previewLegacyImport.mockResolvedValue({ data: { data: batchPayload({ rows: [row(1)] }) } })
    await renderPage()
    await runPreview()

    expect(screen.getByRole('button', { name: 'Apply All Warnings' })).toBeDisabled()
  })

  it('chọn từng dòng cảnh báo rồi áp dụng', async () => {
    await renderPage()
    await runPreview()

    expect(screen.getByRole('button', { name: 'Apply Selected' })).toBeDisabled()
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Apply Selected' }))
    await waitFor(() => expect(api.applyLegacyImport).toHaveBeenCalledWith(90, { confirmedRowIds: [2] }))
  })

  it('bỏ chọn dòng cảnh báo thì khoá lại nút áp dụng', async () => {
    await renderPage()
    await runPreview()
    const checkbox = screen.getByRole('checkbox')

    fireEvent.click(checkbox)
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Apply Selected' })).toBeDisabled()
  })

  it('chỉ hiện ô chọn cho dòng cảnh báo', async () => {
    await renderPage()
    await runPreview()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('xoá lựa chọn sau khi áp dụng xong', async () => {
    await renderPage()
    await runPreview()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Apply Selected' }))

    await screen.findByText('Apply complete')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('hiện lỗi khi áp dụng thất bại', async () => {
    api.applyLegacyImport.mockRejectedValue({ response: { data: { message: 'Không ghi được dữ liệu' } } })
    await renderPage()
    await runPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Apply Valid' }))

    expect(await screen.findByText('Không ghi được dữ liệu')).toBeInTheDocument()
  })

  it('báo lỗi kết nối khi áp dụng không có phản hồi', async () => {
    api.applyLegacyImport.mockRejectedValue(new Error('down'))
    await renderPage()
    await runPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Apply Valid' }))

    expect(await screen.findByText(/Không thể kết nối đến máy chủ/)).toBeInTheDocument()
  })
})
