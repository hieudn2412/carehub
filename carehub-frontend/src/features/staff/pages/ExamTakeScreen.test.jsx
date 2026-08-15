import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import ExamTakeScreen from './ExamTakeScreen.jsx'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../../../shared/components/ConfirmDialog.jsx', () => ({
  default: () => null,
}))

const toastContext = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => toastContext,
}))

vi.mock('../../evaluation/api/myExamApi.js', () => ({
  myExamApi: {
    getAttempt: vi.fn(),
    saveAnswers: vi.fn(),
    submitAttempt: vi.fn(),
  },
}))

const response = (data) => ({ data: { data } })

function renderExamAttempt() {
  return render(
    <MemoryRouter initialEntries={['/staff/exam/take/70']}>
      <Routes>
        <Route path="/staff/exam/take/:attemptId" element={<ExamTakeScreen />} />
        <Route path="/staff/exam/history" element={<h1>Lịch sử thi</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ExamTakeScreen timer regression', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T08:00:00Z'))
    vi.clearAllMocks()

    myExamApi.getAttempt.mockResolvedValue(response({
      id: 70,
      status: 'IN_PROGRESS',
      examPaperName: 'Đề kiểm tra timezone',
      startedAt: '2026-08-12T08:00:00',
      // Legacy backend shape: no offset must be rejected, never guessed.
      expiresAt: '2026-08-12T08:30:00',
      totalQuestions: 1,
      questions: [{
        paperQuestionId: 1,
        position: 1,
        stem: 'Câu hỏi kiểm tra thời gian',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
      }],
      answers: [],
    }))
    myExamApi.submitAttempt.mockResolvedValue(response({
      id: 70,
      status: 'GRADED',
      examPaperName: 'Đề kiểm tra timezone',
      questions: [],
      answers: [],
    }))
  })

  it('does not auto-submit a future server deadline when the timestamp has no offset', async () => {
    renderExamAttempt()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText('Câu hỏi kiểm tra thời gian')).toBeInTheDocument()
    expect(screen.getByText('Không đồng bộ được thời gian bài thi. Vui lòng tải lại hoặc liên hệ quản trị viên.')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(myExamApi.submitAttempt).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Lịch sử thi' })).not.toBeInTheDocument()
  })

  it('auto-submits an actually expired attempt only once', async () => {
    myExamApi.getAttempt.mockResolvedValue(response({
      id: 70,
      status: 'IN_PROGRESS',
      examPaperName: 'Đề kiểm tra đã hết giờ',
      startedAt: '2026-08-12T07:00:00Z',
      expiresAt: '2026-08-12T07:59:59Z',
      totalQuestions: 1,
      questions: [{
        paperQuestionId: 1,
        position: 1,
        stem: 'Câu hỏi hết giờ',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
      }],
      answers: [],
    }))

    const view = renderExamAttempt()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText('Câu hỏi hết giờ')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(myExamApi.submitAttempt).toHaveBeenCalledTimes(1)
    view.rerender(
      <MemoryRouter initialEntries={['/staff/exam/take/70']}>
        <Routes>
          <Route path="/staff/exam/take/:attemptId" element={<ExamTakeScreen />} />
          <Route path="/staff/exam/history" element={<h1>Lịch sử thi</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(myExamApi.submitAttempt).toHaveBeenCalledTimes(1)
  })

  it('counts down from server duration and ignores a wall-clock jump', async () => {
    myExamApi.getAttempt.mockResolvedValue(response({
      id: 70,
      status: 'IN_PROGRESS',
      examPaperName: 'Đề kiểm tra duration',
      remainingSeconds: 1800,
      expiresAt: '2026-08-12T08:30:00Z',
      totalQuestions: 1,
      questions: [{
        paperQuestionId: 1,
        position: 1,
        stem: 'Câu hỏi duration',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
      }],
      answers: [],
    }))

    renderExamAttempt()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByText('30:00')).toBeInTheDocument()
    vi.setSystemTime(new Date('2026-08-12T20:00:00Z'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(screen.getByText('29:59')).toBeInTheDocument()
    expect(myExamApi.submitAttempt).not.toHaveBeenCalled()
  })

  it('resynchronizes the monotonic deadline from a save response', async () => {
    myExamApi.getAttempt.mockResolvedValue(response({
      id: 70,
      status: 'IN_PROGRESS',
      examPaperName: 'Đề kiểm tra resume',
      remainingSeconds: 1800,
      expiresAt: '2026-08-12T08:30:00Z',
      totalQuestions: 1,
      questions: [{
        paperQuestionId: 1,
        position: 1,
        stem: 'Câu hỏi resume',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
      }],
      answers: [],
    }))
    myExamApi.saveAnswers.mockResolvedValue(response({
      id: 70,
      status: 'IN_PROGRESS',
      examPaperName: 'Đề kiểm tra resume',
      remainingSeconds: 600,
      expiresAt: '2026-08-12T08:10:00Z',
      totalQuestions: 1,
      questions: [{
        paperQuestionId: 1,
        position: 1,
        stem: 'Câu hỏi resume',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
      }],
      answers: [],
    }))

    renderExamAttempt()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      screen.getByRole('button', { name: /Lưu bài/ }).click()
      await Promise.resolve()
    })

    expect(myExamApi.saveAnswers).toHaveBeenCalledTimes(1)
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })
})
