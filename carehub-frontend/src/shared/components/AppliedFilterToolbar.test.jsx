import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppliedFilterToolbar from './AppliedFilterToolbar.jsx'

describe('AppliedFilterToolbar', () => {
  it('keeps editing separate and exposes explicit apply and reset actions', () => {
    const onApply = vi.fn()
    const onReset = vi.fn()
    const onSearchChange = vi.fn()

    render(
      <AppliedFilterToolbar
        activeCount={2}
        isOpen
        onApply={onApply}
        onReset={onReset}
        onSearchChange={onSearchChange}
        onToggle={vi.fn()}
        panelId="test-filter-panel"
        searchValue=""
      >
        <label><span>Trạng thái</span><select aria-label="Trạng thái"><option>Tất cả</option></select></label>
      </AppliedFilterToolbar>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm kiếm' }), { target: { value: 'Nam' } })
    expect(onSearchChange).toHaveBeenCalledWith('Nam')
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
