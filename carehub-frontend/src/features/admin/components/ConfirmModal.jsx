import { CloseOutlined } from '@ant-design/icons'

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Xác nhận', cancelText = 'Hủy', danger = false }) {
  if (!isOpen) return null

  return (
    <div className="am-modal-overlay" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div className="am-modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <div className="am-modal-header">
          <h3 className="am-modal-title">{title}</h3>
          <button className="am-modal-close" onClick={onCancel}>
            <CloseOutlined />
          </button>
        </div>
        <div className="am-modal-body">
          <p style={{ fontSize: '14.5px', color: '#334155', marginBottom: '24px', lineHeight: '1.5', textAlign: 'left' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button 
              type="button"
              className="am-modal-btn" 
              style={{ background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }}
              onClick={onCancel}
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
