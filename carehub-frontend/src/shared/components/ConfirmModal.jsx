import { useEffect, useRef } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import './ConfirmModal.css'

function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  danger = false,
}) {
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    previousFocusRef.current = document.activeElement
    const firstFocusable = cancelRef.current || confirmRef.current
    window.setTimeout(() => firstFocusable?.focus(), 0)

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }

      if (event.key === 'Tab') {
        const focusables = [cancelRef.current, confirmRef.current].filter(Boolean)
        if (focusables.length < 2) return

        const current = document.activeElement
        const index = focusables.indexOf(current)
        const nextIndex = event.shiftKey
          ? (index <= 0 ? focusables.length - 1 : index - 1)
          : (index + 1) % focusables.length

        if (index !== -1) {
          event.preventDefault()
          focusables[nextIndex].focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
      previousFocusRef.current?.focus?.()
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="confirm-modal__overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
      style={{ zIndex: 10000 }}
    >
      <div
        className="confirm-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        style={{ maxWidth: '400px' }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal__header">
          <h3 className="confirm-modal__title" id="confirm-modal-title">{title}</h3>
          <button type="button" className="confirm-modal__close" onClick={onCancel} aria-label="Đóng hộp thoại xác nhận">
            <CloseOutlined />
          </button>
        </div>
        <div className="confirm-modal__body">
          <p id="confirm-modal-message" className="confirm-modal__message">{message}</p>
          <div className="confirm-modal__actions">
            <button type="button" className="confirm-modal__button confirm-modal__cancel" onClick={onCancel} ref={cancelRef}>
              {cancelText}
            </button>
            <button
              type="button"
              className={`confirm-modal__button confirm-modal__confirm${danger ? ' confirm-modal__confirm--danger' : ''}`}
              onClick={onConfirm}
              ref={confirmRef}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
