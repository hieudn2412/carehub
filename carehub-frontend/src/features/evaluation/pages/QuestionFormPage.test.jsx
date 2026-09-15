import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const checkDuplicates = vi.fn()
const createQuestion = vi.fn()
const showToast = vi.fn()

globalThis.React = React

vi.mock('../api/questionBankApi.js', () => ({
  questionBankApi: { checkDuplicates, createQuestion, updateQuestion: vi.fn() },
}))
vi.mock('../api/questionCategoryApi.js', () => ({
  questionCategoryApi: {
    listCategories: vi.fn().mockResolvedValue({ data: { data: [{ id: 3, name: 'Kiểm soát nhiễm khuẩn' }] } }),
  },
}))
vi.mock('../../training/api/trainingApi.js', () => ({
  trainingApi: {
    getRecordOptions: vi.fn().mockResolvedValue({ data: { data: { professionalFields: [{ id: 1, code: 'HSCC', name: 'Hồi sức cấp cứu' }] } } }),
  },
}))
vi.mock('../../../shared/context/ToastContext.jsx', () => ({ useToast: () => ({ showToast }) }))

// Hai select này dùng combobox tuỳ biến; thay bằng <select> thường cho test điều khiển được.
function selectStub({ value, onChange, options = [], placeholder, ariaLabel, label }) {
  return (
    <select
      aria-label={ariaLabel || label || placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">--</option>
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}
vi.mock('../../../shared/components/SearchableSelect.jsx', () => ({ default: selectStub }))
vi.mock('../../../shared/components/FormSelectField.jsx', () => ({ default: selectStub }))

async function fillAndSubmit() {
  fireEvent.change(await screen.findByPlaceholderText('Nhập nội dung câu hỏi trắc nghiệm...'), {
    target: { value: 'Rửa tay thường quy gồm mấy bước?' },
  })
  fireEvent.change(screen.getByLabelText('Lĩnh vực chuyên môn'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Danh mục kiến thức'), { target: { value: '3' } })
  const selects = screen.getAllByRole('combobox')
  fireEvent.change(selects[selects.length - 1], { target: { value: 'FOUNDATION' } })
  'ABCD'.split('').forEach((letter, index) => {
    fireEvent.change(screen.getByPlaceholderText(`Đáp án ${letter}...`), {
      target: { value: `Phương án ${index + 1}` },
    })
  })
  fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi/ }))
}

describe('QuestionFormPage — kiểm tra trùng trước khi lưu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createQuestion.mockResolvedValue({ data: { data: { id: 1 } } })
  })

  it('hỏi người dùng trước khi lưu khi phát hiện câu tương tự', async () => {
    checkDuplicates.mockResolvedValue({
      data: {
        data: [
          { sourceId: 10, stem: 'Quy trình rửa tay thường quy có bao nhiêu bước?', similarity: 0.96, strongDuplicate: false },
        ],
      },
    })
    const { default: QuestionFormPage } = await import('./QuestionFormPage.jsx')
    render(<MemoryRouter><QuestionFormPage /></MemoryRouter>)

    await fillAndSubmit()

    // Hộp thoại phải hiện TRƯỚC khi gọi API tạo câu hỏi.
    expect(await screen.findByText('Câu hỏi có thể bị trùng')).toBeInTheDocument()
    expect(createQuestion).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Vẫn lưu' }))
    await waitFor(() => expect(createQuestion).toHaveBeenCalled())
  })

  it('lưu thẳng khi không có câu nào tương tự', async () => {
    checkDuplicates.mockResolvedValue({ data: { data: [] } })
    const { default: QuestionFormPage } = await import('./QuestionFormPage.jsx')
    render(<MemoryRouter><QuestionFormPage /></MemoryRouter>)

    await fillAndSubmit()

    await waitFor(() => expect(createQuestion).toHaveBeenCalled())
    expect(screen.queryByText('Câu hỏi có thể bị trùng')).not.toBeInTheDocument()
  })

  it('báo rõ khi bước kiểm tra trùng lỗi thay vì lặng lẽ lưu', async () => {
    checkDuplicates.mockRejectedValue(new Error('network down'))
    const { default: QuestionFormPage } = await import('./QuestionFormPage.jsx')
    render(<MemoryRouter><QuestionFormPage /></MemoryRouter>)

    await fillAndSubmit()

    await waitFor(() => expect(createQuestion).toHaveBeenCalled())
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Không kiểm tra được trùng lặp'),
      'warning',
    )
  })
})
