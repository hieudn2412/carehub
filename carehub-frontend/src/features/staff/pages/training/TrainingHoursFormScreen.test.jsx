import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingHoursFormScreen from './TrainingHoursFormScreen.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'

vi.mock('../../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../../../features/training/api/trainingApi', () => ({
  trainingApi: {
    getRecordOptions: vi.fn(),
    getMyTrainingStatus: vi.fn(),
    createRecord: vi.fn(),
  },
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('TrainingHoursFormScreen hour validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getRecordOptions.mockResolvedValue({
      data: {
        data: {
          activityTypes: [{ id: 1, name: 'Đào tạo trực tiếp' }],
          professionalFields: [],
        },
      },
    })
    trainingApi.getMyTrainingStatus.mockResolvedValue({
      data: { data: { cycleYears: 5 } },
    })
  })

  it('shows the negative-hours message and does not call the create API', async () => {
    render(
      <MemoryRouter initialEntries={['/staff/training/new']}>
        <Routes>
          <Route path="/staff/training/new" element={<TrainingHoursFormScreen />} />
        </Routes>
      </MemoryRouter>,
    )

    const hoursInput = await screen.findByRole('spinbutton')
    fireEvent.change(hoursInput, { target: { value: '-2' } })
    fireEvent.click(screen.getByRole('button', { name: /Lưu nháp/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('Số giờ đào tạo không được là số âm.')
    expect(hoursInput).toHaveAttribute('aria-invalid', 'true')
    expect(trainingApi.createRecord).not.toHaveBeenCalled()
  })
})
