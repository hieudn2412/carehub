import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Warnings } from './ParaphraseJobReviewPage.jsx'

describe('ParaphraseJobReviewPage warnings', () => {
  it('hiển thị mọi cảnh báo validation cho reviewer', () => {
    render(<Warnings warnings={JSON.stringify([
      'Câu hỏi mất thuật ngữ hoặc số liệu cần giữ: 65 tuổi',
      'Biến thể có nguy cơ đổi nghĩa so với câu gốc',
      'Có khả năng trùng ngữ nghĩa với câu hỏi khác trong ngân hàng',
    ])} />)

    expect(screen.getByText(/65 tuổi/)).toBeInTheDocument()
    expect(screen.getByText(/đổi nghĩa/)).toBeInTheDocument()
    expect(screen.getByText(/trùng ngữ nghĩa/)).toBeInTheDocument()
  })
})
