export const EMPTY_DATE_TIME = Object.freeze({
  date: '',
  hour: '',
  minute: '',
  meridiem: 'AM',
})

export function isDateTimeEmpty(parts = EMPTY_DATE_TIME) {
  return !parts.date && !parts.hour && !parts.minute
}

export function isDateTimeComplete(parts = EMPTY_DATE_TIME) {
  return Boolean(parts.date && parts.hour && parts.minute && (parts.meridiem === 'AM' || parts.meridiem === 'PM'))
}

export function hasPartialDateTime(parts = EMPTY_DATE_TIME) {
  return !isDateTimeEmpty(parts) && !isDateTimeComplete(parts)
}

export function toApiDateTime(parts = EMPTY_DATE_TIME) {
  if (isDateTimeEmpty(parts)) return ''
  if (!isDateTimeComplete(parts)) return null
  let hour = Number(parts.hour)
  if (parts.meridiem === 'AM' && hour === 12) hour = 0
  if (parts.meridiem === 'PM' && hour !== 12) hour += 12
  return `${parts.date}T${String(hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function dateTimePartsFromApi(value) {
  if (!value) return { ...EMPTY_DATE_TIME }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (!match) return { ...EMPTY_DATE_TIME }
  const hour24 = Number(match[2])
  const meridiem = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return {
    date: match[1],
    hour: String(hour12).padStart(2, '0'),
    minute: match[3],
    meridiem,
  }
}
