const VALID_STATUS_VALUES = new Set(['SUBMITTED', 'DRAFT', 'CANCELLED'])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function normalizePositiveInteger(value) {
  if (value == null || value === '') return ''
  const text = String(value).trim()
  if (!/^\d+$/.test(text)) return ''
  const number = Number(text)
  return Number.isSafeInteger(number) && number > 0 ? String(number) : ''
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return VALID_STATUS_VALUES.has(normalized) ? normalized : ''
}

function normalizeDate(value) {
  const normalized = String(value || '').trim()
  return isValidIsoDate(normalized) ? normalized : ''
}

function createEmptyTrainingFilters() {
  return {
    q: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    professionalFieldId: '',
    activityTypeId: '',
    page: 1,
  }
}

function parseTrainingQuery(search = '') {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search)
  const rawPage = Number(params.get('page'))
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1

  return {
    q: (params.get('q') || '').trim(),
    status: normalizeStatus(params.get('status')),
    dateFrom: normalizeDate(params.get('dateFrom')),
    dateTo: normalizeDate(params.get('dateTo')),
    professionalFieldId: normalizePositiveInteger(params.get('professionalFieldId')),
    activityTypeId: normalizePositiveInteger(params.get('activityTypeId')),
    page,
  }
}

function serializeTrainingQuery(filters = {}) {
  const params = new URLSearchParams()
  const q = String(filters.q || '').trim()
  const status = normalizeStatus(filters.status)
  const dateFrom = normalizeDate(filters.dateFrom)
  const dateTo = normalizeDate(filters.dateTo)
  const professionalFieldId = normalizePositiveInteger(filters.professionalFieldId)
  const activityTypeId = normalizePositiveInteger(filters.activityTypeId)
  const page = Number(filters.page)

  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo) params.set('dateTo', dateTo)
  if (professionalFieldId) params.set('professionalFieldId', professionalFieldId)
  if (activityTypeId) params.set('activityTypeId', activityTypeId)
  if (Number.isSafeInteger(page) && page > 1) params.set('page', String(page))

  return params
}

function buildTrainingAllUrl(filters = {}) {
  const query = serializeTrainingQuery(filters).toString()
  return query ? `/staff/training/all?${query}` : '/staff/training/all'
}

function toTrainingListApiParams(filters = {}, employeeId, size = 10) {
  const parsed = parseTrainingQuery(serializeTrainingQuery(filters))
  return {
    page: parsed.page - 1,
    size,
    titleKeyword: parsed.q || undefined,
    workflowStatus: parsed.status || undefined,
    dateFrom: parsed.dateFrom || undefined,
    dateTo: parsed.dateTo || undefined,
    professionalFieldId: parsed.professionalFieldId ? Number(parsed.professionalFieldId) : undefined,
    activityTypeId: parsed.activityTypeId ? Number(parsed.activityTypeId) : undefined,
    ...(employeeId != null ? { employeeId } : {}),
  }
}

function isDateRangeValid(dateFrom, dateTo) {
  const from = normalizeDate(dateFrom)
  const to = normalizeDate(dateTo)
  return Boolean((!dateFrom || from) && (!dateTo || to)) && (!from || !to || from <= to)
}

function countActiveFilterGroups(filters = {}) {
  return [
    Boolean(normalizeStatus(filters.status)),
    Boolean(normalizeDate(filters.dateFrom) || normalizeDate(filters.dateTo)),
    Boolean(normalizePositiveInteger(filters.professionalFieldId)),
    Boolean(normalizePositiveInteger(filters.activityTypeId)),
  ].filter(Boolean).length
}

export {
  VALID_STATUS_VALUES,
  buildTrainingAllUrl,
  countActiveFilterGroups,
  createEmptyTrainingFilters,
  isDateRangeValid,
  isValidIsoDate,
  parseTrainingQuery,
  serializeTrainingQuery,
  toTrainingListApiParams,
}
