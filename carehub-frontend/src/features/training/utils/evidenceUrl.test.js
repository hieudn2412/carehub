import { afterEach, describe, expect, it, vi } from 'vitest'
import { openEvidenceUrl, resolveEvidenceUrl } from './evidenceUrl.js'

/**
 * L1 unit tests — sheet Frontend, Test ID prefix L1-FE (IDs 45–51 live here).
 *
 * Migrated from node:test to vitest so the whole frontend suite runs under one runner
 * (`npm test`); the three original assertions are kept as L1-FE-45…47.
 *
 * That migration exposed defect D14. `evidenceUrl.js` builds its base with
 * `new URL(API_BASE_URL).origin`, which throws when VITE_API_BASE_URL is a relative path — and the
 * TRACKED `.env.example` plus README.md both prescribe exactly that (`VITE_API_BASE_URL=/api/v1`,
 * for the Vite dev proxy). Every relative evidence URL therefore resolves to '' for any developer
 * who follows the documented setup. The old node:test run hid it because Node has no
 * `import.meta.env`, so the module silently fell back to the hardcoded absolute
 * `http://localhost:8081/api/v1`.
 *
 * The D14 cases below stub the env and re-import the module rather than relying on the local
 * (git-ignored) `.env`, so they fail identically on any machine and in CI.
 */

/** Load a fresh copy of the module with VITE_API_BASE_URL forced to `base`. */
async function loadWithBase(base) {
  vi.stubEnv('VITE_API_BASE_URL', base)
  vi.resetModules()
  return import('./evidenceUrl.js')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('resolveEvidenceUrl', () => {
  it('L1-FE-45 | EP-Valid: an absolute URL is returned unchanged', () => {
    expect(resolveEvidenceUrl('https://cdn.example.com/file.png'))
      .toBe('https://cdn.example.com/file.png')
  })

  it('L1-FE-46 | EP-Valid: with a relative API base, a relative URL must still resolve (D14)', async () => {
    // EXPECTED TO FAIL until D14 is resolved: new URL('/api/v1') throws, so the catch returns ''.
    const { resolveEvidenceUrl: resolve } = await loadWithBase('/api/v1')

    expect(
      resolve('/api/v1/files/1'),
      'a relative evidence path must resolve against an origin, not collapse to an empty string',
    ).not.toBe('')
  })

  it('L1-FE-52 | EP-Valid: with an absolute API base, a relative URL joins onto its origin', async () => {
    const { resolveEvidenceUrl: resolve } = await loadWithBase('http://localhost:8081/api/v1')

    expect(resolve('/api/v1/files/1')).toBe('http://localhost:8081/api/v1/files/1')
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

  it('L1-FE-51 | BC-TRUE: with a relative API base a relative path must still open (D14)', async () => {
    // EXPECTED TO FAIL until D14 is resolved. This is the user-visible impact: under the documented
    // dev-proxy config every "open evidence" click is a silent no-op.
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const { openEvidenceUrl: openUrl } = await loadWithBase('/api/v1')

    expect(
      openUrl('/api/v1/files/1'),
      'clicking an evidence link served through the dev proxy must open a tab',
    ).toBe(true)
  })
})
