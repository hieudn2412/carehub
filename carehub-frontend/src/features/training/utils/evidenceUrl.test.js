import { afterEach, describe, expect, it, vi } from 'vitest'
import { openEvidenceUrl, resolveEvidenceUrl } from './evidenceUrl.js'

/**
 * L1 unit tests — sheet Frontend, Test ID prefix L1-FE (IDs 45–50 live here).
 *
 * Migrated from node:test to vitest so the whole frontend suite runs under one runner
 * (`npm test`); the three original assertions are kept as L1-FE-45…47.
 */
describe('resolveEvidenceUrl', () => {
  it('L1-FE-45 | EP-Valid: an absolute URL is returned unchanged', () => {
    expect(resolveEvidenceUrl('https://cdn.example.com/file.png'))
      .toBe('https://cdn.example.com/file.png')
  })

  it('L1-FE-46 | EP-Valid: a relative URL is joined onto the API origin', () => {
    expect(resolveEvidenceUrl('/api/v1/files/1')).toBe('http://localhost:8081/api/v1/files/1')
  })

  it('L1-FE-47 | EP-Invalid: an empty or null URL yields an empty string', () => {
    expect(resolveEvidenceUrl('')).toBe('')
    expect(resolveEvidenceUrl(null)).toBe('')
  })

  it.each([[undefined], [42], [{}], [[]], [true]])(
    'L1-FE-48 | EP-Invalid: a non-string value (%s) yields an empty string',
    (value) => {
      expect(resolveEvidenceUrl(value)).toBe('')
    },
  )
})

describe('openEvidenceUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('L1-FE-49 | BC-TRUE: a resolvable URL is opened in a new tab with noopener', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    expect(openEvidenceUrl('/api/v1/files/1')).toBe(true)
    expect(open).toHaveBeenCalledWith(
      'http://localhost:8081/api/v1/files/1',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('L1-FE-50 | BC-FALSE: an unresolvable URL returns false and opens nothing', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    expect(openEvidenceUrl('')).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })
})
