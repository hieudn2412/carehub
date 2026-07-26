import Modal from './Modal.jsx'

/**
 * Hộp thoại xác nhận thay cho window.confirm.
 *
 * {confirmOpen && (
 *   <ConfirmDialog message="Bạn có chắc...?" danger
 *     onConfirm={...} onCancel={() => setConfirmOpen(false)} />
 * )}
 */
function ConfirmDialog({
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  confirming = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="ch-btn ch-btn--secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`ch-btn ${danger ? 'ch-btn--danger' : 'ch-btn--primary'}`}
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="ch-confirm-message">{message}</p>
    </Modal>
  )
}

export default ConfirmDialog
