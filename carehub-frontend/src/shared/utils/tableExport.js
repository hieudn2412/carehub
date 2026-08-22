/**
 * Xuất bảng đang hiển thị ra file mở được bằng Excel.
 *
 * Dự án không cài thư viện sinh .xlsx ở phía trình duyệt (xem README mục Hiệu năng), nên file
 * xuất ra là CSV có BOM UTF-8 — Excel nhận đúng tiếng Việt khi mở trực tiếp. Cùng khuôn với
 * các chỗ xuất dữ liệu đã có trong dự án, nhưng gom lại một chỗ để mọi màn hình xuất giống nhau.
 */

/** Bọc một ô CSV: luôn có nháy kép để dấu phẩy và xuống dòng trong dữ liệu không phá cấu trúc. */
export function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

/**
 * Ghép tiêu đề cột và các dòng thành nội dung CSV.
 *
 * @param {string[]} headers tên cột
 * @param {Array<Array<string|number|null|undefined>>} rows dữ liệu theo đúng thứ tự cột
 */
export function buildCsv(headers, rows) {
  return [headers, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n')
}

/** Tên file kèm ngày local, ví dụ `nhan-su-dao-tao-2026-08-20.csv`. */
export function exportFileName(prefix, date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return `${prefix}-${localDate.toISOString().slice(0, 10)}.csv`
}

/**
 * Tải nội dung CSV về máy người dùng.
 * Tách riêng để test được `buildCsv` mà không cần DOM.
 */
export function downloadCsv(fileName, headers, rows) {
  const blob = new Blob(['﻿', buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
