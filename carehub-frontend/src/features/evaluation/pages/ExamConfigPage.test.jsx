import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { examConfigApi } from '../api/examConfigApi.js'

globalThis.React = React

vi.mock('../../admin/components/AdminSidebar.jsx', () => ({ default: () => <aside data-testid="admin-sidebar" /> }))
vi.mock('../../admin/components/AdminHeader.jsx', () => ({ default: ({ breadcrumbs }) => <header>{breadcrumbs?.map((item) => item.label).join(' / ')}</header> }))
vi.mock('../../admin/components/DepartmentCombobox.jsx', () => ({
  default: ({ departments, onChange, placeholder }) => (
    <select className="ch-input" onChange={(e) => onChange?.(e.target.value)}>
      <option value="">{placeholder || '-- Chọn --'}</option>
      {departments?.map((d) => (
        <option key={d.id} value={String(d.id)}>{d.name}</option>
      ))}
    </select>
  ),
}))

vi.mock('../../training/api/trainingApi.js', () => ({
  trainingApi: {
    getRecordOptions: vi.fn().mockResolvedValue({ data: { data: { professionalFields: [{ id: 1, name: 'Hồi sức cấp cứu', code: 'HSCC' }] } } }),
  },
}))
vi.mock('../api/examConfigApi.js', () => ({
  examConfigApi: {
    previewExamConfig: vi.fn().mockResolvedValue({ data: { data: { valid: true } } }),
    createExamConfig: vi.fn().mockResolvedValue({ data: { data: { id: 77 } } }),
  },
}))
vi.mock('../api/evaluationAudienceApi.js', () => ({
  evaluationAudienceApi: {
    create: vi.fn().mockResolvedValue({ data: { data: { id: 88 } } }),
    activate: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}))
vi.mock('../api/examPaperApi.js', () => ({
  examPaperApi: {
    generateExamPapers: vi.fn().mockResolvedValue({ data: { data: [{ id: 99 }] } }),
    publishExamPaper: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}))
vi.mock('../api/examAssignmentApi.js', () => ({
  examAssignmentApi: {
    createAssignment: vi.fn().mockResolvedValue({ data: { data: { id: 100 } } }),
  },
}))
vi.mock('../../admin/api/adminApi.js', () => ({
  adminApi: {
    getDepartments: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getUsers: vi.fn().mockResolvedValue({ data: { data: [{ id: 5, fullName: 'Nguyễn Văn A', employeeCode: 'NV01' }] } }),
  },
}))
const showToast = vi.fn()
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))

describe('ExamConfigPage blueprint flow', () => {
  it('renders the field×cognitive blueprint without question-set purpose controls', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    expect(await screen.findByText(/Hồi sức cấp cứu/)).toBeInTheDocument()
    expect(screen.queryByText(/Bộ câu hỏi/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mục đích/i)).not.toBeInTheDocument()
  })

  it('sends field and cognitive percentages directly, without a questionSetId', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    expect(await screen.findByText(/Hồi sức cấp cứu/)).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue(/Tìm kiếm và chọn lĩnh vực chuyên môn/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Tên bài kiểm tra/i), { target: { value: 'Kiểm tra HSCC' } })
    const countInputs = screen.getAllByRole('spinbutton')
    // Find the field questionCount input (which defaults to 0) and set to 30
    const fieldCountInput = countInputs.find((input) => input.value === '0')
    if (fieldCountInput) fireEvent.change(fieldCountInput, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả' }))
    fireEvent.submit(screen.getByRole('button', { name: /Tạo ma trận & Giao đề ngay/i }))

    await waitFor(() => expect(examConfigApi.createExamConfig).toHaveBeenCalled())
    const payload = examConfigApi.createExamConfig.mock.calls.at(-1)[0]
    expect(payload).not.toHaveProperty('questionSetId')
    expect(payload).toMatchObject({ totalQuestions: 30, status: 'ACTIVE' })
    expect(payload.fieldBlueprints[0].professionalFieldId).toBe(1)
    expect(payload.fieldBlueprints[0].cognitive).toHaveLength(3)
  })
})
