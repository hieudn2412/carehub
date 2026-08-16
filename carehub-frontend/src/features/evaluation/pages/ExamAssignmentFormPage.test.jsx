import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.React = React

const listExamPapers = vi.fn()
const getExamPaper = vi.fn()
const publishExamPaper = vi.fn()
const listAudiences = vi.fn()
const createAssignment = vi.fn()

vi.mock('../../../shared/components/AppShell.jsx', () => ({ default: ({ children }) => <div data-testid="app-shell">{children}</div> }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../api/examPaperApi.js', () => ({ examPaperApi: { listExamPapers, getExamPaper, publishExamPaper } }))
vi.mock('../api/evaluationAudienceApi.js', () => ({ evaluationAudienceApi: { list: listAudiences } }))
vi.mock('../api/examAssignmentApi.js', () => ({ examAssignmentApi: { createAssignment } }))

describe('ExamAssignmentFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listExamPapers.mockResolvedValue({ data: { data: [{
      id: 41, code: 'EP-041', name: 'Đề đa lĩnh vực', status: 'PUBLISHED',
      totalQuestions: 30, timeLimitMinutes: 45, passingScore: 7,
      generationBatchId: 8, variantIndex: 1,
    }] } })
    listAudiences.mockResolvedValue({ data: { data: [{
      id: 11, name: 'Điều dưỡng dưới 3 năm', status: 'ACTIVE', preview: { matchedUserCount: 12 },
    }] } })
    createAssignment.mockResolvedValue({ data: { data: { id: 90 } } })
  })

  it('assigns a published paper to an audience without legacy field or question-set controls', async () => {
    const { default: ExamAssignmentFormPage } = await import('./ExamAssignmentFormPage.jsx')
    render(<MemoryRouter><ExamAssignmentFormPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getAllByRole('combobox')).toHaveLength(10))
    fireEvent.change(screen.getByRole('textbox', { name: /Tên đợt giao đề/i }), { target: { value: 'Đợt kiểm tra tháng 8' } })
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '41' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '11' } })
    fireEvent.change(screen.getByLabelText('Cách mở đề'), { target: { value: 'OPEN' } })
    fireEvent.click(screen.getByRole('button', { name: /Giao đề kiểm tra/ }))

    await waitFor(() => expect(createAssignment).toHaveBeenCalledTimes(1))
    const payload = createAssignment.mock.calls[0][0]
    expect(payload).toMatchObject({ examPaperId: 41, audienceId: 11, status: 'OPEN', variantPolicy: 'STABLE_USER_HASH' })
    expect(payload.idempotencyKey).toEqual(expect.any(String))
    expect(payload).not.toHaveProperty('professionalFieldId')
    expect(payload).not.toHaveProperty('questionSetId')
    expect(screen.queryByText('Lĩnh vực chuyên môn')).not.toBeInTheDocument()
    expect(screen.queryByText('Bộ câu hỏi')).not.toBeInTheDocument()
  }, 15_000)

  it('auto-selects and pre-fills paper when paperId param is passed', async () => {
    const { default: ExamAssignmentFormPage } = await import('./ExamAssignmentFormPage.jsx')
    render(
      <MemoryRouter initialEntries={['/admin/evaluation/exam-assignments/new?paperId=41']}>
        <ExamAssignmentFormPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByDisplayValue('Đợt kiểm tra: Đề đa lĩnh vực')).toBeInTheDocument())
    expect(screen.getByText(/EP-041 · Đề đa lĩnh vực/)).toBeInTheDocument()
  })

  it('shows draft warning and allows publishing draft paper directly', async () => {
    listExamPapers.mockResolvedValue({ data: { data: [{
      id: 21, code: 'EP-021', name: 'Đề kiểm tra bản nháp', status: 'DRAFT',
      totalQuestions: 20, timeLimitMinutes: 30, passingScore: 7,
    }] } })
    publishExamPaper.mockResolvedValue({ data: { success: true } })

    const { default: ExamAssignmentFormPage } = await import('./ExamAssignmentFormPage.jsx')
    render(
      <MemoryRouter initialEntries={['/admin/evaluation/exam-assignments/new?paperId=21']}>
        <ExamAssignmentFormPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/đang ở trạng thái Bản nháp/i)).toBeInTheDocument())
    const publishBtn = screen.getByRole('button', { name: /Phát hành đề ngay/i })
    fireEvent.click(publishBtn)

    await waitFor(() => expect(publishExamPaper).toHaveBeenCalledWith(21))
  })
})
