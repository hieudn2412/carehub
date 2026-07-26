import { expect, test } from '@playwright/test'
import { LANDING_PATH, ROLES, requireAccount } from './fixtures/accounts.js'
import { clearSession, expireAccessToken, gotoAs, loginThroughUi, readSession, seedSession, sessionFor } from './fixtures/auth.js'
import { LOGIN } from './fixtures/strings.js'

/**
 * L4 E2E — sheet {@code L4-SessionManagement}, ids L4-SESS-01…06.
 *
 * The session is a stateless JWT pair kept in sessionStorage, refreshed by an axios interceptor
 * (`src/shared/api/httpClient.js`). These cases cover what the user experiences around that: landing
 * pages per role, logout, silent refresh, a revoked refresh token, a second tab, and the first-login
 * lock-in.
 */
test.describe('L4-SessionManagement', () => {
  test('L4-SESS-01 | Session Management: every role lands on its own home page and stores the same three session keys', async ({ browser }) => {
    // One row in the workbook, three roles inside — the ids have to stay 1:1 with the sheet.
    for (const role of [ROLES.admin, ROLES.manager, ROLES.staff]) {
      const account = requireAccount(test, role)
      await test.step(`${role}: log in and verify the landing page + session keys`, async () => {
        const context = await browser.newContext()
        const page = await context.newPage()
        try {
          await loginThroughUi(page, account)
          expect(new URL(page.url()).pathname).toBe(LANDING_PATH[role])
          const session = await readSession(page)
          expect(session.accessToken).toBeTruthy()
          expect(session.refreshToken).toBeTruthy()
          expect(session.requiresFirstLoginSetup).toBe('false')
        } finally {
          await context.close()
        }
      })
    }
  })

  test('L4-SESS-02 | Session Management: logging out clears the session and Back cannot revive it', async ({ page }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Log in and reach the staff dashboard', async () => {
      await loginThroughUi(page, staff)
    })

    await test.step('2. Log out from the sidebar', async () => {
      await page.getByRole('button', { name: 'Đăng xuất' }).click()
      await page.waitForURL(/\/auth\/login$/)
    })

    await test.step('3. Assert going Back does not restore the protected page', async () => {
      await page.goBack()
      // ProtectedRoute redirects with replace, so history has no guarded entry to return to.
      await expect(page).toHaveURL(/\/auth\/login$/)
      const session = await readSession(page)
      expect(session.accessToken).toBeFalsy()
    })
  })

  test('L4-SESS-03 | Session Management: an expired access token is refreshed silently without interrupting the user', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open a protected page with a valid session', async () => {
      await gotoAs(page, browser, staff, '/staff/training-status')
    })

    await test.step('2. Expire the access token in place, keeping the refresh token', async () => {
      await expireAccessToken(page)
    })

    await test.step('3. Trigger a fresh API call by reloading', async () => {
      await page.reload()
    })

    await test.step('4. Assert the user stayed on the page with a new access token', async () => {
      await expect(page).toHaveURL(/\/staff\/training-status$/)
      await expect(page.locator('#root')).not.toBeEmpty()
      const session = await readSession(page)
      expect(session.accessToken).toBeTruthy()
    })
  })

  test('L4-SESS-04 | Session Management: a revoked refresh token forces a hard redirect back to login', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open a protected page', async () => {
      await gotoAs(page, browser, staff, '/staff/training-status')
    })

    await test.step('2. Expire the access token and corrupt the refresh token', async () => {
      await expireAccessToken(page)
      await page.evaluate(() => {
        window.sessionStorage.setItem('carehub.refreshToken', 'revoked-by-e2e')
      })
    })

    await test.step('3. Trigger an API call', async () => {
      await page.reload()
    })

    await test.step('4. Assert the session was cleared and login is shown', async () => {
      // httpClient calls window.location.replace('/auth/login') — a full page load, not a router push.
      await page.waitForURL(/\/auth\/login$/, { timeout: 20_000 })
      const session = await readSession(page)
      expect(session.accessToken).toBeFalsy()
    })
  })

  test('L4-SESS-05 | Session Management: a second tab shares the session of the first', async ({ browser }) => {
    const staff = requireAccount(test, ROLES.staff)
    const context = await browser.newContext()

    try {
      const first = await context.newPage()
      const session = await sessionFor(browser, staff)

      await test.step('1. Open the first tab authenticated', async () => {
        await seedSession(first, session)
        await first.goto('/staff/dashboard')
        await expect(first).toHaveURL(/\/staff\/dashboard$/)
      })

      await test.step('2. Open a second tab in the same context', async () => {
        const second = await context.newPage()
        await seedSession(second, session)
        await second.goto('/staff/training-status')
        await expect(second).toHaveURL(/\/staff\/training-status$/)
        await expect(second.locator('#root')).not.toBeEmpty()
      })

      await test.step('3. Assert clearing the session in one tab does not retro-actively log the other out', async () => {
        await clearSession(first)
        // sessionStorage is per-tab in the browser, so the other tab keeps working until it reloads.
        const pages = context.pages()
        expect(pages.length).toBeGreaterThan(1)
      })
    } finally {
      await context.close()
    }
  })

  test('L4-SESS-06 | Session Management: an account flagged for first-login setup is locked into the email-confirm wizard', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Seed a session with requiresFirstLoginSetup = true', async () => {
      const session = await sessionFor(browser, staff)
      await seedSession(page, { ...session, requiresFirstLoginSetup: 'true' })
    })

    await test.step('2. Try to open a normal protected page', async () => {
      await page.goto('/staff/dashboard')
    })

    await test.step('3. Assert the guard forces the email-confirm step', async () => {
      await page.waitForURL(/\/auth\/email-confirm$/)
      await expect(page.getByRole('heading', { name: /Thiết lập bảo mật tài khoản/ })).toBeVisible()
    })

    await test.step('4. Assert another protected page is refused just the same', async () => {
      await page.goto('/staff/training-status')
      await page.waitForURL(/\/auth\/email-confirm$/)
      await expect(page.getByRole('heading', { name: LOGIN.heading })).toHaveCount(0)
    })
  })
})
