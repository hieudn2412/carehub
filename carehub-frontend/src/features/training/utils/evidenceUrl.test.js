import { afterEach, describe, expect, it, vi } from 'vitest'
import { openEvidenceUrl, resolveEvidenceUrl } from './evidenceUrl.js'

/**
 * L1 unit tests — sheet Frontend, Test ID prefix L1-FE (IDs 45–51 live here).
 *
 * Migrated from node:test to vitest so the whole frontend suite runs under one runner
 * (`npm test`); the three original assertions are kept as L1-FE-45…47.
 *
 * That migration exposed defect D14. `evidenceUrl.js` builds its base with
 * `new URL(API_BASE_URL).origin`, which throws when VITE_API_BASE_URL is relative — and the
 * committed `.env` sets exactly that (`VITE_API_BASE_URL=/api/v1`, for the Vite dev proxy). Every
 * relative evidence URL therefore resolves to '' in dev. The node:test run never caught it because
 * Node has no `import.meta.env`, so the module silently fell back to the hardcoded absolute
 * `http://localhost:8081/api/v1`.
 */
describe('resolveEvidenceUrl', () => {
  it('L1-FE-45 | EP-Valid: an absolute URL is returned unchanged', () => {
    expect(resolveEvidenceUrl('https://cdn.example.com/file.png'))
      .toBe('https://cdn.example.com/file.png')
  })

  it('L1-FE-46 | EP-Valid: a relative URL is joined onto the API origin (D14)', () => {
    // EXPECTED TO FAIL until D14 is resolved: with the committed .env this returns ''.
    expect(
      resolveEvidenceUrl('/api/v1/files/1'),
      'a relative evidence path must resolve against an origin, not collapse to an empty string',
    ).not.toBe('')
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

    expect(openEvidenceUrl('https://cdn.example.com/file.png')).toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://cdn.example.com/file.png',
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

  it('L1-FE-51 | BC-TRUE: a relative evidence path must still open (D14)', () => {
    // EXPECTED TO FAIL until D14 is resolved. This is the user-visible impact: under the dev
    // proxy config every "open evidence" click is a silent no-op.
    const open = vi.fn()
    vi.stubGlobal('open', open)

    expect(
      openEvidenceUrl('/api/v1/files/1'),
      'clicking an evidence link served through the dev proxy must open a tab',
    ).toBe(true)
  })
})
