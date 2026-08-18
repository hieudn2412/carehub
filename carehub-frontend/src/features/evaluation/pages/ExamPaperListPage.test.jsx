import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.React = React

const listExamPapers = vi.fn()
const showToast = vi.fn()

vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({ default: () => null }))
vi.mock('../components/ExamManagementViewSwitch.jsx', () => ({ default: () => <nav /> }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../api/examPaperApi.js', () => ({
  examPaperApi: {
    listExamPapers,
    getExamPaper: vi.fn(),
    publishExamPaper: vi.fn(),
    archiveExamPaper: vi.fn(),
    exportExamPaper: vi.fn(),
  },
}))

describe('ExamPaperListPage', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    listExamPapers.mockResolvedValue({ data: { data: [
      {
        id: 71,
        code: 'EP-71',
        name: 'Kiểm tra an toàn người bệnh',
        examConfigName: 'Ma trận điều dưỡng',
        totalQuestions: 30,
        status: 'PUBLISHED',
        statusText: 'Đã phát hành',
        createdAt: '2026-08-15T09:00:00',
      },
    ] } })
  })

  it('renders the paper list without the removed extra-generation panel', async () => {
    const { default: ExamPaperListPage } = await import('./ExamPaperListPage.jsx')
    render(<MemoryRouter><ExamPaperListPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('EP-71')).toBeInTheDocument())
    expect(screen.getByText('Kiểm tra an toàn người bệnh')).toBeInTheDocument()
    expect(screen.queryByText('Sinh thêm mã đề từ ma trận có sẵn')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cấu hình đã kích hoạt')).not.toBeInTheDocument()
  })
})
