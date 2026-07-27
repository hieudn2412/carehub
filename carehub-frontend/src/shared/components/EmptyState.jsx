/**
 * Trạng thái rỗng dùng chung.
 */
function EmptyState({ children = 'Không có dữ liệu.' }) {
  return <div className="ch-empty">{children}</div>
}

export default EmptyState
