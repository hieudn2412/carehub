import { describe, expect, it } from 'vitest'
import {
  ADMIN_ROLES,
  EVALUATION_PERMISSIONS,
  getDefaultAuthenticatedRoute,
  getPostLoginRoute,
  hasAnyPermission,
  hasAnyRole,
  isPathAllowedForAccess,
  isPathAllowedForRoles,
} from './authNavigation.js'

/**
 * L1 unit tests — sheet Frontend, Test ID prefix L1-FE (IDs 24–31 live here).
 *
 * Traces NAC-01-03 (a non-admin must not reach admin screens) and the role-based routing rules in
 * the Screen Design Spec. `isPathAllowedForAccess` is a disjunction
 * (`hasAnyRole(ADMIN) || hasAnyPermission(EVALUATION_PERMISSIONS)`), so both sides are driven
 * TRUE and FALSE independently.
 */
function accessToken({ roles = [], permissions = [] } = {}) {
  const header = window.btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = window.btoa(JSON.stringify({ sub: '1', roles, permissions }))
  return `${header}.${payload}.signature`
}

describe('hasAnyRole', () => {
  it('L1-FE-24 | BC-TRUE: an empty allow-list means "no restriction" → always true', () => {
    expect(hasAnyRole([], [])).toBe(true)
    expect(hasAnyRole(['USER'], undefined)).toBe(true)
  })

  it('L1-FE-25 | EP: the ROLE_ prefix and casing are normalised on both sides', () => {
    expect(hasAnyRole(['ROLE_ADMIN'], ['ADMIN'])).toBe(true)
    expect(hasAnyRole(['admin'], ['ROLE_ADMIN'])).toBe(true)
    expect(hasAnyRole(['ROLE_USER'], ADMIN_ROLES)).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('L1-FE-26 | BC-FALSE: an empty allow-list denies (opposite of hasAnyRole)', () => {
    expect(hasAnyPermission(['QUESTION_AUTHOR'], [])).toBe(false)
    expect(hasAnyPermission(['QUESTION_AUTHOR'], undefined)).toBe(false)
  })

  it('L1-FE-27 | CC-TRUE: an ADMIN role short-circuits the permission check', () => {
    expect(hasAnyPermission([], EVALUATION_PERMISSIONS, ['ROLE_ADMIN'])).toBe(true)
    expect(hasAnyPermission([], EVALUATION_PERMISSIONS, ['ROLE_USER'])).toBe(false)
  })

  it('L1-FE-28 | EP: a matching evaluation permission grants access without any role', () => {
    expect(hasAnyPermission(['RESULT_VIEWER'], EVALUATION_PERMISSIONS)).toBe(true)
    expect(hasAnyPermission(['SOMETHING_ELSE'], EVALUATION_PERMISSIONS)).toBe(false)
  })
})

describe('getDefaultAuthenticatedRoute', () => {
  it.each([
    [{ roles: ['ROLE_ADMIN'] }, '/admin/dashboard'],
    [{ roles: ['ROLE_MANAGER'] }, '/manager/dashboard'],
    [{ roles: ['ROLE_USER'] }, '/staff/dashboard'],
    [{ roles: [], permissions: ['QUESTION_REVIEWER'] }, '/admin/evaluation/dashboard'],
    [{ roles: [], permissions: [] }, '/training'],
  ])('L1-FE-29 | EP: %j → %s', ({ roles = [], permissions = [] }, expected) => {
    expect(getDefaultAuthenticatedRoute(roles, permissions)).toBe(expected)
  })

  it('L1-FE-30 | EP: ADMIN outranks an evaluation permission and MANAGER', () => {
    expect(getDefaultAuthenticatedRoute(['ROLE_ADMIN', 'ROLE_MANAGER'], ['RESULT_VIEWER']))
      .toBe('/admin/dashboard')
    // Evaluation permissions are checked before the MANAGER role.
    expect(getDefaultAuthenticatedRoute(['ROLE_MANAGER'], ['RESULT_VIEWER']))
      .toBe('/admin/evaluation/dashboard')
  })
})

describe('isPathAllowedForRoles / isPathAllowedForAccess', () => {
  it('L1-FE-31 | CC: /admin/** needs ADMIN; /admin/evaluation/** also accepts an evaluation permission', () => {
    // isPathAllowedForRoles: only the role side.
    expect(isPathAllowedForRoles('/admin/accounts', ['ROLE_ADMIN'])).toBe(true)
    expect(isPathAllowedForRoles('/admin/accounts', ['ROLE_MANAGER'])).toBe(false)
    expect(isPathAllowedForRoles('/staff/dashboard', ['ROLE_USER'])).toBe(true)
    expect(isPathAllowedForRoles('', ['ROLE_ADMIN'])).toBe(false)

    // isPathAllowedForAccess: the evaluation branch adds the permission side.
    expect(isPathAllowedForAccess('/admin/evaluation/question-bank', ['ROLE_ADMIN'], [])).toBe(true)
    expect(isPathAllowedForAccess('/admin/evaluation/question-bank', [], ['QUESTION_AUTHOR'])).toBe(true)
    expect(isPathAllowedForAccess('/admin/evaluation/question-bank', ['ROLE_USER'], [])).toBe(false)
    // A non-evaluation admin path is NOT opened up by an evaluation permission.
    expect(isPathAllowedForAccess('/admin/accounts', [], ['QUESTION_AUTHOR'])).toBe(false)
  })
})

describe('getPostLoginRoute', () => {
  it('L1-FE-32 | EP-Valid: an allowed requested path is honoured', () => {
    const token = accessToken({ roles: ['ROLE_ADMIN'] })

    expect(getPostLoginRoute(token, '/admin/accounts')).toBe('/admin/accounts')
  })

  it('L1-FE-33 | BC-FALSE: a forbidden requested path falls back to the role default', () => {
    const token = accessToken({ roles: ['ROLE_USER'] })

    expect(getPostLoginRoute(token, '/admin/accounts')).toBe('/staff/dashboard')
  })

  it('L1-FE-34 | EP-Invalid: a malformed or missing token yields the unauthenticated default', () => {
    expect(getPostLoginRoute(undefined, '/admin/accounts')).toBe('/training')
    expect(getPostLoginRoute('not-a-jwt', '/admin/accounts')).toBe('/training')
    expect(getPostLoginRoute('a.!!!not-base64!!!.c', '/admin/accounts')).toBe('/training')
  })

  it('L1-FE-35 | EP: an evaluation-permission user is routed into the evaluation dashboard', () => {
    const token = accessToken({ roles: [], permissions: ['EXAM_PUBLISHER'] })

    expect(getPostLoginRoute(token, '/admin/evaluation/exam-papers')).toBe('/admin/evaluation/exam-papers')
    expect(getPostLoginRoute(token, '/admin/accounts')).toBe('/admin/evaluation/dashboard')
  })
})
