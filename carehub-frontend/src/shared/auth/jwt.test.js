import { describe, expect, it } from 'vitest'
import { getPermissionsFromAccessToken, getRolesFromAccessToken } from './jwt.js'

function token(payload) {
  const encoded = window.btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `header.${encoded}.signature`
}

describe('JWT claim helpers', () => {
  it('returns the non-empty roles and permissions from a valid token', () => {
    const accessToken = token({
      roles: ['ROLE_USER', '', null, 'ROLE_MANAGER'],
      permissions: ['RESULT_VIEWER', undefined, 'QUESTION_AUTHOR'],
    })

    expect(getRolesFromAccessToken(accessToken)).toEqual(['ROLE_USER', 'ROLE_MANAGER'])
    expect(getPermissionsFromAccessToken(accessToken)).toEqual(['RESULT_VIEWER', 'QUESTION_AUTHOR'])
  })

  it.each([undefined, '', 'not-a-jwt', 'header.!!!.signature'])(
    'returns empty claims for an absent or malformed token: %s',
    (accessToken) => {
      expect(getRolesFromAccessToken(accessToken)).toEqual([])
      expect(getPermissionsFromAccessToken(accessToken)).toEqual([])
    },
  )

  it('ignores claims that are not arrays', () => {
    const accessToken = token({ roles: 'ROLE_ADMIN', permissions: null })

    expect(getRolesFromAccessToken(accessToken)).toEqual([])
    expect(getPermissionsFromAccessToken(accessToken)).toEqual([])
  })
})
