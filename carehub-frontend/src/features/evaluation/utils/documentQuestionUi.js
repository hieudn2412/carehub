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

export const COGNITIVE_LEVELS = [
  { value: 'FOUNDATION', label: 'Kiến thức nền tảng' },
  { value: 'CLINICAL_APPLICATION', label: 'Áp dụng lâm sàng' },
  { value: 'CLINICAL_REASONING_ANALYSIS', label: 'Tư duy phân tích' },
]

export const COGNITIVE_LEVEL_LABELS = Object.fromEntries(
  COGNITIVE_LEVELS.map((level) => [level.value, level.label]),
)

export const QUALITY_FLAG_LABELS = {
  LOW_INFORMATION_DENSITY: 'Ít thông tin',
  HEADING_ONLY: 'Chỉ có heading',
  DUPLICATE_TEXT: 'Trùng nội dung',
  TABLE_LIKE_LOW_CONFIDENCE: 'Bảng/layout chưa chắc chắn',
  LOW_SECTION_CONFIDENCE: 'Section chưa chắc chắn',
  ABOVE_TARGET_TOKEN_RANGE: 'Vượt target token',
}

const BLOCKING_CHUNK_FLAGS = new Set([
  'LOW_INFORMATION_DENSITY',
  'HEADING_ONLY',
  'DUPLICATE_TEXT',
  'TABLE_LIKE_LOW_CONFIDENCE',
])

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

export function shouldShowCandidateLabelBadge(candidate) {
  return Boolean(candidate?.label)
    && candidateLabelText(candidate) !== candidateStatusText(candidate)
}

export function cognitiveLevelText(value) {
  return COGNITIVE_LEVEL_LABELS[value] || value || 'Chưa phân loại nhận thức'
}

export function formatCognitiveWarningText(warning) {
  if (!warning || typeof warning !== 'string') return warning
  return warning
    .replace(/\bFOUNDATION\b/g, 'Kiến thức nền tảng')
    .replace(/\bCLINICAL_APPLICATION\b/g, 'Áp dụng lâm sàng')
    .replace(/\bCLINICAL_REASONING_ANALYSIS\b/g, 'Tư duy phân tích')
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
  const flags = chunkQualityFlags(value)
  if (!flags.length) return 'Không có'
  return flags.map((flag) => QUALITY_FLAG_LABELS[flag] || flag).join(', ')
}

export function chunkQualityFlags(value) {
  return parseJsonList(value).filter((flag) => typeof flag === 'string' && flag.trim())
}

export function chunkGenerationEligible(chunk) {
  return chunkQualityFlags(chunk?.qualityFlags).every((flag) => !BLOCKING_CHUNK_FLAGS.has(flag))
}

export function chunkGenerationText(chunk) {
  return chunkGenerationEligible(chunk) ? 'Có thể tạo câu hỏi' : 'Bỏ qua'
}

export function normalizeText(value) {
  return String(value || '').toLowerCase().trim()
}
