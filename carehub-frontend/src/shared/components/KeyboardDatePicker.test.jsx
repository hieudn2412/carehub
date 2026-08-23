import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import KeyboardDatePicker from './KeyboardDatePicker.jsx'

describe('KeyboardDatePicker', () => {
  it('returns an invalid raw value when a date-range filter opts into validation', () => {
    const onChange = vi.fn()
    render(
      <KeyboardDatePicker
        allowInvalidValue
        aria-label="Từ ngày"
        onChange={onChange}
        value="2026-01-01"
      />,
    )

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '31/02/2026' } })
    fireEvent.blur(screen.getByLabelText('Từ ngày'))

    expect(onChange).toHaveBeenLastCalledWith('31/02/2026')
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('31/02/2026')
  })

  it('keeps the previous form value behavior when invalid values are not allowed', () => {
    const onChange = vi.fn()
    render(<KeyboardDatePicker aria-label="Ngày sinh" onChange={onChange} value="2026-01-01" />)

    fireEvent.change(screen.getByLabelText('Ngày sinh'), { target: { value: '31/02/2026' } })
    fireEvent.blur(screen.getByLabelText('Ngày sinh'))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Ngày sinh')).toHaveValue('01/01/2026')
  })
})
