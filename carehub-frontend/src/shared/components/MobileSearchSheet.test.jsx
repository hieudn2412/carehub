import { fireEvent, render, screen } from '@testing-library/react'
// Vitest's JSX transform expects React in scope in this test file.
// eslint-disable-next-line no-unused-vars
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import MobileSearchSheet from './MobileSearchSheet.jsx'

describe('MobileSearchSheet', () => {
  it('focuses the search field on open and restores focus after closing', async () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(
      <MobileSearchSheet open={false} onClose={onClose}>
        <input data-mobile-search-autofocus aria-label="Tìm kiếm" />
      </MobileSearchSheet>,
    )

    rerender(
      <MobileSearchSheet open onClose={onClose}>
        <input data-mobile-search-autofocus aria-label="Tìm kiếm" />
      </MobileSearchSheet>,
    )
    expect(screen.getByRole('textbox', { name: 'Tìm kiếm' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(
      <MobileSearchSheet open={false} onClose={onClose}>
        <input data-mobile-search-autofocus aria-label="Tìm kiếm" />
      </MobileSearchSheet>,
    )
    await new Promise(resolve => window.requestAnimationFrame(resolve))
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('closes when the backdrop or close button is activated', () => {
    const onClose = vi.fn()
    render(
      <MobileSearchSheet open onClose={onClose}>
        <input data-mobile-search-autofocus aria-label="Tìm kiếm" />
      </MobileSearchSheet>,
    )

    fireEvent.mouseDown(screen.getByRole('presentation'))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng tìm kiếm và bộ lọc' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
