import { useCallback, useEffect, useMemo, useState } from 'react'

const DEFAULT_OTP_EXPIRY_SECONDS = 5 * 60

export function createOtpExpiresAt(durationSeconds = DEFAULT_OTP_EXPIRY_SECONDS) {
  return Date.now() + durationSeconds * 1000
}

export function useOtpExpiry(
  initialExpiresAt,
  durationSeconds = DEFAULT_OTP_EXPIRY_SECONDS,
) {
  const [expiresAt, setExpiresAt] = useState(
    () => Number(initialExpiresAt) || createOtpExpiresAt(durationSeconds),
  )
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => Math.max(Math.ceil((expiresAt - Date.now()) / 1000), 0),
  )

  useEffect(() => {
    if (remainingSeconds === 0) {
      return undefined
    }

    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(
        Math.ceil((expiresAt - Date.now()) / 1000),
        0,
      )
      setRemainingSeconds(nextRemaining)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [expiresAt, remainingSeconds])

  const resetExpiry = useCallback(() => {
    const nextExpiresAt = createOtpExpiresAt(durationSeconds)
    setExpiresAt(nextExpiresAt)
    setRemainingSeconds(durationSeconds)
    return nextExpiresAt
  }, [durationSeconds])

  const formattedRemaining = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [remainingSeconds])

  return {
    expiresAt,
    formattedRemaining,
    isExpired: remainingSeconds === 0,
    resetExpiry,
  }
}
