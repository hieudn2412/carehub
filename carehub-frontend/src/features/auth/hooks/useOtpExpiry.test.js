import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOtpExpiresAt, useOtpExpiry } from './useOtpExpiry.js'

/**
 * L1 unit tests — sheet Frontend, Test ID prefix L1-FE (IDs 40–43 live here).
 *
 * Traces AC-01-02 / BR-30 (a reset credential is short-lived). BV reference: the OTP countdown
 * default is 300 s (5 minutes), matching FirstLoginServiceImpl.OTP_EXPIRY_MINUTES.
 *
 * Time is faked so the boundaries (300 s / 1 s / 0 s) are exact rather than wall-clock dependent.
 */
describe('useOtpExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('L1-FE-40 | BVA-Max: a fresh expiry starts at the full 300 s window, formatted 05:00', () => {
    const { result } = renderHook(() => useOtpExpiry(createOtpExpiresAt()))

    expect(result.current.formattedRemaining).toBe('05:00')
    expect(result.current.isExpired).toBe(false)
  })

  it('L1-FE-41 | BVA-Min: 1 s left is not expired; 0 s left is', () => {
    const { result } = renderHook(() => useOtpExpiry(Date.now() + 1000))

    expect(result.current.formattedRemaining).toBe('00:01')
    expect(result.current.isExpired).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.formattedRemaining).toBe('00:00')
    expect(result.current.isExpired).toBe(true)
  })

  it('L1-FE-42 | BVA-Min-1: an expiry already in the past clamps to 0 rather than going negative', () => {
    const { result } = renderHook(() => useOtpExpiry(Date.now() - 60_000))

    expect(result.current.formattedRemaining).toBe('00:00')
    expect(result.current.isExpired).toBe(true)
  })

  it('L1-FE-43 | State: resetExpiry restarts the countdown at the configured duration', () => {
    const { result } = renderHook(() => useOtpExpiry(Date.now() + 1000, 120))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.isExpired).toBe(true)

    act(() => {
      result.current.resetExpiry()
    })

    expect(result.current.isExpired).toBe(false)
    expect(result.current.formattedRemaining).toBe('02:00')
  })

  it('L1-FE-44 | EP-Invalid: a non-numeric initial expiry falls back to a fresh default window', () => {
    const { result } = renderHook(() => useOtpExpiry('not-a-number'))

    expect(result.current.formattedRemaining).toBe('05:00')
    expect(result.current.isExpired).toBe(false)
  })
})
