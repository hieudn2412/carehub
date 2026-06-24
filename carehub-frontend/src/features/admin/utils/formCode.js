const DEFAULT_MAX_CODE_LENGTH = 50

const LEGACY_CHECKLIST_DISPLAY_CODES = Object.freeze({
  PATIENT_IDENTIFICATION: 'NHAN_DIEN_NGUOI_BENH',
  MEDICATION_SIX_RIGHTS: 'SAU_DUNG_TRONG_SU_DUNG_THUOC',
  HAND_HYGIENE_COMPLIANCE: 'TUAN_THU_VE_SINH_TAY',
  DRESSING_INSTRUMENT_PROCESSING: 'XU_LY_DUNG_CU_THAY_BANG',
  BED_BEDSIDE_TABLE_CLEANING: 'VE_SINH_GIUONG_VA_TU_DAU_GIUONG',
  STRETCHER_CLEANING: 'VE_SINH_BANG_CA',
  PRE_FIRST_SURGERY_CLEANING: 'VE_SINH_TRUOC_CA_MO_DAU_TIEN',
  BETWEEN_SURGERIES_CLEANING: 'VE_SINH_GIUA_HAI_CA_MO',
  END_OF_DAY_OR_CLEANING: 'VE_SINH_CUOI_NGAY_PHONG_MO',
  WEEKLY_OR_CLEANING: 'VE_SINH_HANG_TUAN_PHONG_MO',
  REUSABLE_METAL_INSTRUMENT_PROCESSING: 'XU_LY_DUNG_CU_KIM_LOAI_TAI_SU_DUNG',
  ENDOSCOPE_CLEANING: 'XU_LY_LAM_SACH_DUNG_CU_NOI_SOI',
  HIGH_LEVEL_ENDOSCOPE_DISINFECTION: 'KHU_KHUAN_MUC_DO_CAO_BANG_HOA_CHAT',
  SURGICAL_HAND_SCRUB: 'RUA_TAY_NGOAI_KHOA',
  WOUND_DRESSING: 'THAY_BANG_VET_THUONG',
  IV_INFUSION: 'TIEM_TRUYEN_TINH_MACH',
  INTRAMUSCULAR_INJECTION: 'TIEM_BAP',
  ENEMA: 'THUT_THAO',
})

function normalizeVietnameseText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeVietnameseFormCode(
  value,
  maxLength = DEFAULT_MAX_CODE_LENGTH,
) {
  return normalizeVietnameseText(value)
    .slice(0, maxLength)
    .replace(/_+$/g, '')
}

function createTimestampSuffix() {
  const now = new Date()
  const part = (value) => String(value).padStart(2, '0')

  return [
    now.getFullYear(),
    part(now.getMonth() + 1),
    part(now.getDate()),
    part(now.getHours()),
    part(now.getMinutes()),
    part(now.getSeconds()),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('')
}

export function createChecklistCode(title) {
  const suffix = createTimestampSuffix()
  const fallback = 'BANG_KIEM'
  const normalizedTitle = normalizeVietnameseFormCode(title) || fallback
  const maxTitleLength = DEFAULT_MAX_CODE_LENGTH - suffix.length - 1
  const titlePart = normalizedTitle
    .slice(0, maxTitleLength)
    .replace(/_+$/g, '')

  return `${titlePart || fallback}_${suffix}`
}

export function getChecklistDisplayCode(code) {
  const normalizedCode = normalizeVietnameseFormCode(code)
  return LEGACY_CHECKLIST_DISPLAY_CODES[normalizedCode]
    || normalizedCode
    || String(code ?? '')
}

export function resolveChecklistSearchKeyword(keyword) {
  const normalizedKeyword = normalizeVietnameseText(keyword)
  if (!normalizedKeyword) {
    return ''
  }

  const legacyEntries = Object.entries(LEGACY_CHECKLIST_DISPLAY_CODES)
  const exactEntry = legacyEntries.find(([, displayCode]) => displayCode === normalizedKeyword)
  if (exactEntry) {
    return exactEntry[0]
  }

  const partialMatches = legacyEntries.filter(([, displayCode]) =>
    displayCode.includes(normalizedKeyword),
  )

  return partialMatches.length === 1
    ? partialMatches[0][0]
    : String(keyword ?? '').trim()
}
