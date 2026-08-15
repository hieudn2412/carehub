import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const createExamConfig = vi.fn()
globalThis.React = React

vi.mock('../../admin/components/AdminSidebar.jsx', () => ({ default: () => <aside data-testid="admin-sidebar" /> }))
vi.mock('../../admin/components/AdminHeader.jsx', () => ({ default: ({ breadcrumbs }) => <header>{breadcrumbs?.map((item) => item.label).join(' / ')}</header> }))
vi.mock('../../training/api/trainingApi.js', () => ({
  trainingApi: { getRecordOptions: vi.fn().mockResolvedValue({ data: { data: { professionalFields: [{ id: 1, name: 'Hồi sức cấp cứu', code: 'HSCC' }] } } }) },
}))
vi.mock('../api/examConfigApi.js', () => ({
  examConfigApi: { previewExamConfig: vi.fn(), createExamConfig },
}))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

describe('ExamConfigPage blueprint flow', () => {
  it('renders the field×cognitive blueprint without question-set purpose controls', async () => {
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    expect(await screen.findByText('Hồi sức cấp cứu')).toBeInTheDocument()
    expect(screen.queryByText(/Bộ câu hỏi/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mục đích/i)).not.toBeInTheDocument()
  })

  it('sends field and cognitive percentages directly, without a questionSetId', async () => {
    createExamConfig.mockResolvedValueOnce({ data: { id: 77 } })
    const { default: ExamConfigPage } = await import('./ExamConfigPage.jsx')
    render(<MemoryRouter><ExamConfigPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Hồi sức cấp cứu' }))
    fireEvent.change(screen.getByLabelText('Tên cấu hình'), { target: { value: 'Kiểm tra HSCC' } })
    fireEvent.change(screen.getByLabelText('Tỷ lệ lĩnh vực (%)'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    await waitFor(() => expect(createExamConfig).toHaveBeenCalled())
    const payload = createExamConfig.mock.calls.at(-1)[0]
    expect(payload).not.toHaveProperty('questionSetId')
    expect(payload).toMatchObject({ totalQuestions: 30, status: 'DRAFT' })
    expect(payload.fieldBlueprints[0].professionalFieldId).toBe(1)
    expect(payload.fieldBlueprints[0].cognitive).toHaveLength(3)
  })
})
