import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.React = React

const listQuestions = vi.fn()
const showToast = vi.fn()

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <main>{children}</main>,
}))
vi.mock('../../../shared/components/ConfirmModal.jsx', () => ({ default: () => null }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../api/questionBankApi.js', () => ({
  questionBankApi: {
    listQuestions,
    getQuestion: vi.fn(),
    archiveQuestion: vi.fn(),
    exportQuestions: vi.fn(),
    downloadImportTemplate: vi.fn(),
    previewImport: vi.fn(),
    commitImport: vi.fn(),
  },
}))

describe('QuestionBankListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listQuestions.mockResolvedValue({ data: { data: [
      {
        id: 1,
        stem: 'Câu hỏi đang hoạt động',
        categoryName: 'Điều dưỡng',
        cognitiveLevel: 'FOUNDATION',
        status: 'APPROVED',
      },
      {
        id: 2,
        stem: 'Câu hỏi đã lưu trữ',
        categoryName: 'Điều dưỡng',
        cognitiveLevel: 'FOUNDATION',
        status: 'ARCHIVED',
      },
    ] } })
  })

  it('hiển thị câu đã lưu trữ và lọc theo trạng thái hoạt động', async () => {
    const { default: QuestionBankListPage } = await import('./QuestionBankListPage.jsx')
    render(<MemoryRouter><QuestionBankListPage /></MemoryRouter>)

    const archivedQuestion = await screen.findByText('Câu hỏi đã lưu trữ')
    const archivedRow = archivedQuestion.closest('tr')
    expect(within(archivedRow).getByText('Không hoạt động')).toBeInTheDocument()
    expect(within(archivedRow).getByRole('button', { name: 'Xem chi tiết câu hỏi' })).toBeInTheDocument()
    expect(within(archivedRow).queryByRole('button', { name: 'Chỉnh sửa câu hỏi' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc/ }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
    fireEvent.click(screen.getByRole('option', { name: 'Không hoạt động' }))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(screen.getByText('Câu hỏi đã lưu trữ')).toBeInTheDocument()
    expect(screen.queryByText('Câu hỏi đang hoạt động')).not.toBeInTheDocument()
  })
})
