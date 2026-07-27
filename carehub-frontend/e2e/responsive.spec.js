import { expect, test } from '@playwright/test'
import { ROLES, requireAccount } from './fixtures/accounts.js'
import { gotoAs, loginThroughUi } from './fixtures/auth.js'
import { LOGIN, STAFF_TRAINING } from './fixtures/strings.js'

/**
 * L4 E2E — sheet {@code L4-Responsive (Optional)}, ids L4-RESP-01…04, all P3.
 *
 * NFR-U01: the app must stay usable from 320 px up. 375×812 (iPhone SE/mini class) is the baseline
 * here and 768×1024 covers tablet. The assertion that matters on a small screen is "no horizontal
 * scroll" — a page wider than its viewport is the failure mode users actually hit.
 */

const MOBILE = { width: 375, height: 812 }
const TABLET = { width: 768, height: 1024 }

/** True when the document is wider than the viewport, i.e. the page scrolls sideways. */
async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

test.describe('L4-Responsive', () => {
  test('L4-RESP-01 | Critical Path: login and the staff dashboard fit a 375 px viewport', async ({ page }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Set the viewport to 375×812 and open the login screen', async () => {
      await page.setViewportSize(MOBILE)
      await page.goto('/auth/login')
      await expect(page.getByRole('heading', { name: LOGIN.heading })).toBeVisible()
      expect(await hasHorizontalOverflow(page), 'the login screen scrolls sideways at 375px').toBe(false)
    })

    await test.step('2. Log in on the small viewport', async () => {
      await loginThroughUi(page, staff)
    })

    await test.step('3. Assert the dashboard also fits', async () => {
      expect(await hasHorizontalOverflow(page), 'the staff dashboard scrolls sideways at 375px').toBe(false)
    })
  })

  test('L4-RESP-02 | Critical Path: the CME record form is usable at 375 px', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open the staff CME form on a 375 px viewport', async () => {
      await page.setViewportSize(MOBILE)
      await gotoAs(page, browser, staff, '/staff/training/new')
    })

    await test.step('2. Assert the first fields are reachable and typeable', async () => {
      const title = page.getByPlaceholder(STAFF_TRAINING.titlePlaceholder)
      await expect(title).toBeVisible()
      await title.fill('E2E mobile')
      await expect(title).toHaveValue('E2E mobile')
    })

    await test.step('3. Assert the form does not overflow horizontally', async () => {
      expect(await hasHorizontalOverflow(page), 'the CME form scrolls sideways at 375px').toBe(false)
    })
  })

  test('L4-RESP-03 | Critical Path: the navigation is reachable on a 375 px viewport', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open the staff dashboard at 375 px', async () => {
      await page.setViewportSize(MOBILE)
      await gotoAs(page, browser, staff, '/staff/dashboard')
    })

    await test.step('2. Assert a navigation affordance is present and leads somewhere', async () => {
      const navLink = page.getByRole('link').first()
      await expect(navLink).toBeVisible()
      const logout = page.getByRole('button', { name: 'Đăng xuất' })
      await expect(logout).toBeVisible()
    })
  })

  test('L4-RESP-04 | Critical Path: a data table stays readable on a 768 px tablet viewport', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open the exam history at 768×1024', async () => {
      await page.setViewportSize(TABLET)
      await gotoAs(page, browser, staff, '/staff/exam/history')
    })

    await test.step('2. Assert the page rendered and does not overflow the viewport', async () => {
      await expect(page.locator('#root')).not.toBeEmpty()
      expect(await hasHorizontalOverflow(page), 'the exam history scrolls sideways at 768px').toBe(false)
    })
  })
})
