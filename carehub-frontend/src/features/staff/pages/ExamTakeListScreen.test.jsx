import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import ExamTakeListScreen from './ExamTakeListScreen.jsx'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

const toastContext = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => toastContext,
}))

vi.mock('../../evaluation/api/myExamApi.js', () => ({
  myExamApi: { listAssignments: vi.fn(), startAssignment: vi.fn() },
}))

describe('ExamTakeListScreen', () => {
  beforeEach(() => {
    myExamApi.listAssignments.mockResolvedValue({ data: { data: [{
      id: 1,
      name: 'Kiểm tra an toàn người bệnh',
      passingScore: 7,
      bestScore: 8.5,
      assessmentStatus: 'PASSED',
      usedAttempts: 1,
      maxAttempts: 2,
    }] } })
  })

  it('shows the scale once in each score heading', async () => {
    render(<MemoryRouter><ExamTakeListScreen /></MemoryRouter>)

    await screen.findByText('Kiểm tra an toàn người bệnh')
    expect(screen.getByRole('columnheader', { name: 'Điểm đạt /10' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Điểm cao nhất /10' })).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('8,5')).toBeInTheDocument()
    expect(screen.queryByText('8,5/10')).not.toBeInTheDocument()
  })
})
