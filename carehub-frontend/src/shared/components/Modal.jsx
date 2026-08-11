import { useEffect, useRef } from 'react'

/**
 * Modal chuẩn: backdrop, đóng bằng ESC/click nền, role="dialog",
 * khoá scroll body, trả focus về phần tử trước khi mở.
 *
 * <Modal title="..." onClose={fn} size="lg" footer={<>...</>}>nội dung</Modal>
 */
function Modal({ title, onClose, footer, size, children }) {
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [])

  return (
    <div className="ch-modal-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className={`ch-modal${size === 'lg' ? ' ch-modal--lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {title != null && (
          <div className="ch-modal__header">
            <h3>{title}</h3>
            <button type="button" className="ch-btn-icon" aria-label="Đóng" onClick={onClose}>
              ✕
            </button>
          </div>
        )}
        <div className="ch-modal__body">{children}</div>
        {footer != null && <div className="ch-modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal
