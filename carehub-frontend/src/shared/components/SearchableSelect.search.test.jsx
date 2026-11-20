import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SearchableSelect from './SearchableSelect.jsx'

describe('Vietnamese text search', () => {
  it.each(['duong', 'DUONG', 'dương', 'dang'])('finds a Vietnamese employee with keyword %s', (keyword) => {
    render(<SearchableSelect ariaLabel="Tìm nhân viên" value="" onChange={vi.fn()}
      options={[{ value: 1, label: 'Đặng Dương Ngọc Hiếu' }]} />)
    const input = screen.getByRole('combobox', { name: 'Tìm nhân viên' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: keyword } })
    expect(screen.getByRole('option', { name: 'Đặng Dương Ngọc Hiếu' })).toBeInTheDocument()
  })
})
