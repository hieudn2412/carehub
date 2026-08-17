import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionalFieldManagementPage from './ProfessionalFieldManagementPage.jsx'
import { adminApi } from '../api/adminApi.js'

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }))

vi.mock('../components/AdminHeader.jsx', () => ({ default: () => null }))
vi.mock('../components/AdminSidebar.jsx', () => ({ default: () => null }))

vi.mock('../api/adminApi.js', () => ({
  adminApi: {
    createProfessionalField: vi.fn(),
    getProfessionalFields: vi.fn(),
    rejectProfessionalField: vi.fn(),
    updateProfessionalField: vi.fn(),
  },
}))

vi.mock('../../../shared/context/ToastContext.jsx', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfessionalFieldManagementPage />
    </MemoryRouter>,
  )
}

describe('ProfessionalFieldManagementPage create form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getProfessionalFields.mockResolvedValue({
      data: { data: { content: [] } },
    })
    adminApi.createProfessionalField.mockResolvedValue({ data: { data: {} } })
    adminApi.rejectProfessionalField.mockResolvedValue({ data: { data: {} } })
  })

  it('shows field-level validation in the create modal', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Tạo mới lĩnh vực/i }))

    expect(screen.getByRole('dialog', { name: 'Tạo mới lĩnh vực chuyên môn' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Mã lĩnh vực/i)).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /Tạo lĩnh vực/i }))

    expect(await screen.findByText('Vui lòng nhập mã lĩnh vực.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập tên lĩnh vực.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Mã lĩnh vực/i)).toHaveAttribute('aria-invalid', 'true')
    expect(adminApi.createProfessionalField).not.toHaveBeenCalled()
  })

  it('trims values before creating a professional field', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Tạo mới lĩnh vực/i }))
    fireEvent.change(screen.getByLabelText(/Mã lĩnh vực/i), { target: { value: '  CAP_CUU  ' } })
    fireEvent.change(screen.getByLabelText(/Tên lĩnh vực/i), { target: { value: '  Chăm sóc cấp cứu  ' } })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  Chăm sóc người bệnh cấp cứu  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Tạo lĩnh vực/i }))

    await waitFor(() => {
      expect(adminApi.createProfessionalField).toHaveBeenCalledWith({
        active: true,
        code: 'CAP_CUU',
        description: 'Chăm sóc người bệnh cấp cứu',
        name: 'Chăm sóc cấp cứu',
        version: null,
      })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects a pending proposal without requiring a reason', async () => {
    adminApi.getProfessionalFields.mockResolvedValue({
      data: {
        data: {
          content: [{
            id: 7,
            code: 'CUSTOM_7',
            name: 'Điều dưỡng nhi',
            active: false,
            moderationStatus: 'PENDING',
            version: 0,
          }],
        },
      },
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Chờ phê duyệt/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Từ chối lĩnh vực Điều dưỡng nhi' }))
    expect(screen.getByRole('dialog', { name: 'Từ chối lĩnh vực chuyên môn' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Từ chối đề xuất$/i }))

    await waitFor(() => expect(adminApi.rejectProfessionalField).toHaveBeenCalledWith(7))
    expect(showToastMock).toHaveBeenCalledWith('Đã từ chối đề xuất lĩnh vực chuyên môn', 'success')
  })
})
