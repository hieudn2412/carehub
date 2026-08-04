// Vitest's JSX transform expects React in scope for this portal component.
// eslint-disable-next-line no-unused-vars
import React, { useEffect, useRef } from 'react'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import { createPortal } from 'react-dom'
import './MobileSearchSheet.css'

function MobileSearchSheet({ open, title = 'Tìm kiếm và bộ lọc', onClose, children }) {
  const sheetRef = useRef(null)
  const previousFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    previousFocusRef.current = document.activeElement
    document.body.style.overflow = 'hidden'

    const focusTarget = sheetRef.current?.querySelector('[data-mobile-search-autofocus]')
    focusTarget?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      const restoreFocus = () => previousFocusRef.current?.focus?.()
      if (window.requestAnimationFrame) window.requestAnimationFrame(restoreFocus)
      else restoreFocus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="mobile-search-sheet__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={sheetRef}
        className="mobile-search-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mobile-search-sheet__handle" aria-hidden="true" />
        <header className="mobile-search-sheet__header">
          <div className="mobile-search-sheet__title">
            <SearchOutlined aria-hidden="true" />
            <strong>{title}</strong>
          </div>
          <button type="button" className="mobile-search-sheet__close" onClick={onClose} aria-label="Đóng tìm kiếm và bộ lọc">
            <CloseOutlined aria-hidden="true" />
          </button>
        </header>
        <div className="mobile-search-sheet__body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}

export default MobileSearchSheet
