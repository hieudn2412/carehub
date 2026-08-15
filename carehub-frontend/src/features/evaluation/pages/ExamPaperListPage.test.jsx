import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.React = React

const listExamPapers = vi.fn()
const listExamConfigs = vi.fn()
const previewSavedExamConfig = vi.fn()
const generateExamPapers = vi.fn()
const showToast = vi.fn()

vi.mock('../../admin/components/AdminSidebar.jsx', () => ({ default: () => <aside /> }))
vi.mock('../../admin/components/AdminHeader.jsx', () => ({ default: () => <header /> }))
vi.mock('../../admin/components/ConfirmModal.jsx', () => ({ default: () => null }))
vi.mock('../components/ExamManagementViewSwitch.jsx', () => ({ default: () => <nav /> }))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../api/examConfigApi.js', () => ({
  examConfigApi: { listExamConfigs, previewSavedExamConfig },
}))
vi.mock('../api/examPaperApi.js', () => ({
  examPaperApi: {
    listExamPapers,
    getExamPaper: vi.fn(),
    generateExamPapers,
    publishExamPaper: vi.fn(),
    archiveExamPaper: vi.fn(),
    exportExamPaper: vi.fn(),
  },
}))

describe('ExamPaperListPage generation checkpoint', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    listExamPapers.mockResolvedValue({ data: { data: [] } })
    listExamConfigs.mockResolvedValue({ data: { data: [
      { id: 17, name: 'Kiểm tra đa lĩnh vực', status: 'ACTIVE', blueprintVersion: 3, questionSetId: null },
    ] } })
    previewSavedExamConfig.mockResolvedValue({ data: { data: { valid: true, warnings: [], poolChecksum: 'abc' } } })
    generateExamPapers.mockResolvedValue({ data: { data: [
      {
        id: 71,
        generationBatchId: 9,
        overlapQuestionCount: 1,
        overlapPercentage: 12.5,
        generationAlgorithmVersion: 'DIRECT_BANK_V1',
      },
    ] } })
  })

  it('previews the saved pool and sends an idempotent direct-bank generation request', async () => {
    const { default: ExamPaperListPage } = await import('./ExamPaperListPage.jsx')
    render(<MemoryRouter><ExamPaperListPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('option', { name: /Kiểm tra đa lĩnh vực/ })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Cấu hình đã kích hoạt'), { target: { value: '17' } })
    fireEvent.change(screen.getByLabelText('Số mã đề'), { target: { value: '2' } })
    fireEvent.click(screen.getByLabelText('Không lặp họ câu hỏi giữa các mã đề'))
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra nguồn và sinh mã đề' }))

    await waitFor(() => expect(generateExamPapers).toHaveBeenCalledTimes(1))
    expect(previewSavedExamConfig).toHaveBeenCalledWith('17', { variantCount: 2, zeroOverlap: true })
    expect(generateExamPapers.mock.calls[0][0]).toMatchObject({
      examConfigId: 17,
      variantCount: 2,
      zeroOverlap: true,
    })
    expect(generateExamPapers.mock.calls[0][0]).not.toHaveProperty('questionSetId')
    expect(generateExamPapers.mock.calls[0][0].idempotencyKey).toEqual(expect.any(String))
    expect(await screen.findByText(/Batch #9: 1 mã đề/)).toBeInTheDocument()
    expect(screen.getByText(/Overlap 1 lượt câu \(12.50%\)/)).toBeInTheDocument()
  }, 15000)

  it('does not call generation when the refreshed preview reports a shortage', async () => {
    previewSavedExamConfig.mockResolvedValueOnce({
      data: { data: { valid: false, warnings: ['Hồi sức / Nền tảng thiếu 2 câu'] } },
    })
    const { default: ExamPaperListPage } = await import('./ExamPaperListPage.jsx')
    render(<MemoryRouter><ExamPaperListPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getByRole('option', { name: /Kiểm tra đa lĩnh vực/ })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Cấu hình đã kích hoạt'), { target: { value: '17' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra nguồn và sinh mã đề' }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Hồi sức / Nền tảng thiếu 2 câu', 'warning'))
    expect(generateExamPapers).not.toHaveBeenCalled()
  }, 15000)
})
