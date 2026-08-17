export function apiData(response, fallback = null) {
  return response?.data?.data ?? fallback
}

export function apiErrorMessage(error) {
  return error?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
}

export function formatDateTime(value) {
  if (!value) return '---'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${hours}:${minutes} ${day}/${month}/${year}`
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '0'
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}
