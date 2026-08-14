import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingHoursDetailScreen from './TrainingHoursDetailScreen.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../../../../features/admin/components/ConfirmModal.jsx', () => ({
  default: () => null,
}))

vi.mock('../../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../../features/training/api/trainingApi', () => ({
  trainingApi: {
    getRecord: vi.fn(),
    getMyTrainingStatus: vi.fn(),
    createEvidencePreviewUrl: vi.fn(),
    createEvidenceDownloadUrl: vi.fn(),
    submitRecord: vi.fn(),
    returnToDraft: vi.fn(),
    deleteRecord: vi.fn(),
  },
}))

const submittedRecord = {
  id: 19,
  title: 'Đào tạo an toàn người bệnh',
  workflowStatus: 'SUBMITTED',
  startDate: '2026-07-15',
  declaredHours: 4,
  version: 1,
  evidences: [
    {
      id: 101,
      originalFilename: 'chung-chi.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 1536,
      moderationStatus: 'PASSED',
    },
    {
      id: 102,
      originalFilename: 'quyet-dinh.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      moderationStatus: 'PASSED',
    },
  ],
}

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('TrainingHoursDetailScreen evidence viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getRecord.mockResolvedValue({ data: { data: submittedRecord } })
    trainingApi.getMyTrainingStatus.mockResolvedValue({ data: { data: { cycleYears: 5 } } })
    trainingApi.createEvidencePreviewUrl.mockImplementation((_recordId, evidenceId) => Promise.resolve({
      data: { data: { downloadUrl: `https://files.example.com/${evidenceId}` } },
    }))
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('shows image and PDF evidence for a submitted record', async () => {
    renderDetail()

    expect(await screen.findByRole('heading', { name: /Tệp minh chứng/ })).toBeInTheDocument()
    expect(screen.getByText('2 tệp')).toBeInTheDocument()
    expect(screen.getByText('chung-chi.jpg')).toBeInTheDocument()
    expect(screen.getByText('quyet-dinh.pdf')).toBeInTheDocument()
    expect(screen.getByText('PDF · 2.0 KB')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải xuống quyet-dinh.pdf' })).toBeInTheDocument()
  })

  it('opens a fresh preview URL for PDF evidence', async () => {
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Xem quyet-dinh.pdf' }))

    await waitFor(() => {
      expect(trainingApi.createEvidencePreviewUrl).toHaveBeenCalledWith('19', 102)
      expect(window.open).toHaveBeenCalledWith(
        'https://files.example.com/102',
        '_blank',
        'noopener,noreferrer',
      )
    })
  })
})

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/staff/training/19']}>
      <Routes>
        <Route path="/staff/training/:id" element={<TrainingHoursDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}
