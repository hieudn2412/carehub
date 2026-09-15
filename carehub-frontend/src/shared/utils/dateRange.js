export function formatLocalDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentYearDateRange(referenceDate = new Date()) {
  return {
    fromDate: `${referenceDate.getFullYear()}-01-01`,
    toDate: formatLocalDate(referenceDate),
  }
}

export function isValidDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return false

  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
}

export function validateHistoricalDateRange(fromDate, toDate, options = {}) {
  const {
    maxDate = formatLocalDate(),
    required = true,
  } = options

  if (required && !fromDate && !toDate) return 'Vui lòng chọn Từ ngày và Đến ngày.'
  if (required && !fromDate) return 'Vui lòng chọn Từ ngày.'
  if (required && !toDate) return 'Vui lòng chọn Đến ngày.'
  if (fromDate && !isValidDateInput(fromDate)) return 'Từ ngày không hợp lệ.'
  if (toDate && !isValidDateInput(toDate)) return 'Đến ngày không hợp lệ.'
  if (fromDate && toDate && fromDate > toDate) return 'Đến ngày phải lớn hơn hoặc bằng Từ ngày.'
  if (maxDate && fromDate && fromDate > maxDate) return 'Từ ngày không được sau ngày hiện tại.'
  if (maxDate && toDate && toDate > maxDate) return 'Đến ngày không được sau ngày hiện tại.'

  return ''
}
