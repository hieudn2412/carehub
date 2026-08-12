import { describe, expect, it } from 'vitest'
import {
  ExamTimerContractError,
  createMonotonicDeadline,
  hasTimezoneOffset,
  parseRemainingSeconds,
  resolveRemainingSeconds,
  secondsUntil,
} from './examTimer.js'

describe('examTimer', () => {
  it.each([
    [1800, 1800],
    ['1800', 1800],
    [1.1, 2],
    [0, 0],
  ])('parses a valid remaining duration %s as %s seconds', (value, expected) => {
    expect(parseRemainingSeconds(value)).toBe(expected)
  })

  it.each([undefined, null, '', ' ', -1, Number.NaN, Number.POSITIVE_INFINITY, true])(
    'rejects an invalid duration %s',
    (value) => {
      expect(() => parseRemainingSeconds(value)).toThrow(ExamTimerContractError)
    },
  )

  it('uses a monotonic deadline and never becomes negative', () => {
    const deadline = createMonotonicDeadline(1800, 10_000)

    expect(secondsUntil(deadline, 10_000)).toBe(1800)
    expect(secondsUntil(deadline, 10_001)).toBe(1800)
    expect(secondsUntil(deadline, 1_010_001)).toBe(800)
    expect(secondsUntil(deadline, 1_000_000_000)).toBe(0)
  })

  it.each([
    ['2026-08-12T08:30:00Z', true],
    ['2026-08-12T15:30:00+07:00', true],
    ['2026-08-12T08:30:00', false],
  ])('recognizes explicit timezone offset in %s', (timestamp, expected) => {
    expect(hasTimezoneOffset(timestamp)).toBe(expected)
  })

  it('prefers the server duration over the client wall clock', () => {
    expect(resolveRemainingSeconds({ remainingSeconds: 1800, expiresAt: 'invalid' }, 0)).toBe(1800)
  })

  it('supports the old timestamp fallback only when the offset is explicit', () => {
    const wallClockNow = Date.parse('2026-08-12T08:00:00Z')

    expect(resolveRemainingSeconds({ expiresAt: '2026-08-12T08:30:00Z' }, wallClockNow)).toBe(1800)
    expect(resolveRemainingSeconds({ expiresAt: '2026-08-12T15:30:00+07:00' }, wallClockNow)).toBe(1800)
    expect(() => resolveRemainingSeconds({ expiresAt: '2026-08-12T08:30:00' }, wallClockNow))
      .toThrow(ExamTimerContractError)
  })

  it('clamps an expired fallback timestamp to zero', () => {
    const wallClockNow = Date.parse('2026-08-12T08:00:00Z')

    expect(resolveRemainingSeconds({ expiresAt: '2026-08-12T07:59:59Z' }, wallClockNow)).toBe(0)
  })
})
