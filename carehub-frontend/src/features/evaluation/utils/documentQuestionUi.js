export const DOCUMENT_STATUS_LABELS = {
  READY: 'Sẵn sàng',
  OCR_REQUIRED: 'Cần OCR',
  FAILED: 'Thất bại',
}

export const JOB_STATUS_LABELS = {
  CREATED: 'Đã tạo',
  GENERATING: 'Đang tạo',
  GENERATED: 'Đã tạo xong',
  VALIDATING: 'Đang kiểm tra',
  COMPLETED: 'Hoàn tất',
  PARTIALLY_COMPLETED: 'Hoàn thành một phần',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
}

export const CANDIDATE_STATUS_LABELS = {
  GENERATED: 'Đã sinh',
  VALIDATED: 'Đã kiểm tra',
  NEED_REVIEW: 'Cần xem xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  SAVED: 'Đã lưu',
}

export const CANDIDATE_LABELS = {
  GOOD: 'Đạt',
  NEED_REVIEW: 'Cần xem xét',
  REJECTED: 'Đã từ chối',
}

export const DIFFICULTY_LABELS = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
}

export const QUALITY_FLAG_LABELS = {
  LOW_INFORMATION_DENSITY: 'Ít thông tin',
  LOW_SECTION_CONFIDENCE: 'Section chưa chắc chắn',
  ABOVE_TARGET_TOKEN_RANGE: 'Vượt target token',
}

export function apiData(response, fallback = null) {
  return response?.data?.data ?? fallback
}

export function apiErrorMessage(error) {
  return error?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.'
}

export function documentStatusText(document) {
  return document?.statusText || DOCUMENT_STATUS_LABELS[document?.status] || 'Không xác định'
}

export function jobStatusText(job) {
  return job?.statusText || JOB_STATUS_LABELS[job?.status] || 'Không xác định'
}

export function candidateStatusText(candidate) {
  return candidate?.statusText || CANDIDATE_STATUS_LABELS[candidate?.status] || 'Không xác định'
}

export function candidateLabelText(candidate) {
  return candidate?.labelText || CANDIDATE_LABELS[candidate?.label] || ''
}

export function difficultyText(value) {
  return DIFFICULTY_LABELS[value] || value || 'Chưa phân loại'
}

export function statusTone(status) {
  if (['READY', 'GOOD', 'APPROVED', 'VALIDATED', 'GENERATED', 'COMPLETED'].includes(status)) return 'success'
  if (['OCR_REQUIRED', 'NEED_REVIEW', 'PARTIALLY_COMPLETED', 'GENERATING', 'CREATED', 'VALIDATING'].includes(status)) return 'warning'
  if (['FAILED', 'REJECTED', 'CANCELLED'].includes(status)) return 'danger'
  if (['SAVED'].includes(status)) return 'info'
  return 'neutral'
}

export function formatDateTime(value) {
  if (!value) return '---'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '0'
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

export function shortHash(value) {
  if (!value) return '---'
  return value.length <= 12 ? value : value.slice(0, 12)
}

export function parseJsonList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function qualityFlagsText(value) {
  const flags = parseJsonList(value)
  if (!flags.length) return 'Không có'
  return flags.map((flag) => QUALITY_FLAG_LABELS[flag] || flag).join(', ')
}

export function normalizeText(value) {
  return String(value || '').toLowerCase().trim()
}
