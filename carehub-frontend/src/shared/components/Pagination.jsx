/**
 * Pagination chuẩn (page 0-based, khớp PageResponse của backend).
 * Tự ẩn khi chỉ có 1 trang.
 */
function Pagination({ page, totalPages, totalElements, onChange }) {
  if (!totalPages || totalPages <= 1) return null

  return (
    <div className="ch-pagination">
      {totalElements != null && <span>{totalElements} bản ghi</span>}
      <button type="button" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        Trước
      </button>
      <span>
        Trang {page + 1} / {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Sau
      </button>
    </div>
  )
}

export default Pagination
