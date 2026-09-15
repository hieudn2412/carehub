const DOCUMENT_STATUS_LABELS = {
  READY: 'Sẵn sàng',
  OCR_REQUIRED: 'Cần OCR',
  FAILED: 'Thất bại',
}

const JOB_STATUS_LABELS = {
  CREATED: 'Đã tạo',
  GENERATING: 'Đang tạo',
  GENERATED: 'Đã tạo xong',
  VALIDATING: 'Đang kiểm tra',
  COMPLETED: 'Hoàn tất',
  PARTIALLY_COMPLETED: 'Hoàn thành một phần',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
}

const CANDIDATE_STATUS_LABELS = {
  GENERATED: 'Đã sinh',
  VALIDATED: 'Đã kiểm tra',
  NEED_REVIEW: 'Cần xem xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  SAVED: 'Đã lưu',
}

const CANDIDATE_LABELS = {
  GOOD: 'Đạt',
  NEED_REVIEW: 'Cần xem xét',
  REJECTED: 'Đã từ chối',
}

export const COGNITIVE_LEVELS = [
  { value: 'FOUNDATION', label: 'Kiến thức nền tảng' },
  { value: 'CLINICAL_APPLICATION', label: 'Áp dụng lâm sàng' },
  { value: 'CLINICAL_REASONING_ANALYSIS', label: 'Tư duy phân tích' },
]

const COGNITIVE_LEVEL_LABELS = Object.fromEntries(
  COGNITIVE_LEVELS.map((level) => [level.value, level.label]),
)

const BLOCKING_CHUNK_FLAGS = new Set([
  'LOW_INFORMATION_DENSITY',
  'HEADING_ONLY',
  'DUPLICATE_TEXT',
  'TABLE_LIKE_LOW_CONFIDENCE',
])

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

function chunkQualityFlags(value) {
  return parseJsonList(value).filter((flag) => typeof flag === 'string' && flag.trim())
}

export function chunkGenerationEligible(chunk) {
  return chunkQualityFlags(chunk?.qualityFlags).every((flag) => !BLOCKING_CHUNK_FLAGS.has(flag))
}

export function normalizeText(value) {
  return String(value || '').toLowerCase().trim()
}
export {
  apiData,
  apiErrorMessage,
  formatDateTime,
  formatNumber,
} from '../../../shared/utils/apiUi.js'
