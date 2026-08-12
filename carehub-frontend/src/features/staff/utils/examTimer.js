const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/i

export const EXAM_TIMER_CONTRACT_ERROR = 'Không đồng bộ được thời gian bài thi. Vui lòng tải lại hoặc liên hệ quản trị viên.'

export class ExamTimerContractError extends Error {
  constructor(message = EXAM_TIMER_CONTRACT_ERROR) {
    super(message)
    this.name = 'ExamTimerContractError'
  }
}

function assertFiniteMonotonicTime(value) {
  if (!Number.isFinite(value)) {
    throw new ExamTimerContractError()
  }
  return value
}

/**
 * Validate the server-provided duration. The API normally returns a JSON number,
 * but numeric strings are accepted during the additive rollout.
 */
export function parseRemainingSeconds(value) {
  if (value === null || value === undefined || value === ''
    || (typeof value === 'string' && value.trim() === '')
    || typeof value === 'boolean') {
    throw new ExamTimerContractError()
  }

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new ExamTimerContractError()
  }

  return Math.ceil(numericValue)
}

export function hasTimezoneOffset(timestamp) {
  return typeof timestamp === 'string' && OFFSET_SUFFIX.test(timestamp.trim())
}

function parseOffsetTimestamp(timestamp) {
  if (!hasTimezoneOffset(timestamp)) {
    throw new ExamTimerContractError()
  }

  const timestampMs = Date.parse(timestamp)
  if (!Number.isFinite(timestampMs)) {
    throw new ExamTimerContractError()
  }
  return timestampMs
}

/**
 * Prefer remainingSeconds. The timestamp fallback is only for old backends and
 * is deliberately rejected when it has no explicit timezone offset.
 */
export function resolveRemainingSeconds(attempt, wallClockNow = Date.now()) {
  if (!attempt || typeof attempt !== 'object') {
    throw new ExamTimerContractError()
  }

  if (attempt.remainingSeconds !== null && attempt.remainingSeconds !== undefined) {
    return parseRemainingSeconds(attempt.remainingSeconds)
  }

  if (!Number.isFinite(wallClockNow)) {
    throw new ExamTimerContractError()
  }

  const expiresAtMs = parseOffsetTimestamp(attempt.expiresAt)
  return Math.max(0, Math.ceil((expiresAtMs - wallClockNow) / 1000))
}

export function createMonotonicDeadline(remainingSeconds, monotonicNow = performance.now()) {
  const seconds = parseRemainingSeconds(remainingSeconds)
  assertFiniteMonotonicTime(monotonicNow)
  return monotonicNow + (seconds * 1000)
}

export function secondsUntil(deadline, monotonicNow = performance.now()) {
  assertFiniteMonotonicTime(deadline)
  assertFiniteMonotonicTime(monotonicNow)
  return Math.max(0, Math.ceil((deadline - monotonicNow) / 1000))
}

