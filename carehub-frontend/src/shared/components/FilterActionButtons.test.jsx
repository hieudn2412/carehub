import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilterActionButtons from './FilterActionButtons.jsx'

describe('FilterActionButtons', () => {
  it('renders shared reset and apply actions', () => {
    const onReset = vi.fn()
    const onApply = vi.fn()

    render(<FilterActionButtons onReset={onReset} onApply={onApply} />)

    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toHaveClass('filter-action-buttons__apply')
  })
})
