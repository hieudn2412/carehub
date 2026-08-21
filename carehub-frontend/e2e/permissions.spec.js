import { expect, test } from '@playwright/test'
import { LANDING_PATH, ROLES, accountFor, requireAccount } from './fixtures/accounts.js'
import { gotoAs, loginThroughUi, seedSession, sessionFor } from './fixtures/auth.js'
import { LOGIN, SIDEBAR } from './fixtures/strings.js'

/**
 * L4 E2E — sheet {@code L4-Permissions}, ids L4-PERM-01…09.
 *
 * RBAC as the browser sees it: which pages a role can reach, where it gets sent instead, and which
 * menu entries exist. The guard (`src/features/auth/components/ProtectedRoute.jsx`) decides from the
 * roles/permissions decoded out of the JWT on the client, so these cases assert navigation and menus —
 * the API-level authorisation is already pinned by L3 (sheet L3-* Auth-Wrong-Role rows).
 */
test.describe('L4-Permissions', () => {
  test('L4-PERM-01 | Permission Boundary: a staff USER opening /admin/dashboard is sent back to the staff dashboard', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Navigate directly to the admin dashboard as USER', async () => {
      await gotoAs(page, browser, staff, '/admin/dashboard')
    })

    await test.step('2. Assert the redirect to the staff dashboard', async () => {
      await page.waitForURL((url) => url.pathname === LANDING_PATH[ROLES.staff])
      await expect(page).toHaveURL(/\/staff\/dashboard$/)
    })
  })

  test('L4-PERM-02 | Permission Boundary: a staff USER cannot reach the manager dashboard', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Navigate directly to /manager/dashboard as USER', async () => {
      await gotoAs(page, browser, staff, '/manager/dashboard')
    })

    await test.step('2. Assert the redirect away from the manager area', async () => {
      await page.waitForURL((url) => url.pathname === LANDING_PATH[ROLES.staff])
    })
  })

  test('L4-PERM-03 | Permission Boundary: a MANAGER opening /admin/accounts is sent back to the manager dashboard', async ({ page, browser }) => {
    const manager = requireAccount(test, ROLES.manager)

    await test.step('1. Navigate directly to /admin/accounts as MANAGER', async () => {
      await gotoAs(page, browser, manager, '/admin/accounts')
    })

    await test.step('2. Assert the redirect to /manager/dashboard', async () => {
      await page.waitForURL((url) => url.pathname === LANDING_PATH[ROLES.manager])
    })
  })

  test('L4-PERM-04 | Permission Boundary: the MANAGER menu exposes the department section that staff never sees', async ({ page, browser }) => {
    const manager = requireAccount(test, ROLES.manager)
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Read the sidebar as MANAGER', async () => {
      await gotoAs(page, browser, manager, '/manager/dashboard')
      // Nhắm vào link sidebar: "Tuân thủ chung" cũng xuất hiện trên thẻ KPI của dashboard.
      await expect(page.getByRole('link', { name: SIDEBAR.managerCompliance })).toBeVisible()
      await expect(page.getByRole('link', { name: SIDEBAR.managerResults })).toBeVisible()
    })

    await test.step('2. Read the sidebar as USER in a clean context', async () => {
      const context = await browser.newContext()
      const staffPage = await context.newPage()
      try {
        const session = await sessionFor(browser, staff)
        await seedSession(staffPage, session)
        await staffPage.goto('/staff/dashboard')
        await expect(staffPage.getByText(SIDEBAR.sectionPersonal)).toBeVisible()
        await expect(staffPage.getByRole('link', { name: SIDEBAR.managerCompliance })).toHaveCount(0)
      } finally {
        await context.close()
      }
    })
  })

  test('L4-PERM-05 | Permission Boundary: an ADMIN reaches the administration pages a MANAGER is bounced from', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)

    await test.step('1. Open /admin/accounts as ADMIN', async () => {
      await gotoAs(page, browser, admin, '/admin/accounts')
      await expect(page).toHaveURL(/\/admin\/accounts$/)
    })

    await test.step('2. Open /admin/system-settings as ADMIN', async () => {
      await page.goto('/admin/system-settings')
      await expect(page).toHaveURL(/\/admin\/system-settings$/)
      await expect(page.locator('#root')).not.toBeEmpty()
    })
  })

  test('L4-PERM-06 | Permission Boundary: an evaluation-permission account reaches /admin/evaluation/* but not /admin/accounts', async ({ page }) => {
    const evaluator = accountFor(ROLES.evaluator)
    test.skip(!evaluator, 'set E2E_EVALUATOR_CODE / E2E_EVALUATOR_PASSWORD (an account with an evaluation permission and no ADMIN role)')

    await test.step('1. Log in and check the landing page is the evaluation dashboard', async () => {
      await loginThroughUi(page, evaluator)
      await expect(page).toHaveURL(/\/admin\/evaluation\/dashboard$/)
    })

    await test.step('2. Open the question bank', async () => {
      await page.goto('/admin/evaluation/question-bank')
      await expect(page).toHaveURL(/\/admin\/evaluation\/question-bank$/)
    })

    await test.step('3. Assert /admin/accounts is refused', async () => {
      await page.goto('/admin/accounts')
      await expect(page).not.toHaveURL(/\/admin\/accounts$/)
    })
  })

  test('L4-PERM-07 | Permission Boundary: an anonymous visitor to a protected page is sent to the login screen', async ({ page }) => {
    await test.step('1. Navigate to /staff/training with no session', async () => {
      await page.goto('/staff/training')
    })

    await test.step('2. Assert the login screen is shown', async () => {
      await page.waitForURL(/\/auth\/login$/)
      await expect(page.getByRole('heading', { name: LOGIN.heading })).toBeVisible()
    })
  })

  test('L4-PERM-08 | Permission Boundary: after logging in the originally requested page is restored', async ({ page }) => {
    const staff = requireAccount(test, ROLES.staff)
    const requested = '/staff/training-status'

    await test.step(`1. Request ${requested} while anonymous`, async () => {
      await page.goto(requested)
      await page.waitForURL(/\/auth\/login$/)
    })

    await test.step('2. Log in from the redirected login screen', async () => {
      await page.getByLabel(LOGIN.employeeCodeLabel).fill(staff.employeeCode)
      await page.getByLabel(LOGIN.passwordLabel).fill(staff.password)
      await page.getByRole('button', { name: LOGIN.submit }).click()
    })

    await test.step('3. Assert the deep link is honoured, not the default landing page', async () => {
      await page.waitForURL((url) => url.pathname === requested)
    })
  })

  test('L4-PERM-09 | Permission Boundary: the shared checklist screen scopes itself to the caller instead of leaking the manager view', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open /staff/checklists as USER', async () => {
      await gotoAs(page, browser, staff, '/staff/checklists')
      await expect(page).toHaveURL(/\/staff\/checklists$/)
    })

    await test.step('2. Assert the manager-only menu section is still absent', async () => {
      // ManagerChecklistListPage is reused for both roles; only the surrounding shell differs.
      await expect(page.getByRole('link', { name: SIDEBAR.managerCompliance })).toHaveCount(0)
    })
  })
})
