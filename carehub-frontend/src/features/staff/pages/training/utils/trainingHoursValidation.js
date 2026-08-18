const MIN_TRAINING_HOURS = 0.5
const MAX_TRAINING_HOURS = 999
const DECIMAL_HOURS_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

function getTrainingHoursValidationError(value) {
  const normalized = String(value ?? '').trim()

  if (!normalized) return 'Bắt buộc nhập số giờ'
  if (!DECIMAL_HOURS_PATTERN.test(normalized)) {
    return 'Số giờ đào tạo không đúng định dạng. Vui lòng nhập một số hợp lệ.'
  }

  const hours = Number(normalized)
  if (!Number.isFinite(hours)) {
    return 'Số giờ đào tạo không đúng định dạng. Vui lòng nhập một số hợp lệ.'
  }
  if (hours < 0) return 'Số giờ đào tạo không được là số âm.'
  if (hours < MIN_TRAINING_HOURS) return `Số giờ đào tạo phải từ ${MIN_TRAINING_HOURS} giờ trở lên.`
  if (hours > MAX_TRAINING_HOURS) return `Số giờ đào tạo không được vượt quá ${MAX_TRAINING_HOURS} giờ.`

  return ''
}

export {
  MAX_TRAINING_HOURS,
  getTrainingHoursValidationError,
}
