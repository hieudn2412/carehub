import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import EvidenceImageViewer from './EvidenceImageViewer.jsx'

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
let resize
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); this.querySelector('button')?.focus() } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
})
afterAll(() => {
  for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else delete HTMLDialogElement.prototype[name]
  }
})
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { resize = callback }
    observe() {}
    disconnect() {}
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600, left: 10, top: 10, right: 810, bottom: 610 })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function loadImage() {
  const image = screen.getByAltText('Ảnh minh chứng chứng-chỉ.jpg')
  Object.defineProperties(image, { naturalWidth: { value: 1600 }, naturalHeight: { value: 800 } })
  fireEvent.load(image)
  return image
}

describe('EvidenceImageViewer', () => {
  it('locks scrolling, opens a named dialog and restores focus and scrolling on close', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    document.body.style.overflow = 'auto'
    const view = render(<EvidenceImageViewer filename="chứng-chỉ.jpg" src="blob:image" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'chứng-chỉ.jpg' })).toHaveAttribute('open')
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.getByRole('button', { name: 'Đóng ảnh minh chứng' })).toHaveFocus()
    view.unmount()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).toBe('auto')
    trigger.remove()
  })

  it('waits for image load, enforces zoom limits and resets to fit on resize', () => {
    render(<EvidenceImageViewer filename="chứng-chỉ.jpg" src="blob:image" onClose={vi.fn()} />)
    const plus = screen.getByRole('button', { name: 'Phóng to' })
    const minus = screen.getByRole('button', { name: 'Thu nhỏ' })
    expect(plus).toBeDisabled()
    loadImage()
    expect(plus).toBeEnabled()
    expect(minus).toBeDisabled()
    fireEvent.click(plus)
    expect(screen.getByLabelText('Mức phóng to')).toHaveTextContent('125%')
    for (let i = 0; i < 20; i += 1) fireEvent.click(plus)
    expect(plus).toBeDisabled()
    expect(screen.getByLabelText('Mức phóng to')).toHaveTextContent('500%')
    fireEvent.click(screen.getByRole('button', { name: 'Vừa khung' }))
    expect(minus).toBeDisabled()
    fireEvent.click(plus)
    act(() => resize())
    expect(screen.getByLabelText('Mức phóng to')).toHaveTextContent('100%')
  })

  it('zooms with the wheel and reloads at fit when the image changes', () => {
    const view = render(<EvidenceImageViewer filename="chứng-chỉ.jpg" src="blob:image" onClose={vi.fn()} />)
    loadImage()
    const stage = screen.getByRole('region', { name: 'Vùng xem ảnh minh chứng' })
    fireEvent.wheel(stage, { deltaY: -200, clientX: 500, clientY: 300 })
    expect(Number.parseInt(screen.getByLabelText('Mức phóng to').textContent)).toBeGreaterThan(100)
    view.rerender(<EvidenceImageViewer filename="ảnh-khác.jpg" src="blob:other" onClose={vi.fn()} />)
    expect(screen.getByLabelText('Mức phóng to')).toHaveTextContent('100%')
    expect(screen.getByRole('button', { name: 'Phóng to' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Đóng ảnh minh chứng' })).toHaveFocus()
  })

  it('shows loading and URL errors with retry, and recovers from an image load error', () => {
    const retry = vi.fn()
    const view = render(<EvidenceImageViewer filename="chứng-chỉ.jpg" loading onRetry={retry} onClose={vi.fn()} />)
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Đang tải ảnh...')
    view.rerender(<EvidenceImageViewer filename="chứng-chỉ.jpg" error onRetry={retry} onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể hiển thị ảnh minh chứng.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(retry).toHaveBeenCalledOnce()
    view.rerender(<EvidenceImageViewer filename="chứng-chỉ.jpg" src="blob:image" onRetry={retry} onClose={vi.fn()} />)
    fireEvent.error(screen.getByAltText('Ảnh minh chứng chứng-chỉ.jpg'))
    expect(screen.getByRole('button', { name: 'Phóng to' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    loadImage()
    expect(screen.getByRole('button', { name: 'Phóng to' })).toBeEnabled()
  })

  it('handles close and Escape without submitting a containing form', () => {
    const close = vi.fn()
    const submit = vi.fn()
    render(<form onSubmit={submit}><EvidenceImageViewer filename="chứng-chỉ.jpg" src="blob:image" onClose={close} /></form>)
    fireEvent.click(screen.getByRole('button', { name: 'Đóng ảnh minh chứng' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(close).toHaveBeenCalledTimes(2)
    expect(submit).not.toHaveBeenCalled()
  })

  it('keeps Tab and Shift+Tab within the enabled dialog controls', () => {
    render(<EvidenceImageViewer filename="chứng-chỉ.jpg" src="blob:image" onClose={vi.fn()} />)
    loadImage()
    const close = screen.getByRole('button', { name: 'Đóng ảnh minh chứng' })
    const fit = screen.getByRole('button', { name: 'Vừa khung' })
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(fit).toHaveFocus()
    fireEvent.keyDown(fit, { key: 'Tab' })
    expect(close).toHaveFocus()
  })
})
