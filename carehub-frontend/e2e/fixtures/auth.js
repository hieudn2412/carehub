import { expect } from '@playwright/test'
import { LANDING_PATH } from './accounts.js'
import { LOGIN } from './strings.js'

/**
 * Auth helpers.
 *
 * The app keeps its tokens in **sessionStorage** (`carehub.accessToken`, `carehub.refreshToken`,
 * `carehub.requiresFirstLoginSetup` — see src/features/auth/services/tokenStorage.js). Playwright's
 * `storageState` only persists cookies and localStorage, so the usual "log in once, reuse the state"
 * trick does not apply. Instead:
 *
 *   loginThroughUi()   — drives the real login form; use it when the login itself is under test.
 *   seedSession()      — replays a captured token bundle via addInitScript; use it to reach a screen
 *                        cheaply once some other test has proved login works.
 *
 * A token bundle is captured once per worker by `sessionFor()` and cached in memory.
 */

const SESSION_KEYS = {
  accessToken: 'carehub.accessToken',
  refreshToken: 'carehub.refreshToken',
  requiresFirstLoginSetup: 'carehub.requiresFirstLoginSetup',
}

/** role -> token bundle, cached for the lifetime of the worker process. */
const sessionCache = new Map()

/** Fills the login form and waits for the post-login landing page. */
export async function loginThroughUi(page, account) {
  await page.goto('/auth/login')
  await page.getByLabel(LOGIN.employeeCodeLabel).fill(account.employeeCode)
  await page.getByLabel(LOGIN.passwordLabel).fill(account.password)
  await page.getByRole('button', { name: LOGIN.submit }).click()

  const expectedPath = LANDING_PATH[account.role]
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 20_000 })
  return readSession(page)
}

/** Reads the three sessionStorage keys the app relies on. */
export async function readSession(page) {
  return page.evaluate((keys) => ({
    accessToken: window.sessionStorage.getItem(keys.accessToken),
    refreshToken: window.sessionStorage.getItem(keys.refreshToken),
    requiresFirstLoginSetup: window.sessionStorage.getItem(keys.requiresFirstLoginSetup),
  }), SESSION_KEYS)
}

/**
 * Installs a token bundle before any app code runs, so the very first render already sees an
 * authenticated session. Must be called before the first navigation of the page.
 */
export async function seedSession(page, session) {
  await page.addInitScript(({ keys, values }) => {
    if (values.accessToken) window.sessionStorage.setItem(keys.accessToken, values.accessToken)
    if (values.refreshToken) window.sessionStorage.setItem(keys.refreshToken, values.refreshToken)
    window.sessionStorage.setItem(
      keys.requiresFirstLoginSetup,
      values.requiresFirstLoginSetup ?? 'false',
    )
  }, { keys: SESSION_KEYS, values: session })
}

/** Wipes the session in the current page (used by logout/expiry specs). */
export async function clearSession(page) {
  await page.evaluate((keys) => {
    Object.values(keys).forEach((key) => window.sessionStorage.removeItem(key))
  }, SESSION_KEYS)
}

/** Replaces the access token with a syntactically valid but expired one. */
export async function expireAccessToken(page) {
  await page.evaluate((keys) => {
    const encode = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const current = window.sessionStorage.getItem(keys.accessToken)
    if (!current) return
    const [header, payload, signature] = current.split('.')
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    decoded.exp = Math.floor(Date.now() / 1000) - 60
    window.sessionStorage.setItem(keys.accessToken, `${header}.${encode(decoded)}.${signature}`)
  }, SESSION_KEYS)
}

/**
 * A token bundle for `role`, logging in through the UI the first time it is needed.
 * Uses a throwaway page so the caller's page can be seeded before its first navigation.
 */
export async function sessionFor(browser, account) {
  if (sessionCache.has(account.role)) {
    return sessionCache.get(account.role)
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    const session = await loginThroughUi(page, account)
    expect(session.accessToken, 'login did not store an access token').toBeTruthy()
    sessionCache.set(account.role, session)
    return session
  } finally {
    await context.close()
  }
}

/** Opens `path` already authenticated as `account`. */
export async function gotoAs(page, browser, account, path) {
  const session = await sessionFor(browser, account)
  await seedSession(page, session)
  await page.goto(path)
  return session
}
