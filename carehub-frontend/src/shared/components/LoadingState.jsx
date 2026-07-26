/**
 * Trạng thái đang tải dùng chung — thay cho ~70 chuỗi "Đang tải..." viết tay.
 * Có role="status" + aria-live để screen reader đọc được.
 */
function LoadingState({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="ch-empty" role="status" aria-live="polite">
      <span className="ch-spinner" aria-hidden="true" /> {label}
    </div>
  )
}

export default LoadingState
