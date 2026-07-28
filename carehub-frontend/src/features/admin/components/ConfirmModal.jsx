import { useEffect, useRef } from 'react'
import { CloseOutlined } from '@ant-design/icons'

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Xác nhận', cancelText = 'Hủy', danger = false }) {
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
        const nextIndex = event.shiftKey ? (index <= 0 ? focusables.length - 1 : index - 1) : (index + 1) % focusables.length
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
    <div className="am-modal-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()} style={{ zIndex: 10000 }}>
      <div className="am-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-message" style={{ maxWidth: '400px' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="am-modal-header">
          <h3 className="am-modal-title" id="confirm-modal-title">{title}</h3>
          <button type="button" className="am-modal-close" onClick={onCancel} aria-label="Đóng hộp thoại xác nhận">
            <CloseOutlined />
          </button>
        </div>
        <div className="am-modal-body">
          <p id="confirm-modal-message" style={{ fontSize: '14.5px', color: '#334155', marginBottom: '24px', lineHeight: '1.5', textAlign: 'left', whiteSpace: 'pre-line' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="am-modal-btn"
              style={{ background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }}
              onClick={onCancel}
              ref={cancelRef}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className="am-btn-primary"
              style={{
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13.5px',
                background: danger ? '#dc2626' : '#2563eb',
                color: '#fff',
                borderColor: 'transparent'
              }}
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
