import { describe, expect, it } from 'vitest'
import {
  EMPTY_DATE_TIME,
  hasPartialDateTime,
  isDateTimeComplete,
  toApiDateTime,
} from './examDateTime.js'

const parts = (hour, meridiem, minute = '05') => ({
  date: '2026-08-12',
  hour,
  minute,
  meridiem,
})

describe('toApiDateTime', () => {
  it.each([
    ['12 AM', parts('12', 'AM'), '2026-08-12T00:05'],
    ['12 PM', parts('12', 'PM'), '2026-08-12T12:05'],
    ['1 PM', parts('01', 'PM'), '2026-08-12T13:05'],
    ['minute boundary', parts('11', 'AM', '59'), '2026-08-12T11:59'],
  ])('converts %s', (_label, value, expected) => {
    expect(toApiDateTime(value)).toBe(expected)
  })

  it('returns an empty value after clearing and null for an incomplete value', () => {
    expect(toApiDateTime(EMPTY_DATE_TIME)).toBe('')
    expect(toApiDateTime({ ...EMPTY_DATE_TIME, date: '2026-08-12' })).toBeNull()
    expect(hasPartialDateTime({ ...EMPTY_DATE_TIME, date: '2026-08-12' })).toBe(true)
    expect(isDateTimeComplete(parts('01', 'AM'))).toBe(true)
  })
})
