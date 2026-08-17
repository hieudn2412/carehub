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

vi.mock('../../admin/components/AdminSidebar.jsx', () => ({ default: () => <aside data-testid="admin-sidebar" /> }))
vi.mock('../../admin/components/AdminHeader.jsx', () => ({ default: ({ breadcrumbs }) => <header>{breadcrumbs?.map((item) => item.label).join(' / ')}</header> }))
vi.mock('../../admin/components/DepartmentCombobox.jsx', () => ({
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
    getDepartments: vi.fn().mockResolvedValue({ data: { data: [{ id: 2, departmentCode: 'DD', name: 'Phòng Điều dưỡng' }] } }),
    getUsers: vi.fn().mockResolvedValue({ data: { data: { content: [{ id: 9, employeeCode: 'VD001', fullName: 'Nguyễn Văn A', departmentId: 2, departmentName: 'Phòng Điều dưỡng' }] } } }),
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
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    fireEvent.change(await screen.findByLabelText('Tìm kiếm và chọn lĩnh vực chuyên môn...'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Tên bài kiểm tra/), { target: { value: 'Kiểm tra HSCC' } })
    fireEvent.change(screen.getByLabelText('Số câu hỏi lĩnh vực này:'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
    fireEvent.click(screen.getByRole('button', { name: /Tạo ma trận & Giao đề ngay/ }))

    await waitFor(() => expect(createExamConfig).toHaveBeenCalled())
    const payload = createExamConfig.mock.calls.at(-1)[0]
    expect(payload).not.toHaveProperty('questionSetId')
    expect(payload).toMatchObject({ totalQuestions: 30, status: 'ACTIVE' })
    expect(payload.fieldBlueprints[0].professionalFieldId).toBe(1)
    expect(payload.fieldBlueprints[0].cognitive).toHaveLength(3)
  })
})
