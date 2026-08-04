import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import Modal from './Modal.jsx'

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

function ModalHarness({ closeSpy }) {
  const [value, setValue] = useState('')

  return (
    <Modal title="Đổi mật khẩu" onClose={() => closeSpy()}>
      <input
        aria-label="Mật khẩu mới"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  )
}

describe('Modal', () => {
  it('không cướp focus khỏi input khi nội dung modal render lại', () => {
    render(<ModalHarness closeSpy={vi.fn()} />)
    const input = screen.getByRole('textbox', { name: 'Mật khẩu mới' })

    input.focus()
    fireEvent.change(input, { target: { value: 'a' } })

    expect(input).toHaveValue('a')
    expect(input).toHaveFocus()
  })
})
