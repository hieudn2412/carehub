import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const createExamConfig = vi.fn()
const previewExamConfig = vi.fn()
const generateExamPapers = vi.fn()
const publishExamPaper = vi.fn()
const createAudience = vi.fn()
const activateAudience = vi.fn()
const createAssignment = vi.fn()

globalThis.React = React

vi.mock('../../../shared/components/DepartmentCombobox.jsx', () => ({
  default: ({ departments, value, onChange, placeholder }) => (
    <select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Chọn lĩnh vực</option>
      {departments.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
    </select>
  ),
}))
vi.mock('../../training/api/trainingApi.js', () => ({
  trainingApi: {
    getRecordOptions: vi.fn().mockResolvedValue({ data: { data: { professionalFields: [{ id: 1, name: 'Hồi sức cấp cứu', code: 'HSCC' }] } } }),
  },
}))
vi.mock('../../admin/api/adminApi.js', () => ({
  adminApi: {
    getPositions: vi.fn().mockResolvedValue({ data: { data: [
      { id: 1, name: 'Điều dưỡng viên' },
      { id: 2, name: 'Điều dưỡng trưởng' },
      { id: 3, name: 'Bác sĩ' },
      { id: 4, name: 'Kỹ thuật viên' },
    ] } }),
    getDepartments: vi.fn().mockResolvedValue({ data: { data: [
      { id: 2, departmentCode: 'DD', name: 'Phòng Điều dưỡng' },
      { id: 3, departmentCode: 'HSCC', name: 'Khoa Hồi sức cấp cứu' },
    ] } }),
    getUsers: vi.fn().mockResolvedValue({ data: { data: { content: [
      { id: 9, employeeCode: 'VD001', fullName: 'Nguyễn Văn A', departmentId: 2, departmentName: 'Phòng Điều dưỡng', positionName: 'Điều dưỡng viên' },
      { id: 10, employeeCode: 'tuan1', fullName: 'Trần Mạnh Tuấn', departmentId: 2, departmentName: 'Phòng Điều dưỡng', positionName: 'Điều dưỡng trưởng' },
      { id: 11, employeeCode: 'tuan2', fullName: 'Lê Anh Tuấn', departmentId: 3, departmentName: 'Khoa Hồi sức cấp cứu', positionName: 'Điều dưỡng viên' },
      { id: 12, employeeCode: 'namnv', fullName: 'Nguyễn Văn Nam', departmentId: 3, departmentName: 'Khoa Hồi sức cấp cứu', positionName: 'Bác sĩ' },
      { id: 13, employeeCode: 'admin01', fullName: 'Quản trị viên', departmentId: 2, departmentName: 'Phòng Điều dưỡng', roles: [{ id: 1, code: 'ADMIN', name: 'Quản trị' }] },
    ] } } }),
  },
}))
vi.mock('../api/examConfigApi.js', () => ({
  examConfigApi: { previewExamConfig, createExamConfig },
}))
vi.mock('../api/examPaperApi.js', () => ({
  examPaperApi: { generateExamPapers, publishExamPaper },
}))
vi.mock('../api/evaluationAudienceApi.js', () => ({
  evaluationAudienceApi: { create: createAudience, activate: activateAudience },
}))
vi.mock('../api/examAssignmentApi.js', () => ({
  examAssignmentApi: { createAssignment },
}))
const showToast = vi.fn()
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))

