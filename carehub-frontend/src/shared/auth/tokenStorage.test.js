import { describe, expect, it } from 'vitest'
import { tokenStorage } from './tokenStorage.js'

describe('tokenStorage', () => {
  it('L1-FE-36 | EP-Valid: tokens round-trip through sessionStorage under the carehub.* keys', () => {
    tokenStorage.setAccessToken('access-1')
    tokenStorage.setRefreshToken('refresh-1')

    expect(tokenStorage.getAccessToken()).toBe('access-1')
    expect(tokenStorage.getRefreshToken()).toBe('refresh-1')
    expect(tokenStorage.hasAccessToken()).toBe(true)
    expect(window.sessionStorage.getItem('carehub.accessToken')).toBe('access-1')
    expect(window.sessionStorage.getItem('carehub.refreshToken')).toBe('refresh-1')
  })

  it.each([[null], [undefined], ['']])(
    'L1-FE-37 | EP-Invalid: setting a falsy token (%s) removes the stored entry',
    (falsy) => {
      tokenStorage.setAccessToken('access-1')
      tokenStorage.setRefreshToken('refresh-1')
      tokenStorage.setAccessToken(falsy)
      tokenStorage.setRefreshToken(falsy)

      expect(tokenStorage.getAccessToken()).toBeNull()
      expect(tokenStorage.getRefreshToken()).toBeNull()
      expect(tokenStorage.hasAccessToken()).toBe(false)
    },
  )

  it('L1-FE-38 | EP: requiresFirstLoginSetup is stored as the strings "true"/"false"', () => {
    tokenStorage.setRequiresFirstLoginSetup(true)
    expect(window.sessionStorage.getItem('carehub.requiresFirstLoginSetup')).toBe('true')
    expect(tokenStorage.getRequiresFirstLoginSetup()).toBe(true)

    tokenStorage.setRequiresFirstLoginSetup(false)
    expect(window.sessionStorage.getItem('carehub.requiresFirstLoginSetup')).toBe('false')
    expect(tokenStorage.getRequiresFirstLoginSetup()).toBe(false)

    window.sessionStorage.setItem('carehub.requiresFirstLoginSetup', 'TRUE')
    expect(tokenStorage.getRequiresFirstLoginSetup()).toBe(false)
  })

  it('L1-FE-39 | State: clear() removes every carehub key and the legacy localStorage token', () => {
    tokenStorage.setAccessToken('access-1')
    tokenStorage.setRefreshToken('refresh-1')
    tokenStorage.setRequiresFirstLoginSetup(true)
    window.localStorage.setItem('token', 'legacy')
    tokenStorage.clear()

    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.getRefreshToken()).toBeNull()
    expect(tokenStorage.getRequiresFirstLoginSetup()).toBe(false)
    expect(window.sessionStorage.getItem('carehub.requiresFirstLoginSetup')).toBeNull()
    expect(window.localStorage.getItem('token')).toBeNull()
  })
})
