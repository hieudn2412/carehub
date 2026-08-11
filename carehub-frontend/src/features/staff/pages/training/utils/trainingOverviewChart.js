const HOURS_FORMATTER = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 2,
})

export function formatChartNumber(value) {
  const numericValue = Number(value)
  return HOURS_FORMATTER.format(Number.isFinite(numericValue) ? numericValue : 0)
}

export function formatChartHours(value) {
  return `${formatChartNumber(value)} giờ`
}

export function truncateChartLabel(value, maxLength = 18) {
  const label = String(value || 'Chưa xác định')
  if (label.length <= maxLength) return label

  const candidate = label.slice(0, maxLength - 1).trimEnd()
  const lastSpaceIndex = candidate.lastIndexOf(' ')
  const truncated = lastSpaceIndex >= Math.floor(maxLength * 0.6)
    ? candidate.slice(0, lastSpaceIndex)
    : candidate
  return `${truncated}…`
}

export function normalizeChartYears(availableYears, selectedYear) {
  return [...new Set([selectedYear, ...(availableYears || [])]
    .map(Number)
    .filter(year => Number.isInteger(year)))]
    .sort((left, right) => right - left)
}