describe('ExamConfigPage blueprint flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    previewExamConfig.mockResolvedValue({ data: { data: { valid: true, distributedQuestions: 30, warnings: [] } } })
    createExamConfig.mockResolvedValue({ data: { data: { id: 77 } } })
    generateExamPapers.mockResolvedValue({ data: { data: [{ id: 88 }] } })
    publishExamPaper.mockResolvedValue({ data: { data: { id: 88, status: 'PUBLISHED' } } })
    createAudience.mockResolvedValue({ data: { data: { id: 99 } } })
    activateAudience.mockResolvedValue({ data: { data: { id: 99, status: 'ACTIVE' } } })
    createAssignment.mockResolvedValue({ data: { data: { id: 100 } } })
  })

  it('renders the field×cognitive blueprint without question-set purpose controls', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    expect(await screen.findByRole('option', { name: 'Hồi sức cấp cứu' })).toBeInTheDocument()
    expect(screen.queryByText(/Bộ câu hỏi/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mục đích/i)).not.toBeInTheDocument()
  })

  it('sends field and cognitive percentages directly, without a questionSetId', async () => {
    generateExamPapers.mockReturnValue(new Promise(() => {}))
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    fireEvent.change(await screen.findByLabelText('Tìm kiếm và chọn lĩnh vực chuyên môn...'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Tên bài kiểm tra/), { target: { value: 'Kiểm tra HSCC' } })
    fireEvent.change(screen.getByLabelText('Số câu hỏi lĩnh vực này:'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
    fireEvent.click(screen.getByRole('button', { name: /Tạo đề/ }))

    await waitFor(() => expect(createExamConfig).toHaveBeenCalled())
    await waitFor(() => expect(generateExamPapers).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Đang tạo đề/ })).toBeDisabled()
    expect(screen.queryByText(/\d\/5\./)).not.toBeInTheDocument()
    const payload = createExamConfig.mock.calls.at(-1)[0]
    expect(payload).not.toHaveProperty('questionSetId')
    expect(payload).toMatchObject({ totalQuestions: 30, status: 'ACTIVE' })
    expect(payload.fieldBlueprints[0].professionalFieldId).toBe(1)
    expect(payload.fieldBlueprints[0].cognitive).toHaveLength(3)
  })
  it('tim nhieu ma nhan vien cach nhau bang dau cach', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    const search = await screen.findByLabelText('Tìm nhân viên')
    fireEvent.change(search, { target: { value: 'tuan2 tuan1 namnv' } })

    expect(screen.getByText('tuan1')).toBeInTheDocument()
    expect(screen.getByText('tuan2')).toBeInTheDocument()
    expect(screen.getByText('namnv')).toBeInTheDocument()
    expect(screen.queryByText('VD001')).not.toBeInTheDocument()
    expect(screen.getByText('3 hiển thị', { exact: false })).toBeInTheDocument()
  })

  it('khong hien tai khoan admin trong danh sach doi tuong nhan de', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    expect(await screen.findByText('VD001')).toBeInTheDocument()
    expect(screen.queryByText('admin01')).not.toBeInTheDocument()
    expect(screen.queryByText('Quản trị viên')).not.toBeInTheDocument()
  })

  it('loc doi tuong nhan de theo chuc danh', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    await screen.findByText('VD001')
    fireEvent.click(screen.getByLabelText('Lọc theo chức danh'))
    // Chuc danh chua gan cho ai van phai co trong danh muc.
    expect(await screen.findByRole('option', { name: 'Kỹ thuật viên' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Điều dưỡng viên' }))

    // Chi con hai nguoi giu chuc danh Dieu duong vien, o hai khoa khac nhau.
    expect(screen.getByText('VD001')).toBeInTheDocument()
    expect(screen.getByText('tuan2')).toBeInTheDocument()
    expect(screen.queryByText('tuan1')).not.toBeInTheDocument()
    expect(screen.queryByText('namnv')).not.toBeInTheDocument()
  })

  it('loc danh sach khoa phong theo tu khoa', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    const search = await screen.findByLabelText('Tìm khoa phòng')
    fireEvent.change(search, { target: { value: 'hồi sức' } })

    // Doi chieu bang ma khoa: ten khoa con xuat hien o cot nhan vien nen khong duy nhat.
    expect(screen.getByText('HSCC')).toBeInTheDocument()
    expect(screen.queryByText('DD')).not.toBeInTheDocument()
  })
})
