import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityTypeListPage from './ActivityTypeListPage.jsx'
import { trainingApi } from '../api/trainingApi.js'

vi.mock('../../../shared/components/AppShell.jsx', () => ({
  default: ({ children }) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('../api/trainingApi.js', () => ({
  trainingApi: {
    getActivityTypes: vi.fn(),
    createActivityType: vi.fn(),
    updateActivityType: vi.fn(),
  },
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('ActivityTypeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trainingApi.getActivityTypes.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 1,
            name: 'Đào tạo trực tiếp',
            description: 'Học tập trung tại bệnh viện',
            maxCreditedHoursPerRecord: 8,
            active: true,
          }],
          totalElements: 1,
          totalPages: 1,
        },
      },
    })
  })

  it('uses the new page name and omits the credited-hours column', async () => {
    render(<ActivityTypeListPage />)

    expect(await screen.findByRole('heading', { name: 'Cách thức đào tạo' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tên cách thức' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Quy tắc tính giờ' })).not.toBeInTheDocument()
    expect(screen.queryByText('Tối đa 8 giờ')).not.toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
  })
})
