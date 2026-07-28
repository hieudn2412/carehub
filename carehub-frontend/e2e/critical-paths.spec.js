import { expect, test } from '@playwright/test'
import { LANDING_PATH, ROLES, requireAccount } from './fixtures/accounts.js'
import { gotoAs, loginThroughUi } from './fixtures/auth.js'
import { apiClient, seedActivityType } from './fixtures/api.js'
import { HEADER_TITLES, LOGIN } from './fixtures/strings.js'

/**
 * L4 E2E — sheet {@code L4-CriticalPaths}, ids L4-CP-01…05.
 *
 * Smoke suite: happy paths only, meant to run after every deploy and finish in minutes. If any of
 * these fail the build is dead on arrival and the regression sheets are not worth running.
 *
 * Preconditions: backend on :8080 against a database that is safe to write to, plus the E2E_*
 * accounts described in fixtures/accounts.js.
 */
test.describe('L4-CriticalPaths', () => {
  test('L4-CP-01 | Critical Path: an ADMIN logs in and lands on the admin dashboard', async ({ page }) => {
    const admin = requireAccount(test, ROLES.admin)

    await test.step('1. Navigate to /auth/login', async () => {
      await page.goto('/auth/login')
      await expect(page.getByRole('heading', { name: LOGIN.heading })).toBeVisible()
    })

    await test.step('2. Sign in with the admin credentials', async () => {
      await page.getByLabel(LOGIN.employeeCodeLabel).fill(admin.employeeCode)
      await page.getByLabel(LOGIN.passwordLabel).fill(admin.password)
      await page.getByRole('button', { name: LOGIN.submit }).click()
    })

    await test.step('3. Assert the admin dashboard is reached', async () => {
      await page.waitForURL((url) => url.pathname === LANDING_PATH[ROLES.admin])
      await expect(page.getByText(HEADER_TITLES.adminDashboardBreadcrumb).first()).toBeVisible()
    })
  })

  test('L4-CP-02 | Critical Path: a MANAGER logs in and lands on the manager dashboard', async ({ page }) => {
    const manager = requireAccount(test, ROLES.manager)

    await test.step('1. Sign in as MANAGER', async () => {
      await loginThroughUi(page, manager)
    })

    await test.step('2. Assert the manager dashboard is reached', async () => {
      expect(new URL(page.url()).pathname).toBe(LANDING_PATH[ROLES.manager])
      await expect(page.getByText(HEADER_TITLES.managerDashboard).first()).toBeVisible()
    })
  })

  test('L4-CP-03 | Critical Path: a staff USER logs in and lands on the staff dashboard', async ({ page }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Sign in as USER', async () => {
      await loginThroughUi(page, staff)
    })

    await test.step('2. Assert the staff dashboard is reached', async () => {
      expect(new URL(page.url()).pathname).toBe(LANDING_PATH[ROLES.staff])
      await expect(page.getByText(HEADER_TITLES.staffDashboard).first()).toBeVisible()
    })
  })

  test('L4-CP-04 | Critical Path: a staff USER saves a CME draft through the shared record form', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const title = `E2E smoke ${Date.now()}`

    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)
    try {
      const activityType = await test.step('1. Seed an active activity type (API)', async () =>
        seedActivityType(adminApi))

      await test.step('2. Open /training/records/new as the staff user', async () => {
        await gotoAs(page, browser, staff, '/training/records/new')
        // This shared page is still in English, unlike the staff-specific screens.
        await expect(page.getByRole('heading', { name: 'New Training Record' })).toBeVisible()
      })

      await test.step('3. Choose the seeded activity type and fill the title', async () => {
        await page.getByLabel('Activity type').selectOption({ label: activityType.name })
        await page.getByLabel('Title').fill(title)
      })

      await test.step('4. Save the draft', async () => {
        await page.getByRole('button', { name: 'Save Draft' }).click()
        // A saved record redirects to its own edit URL.
        await page.waitForURL(/\/training\/records\/\d+\/edit$/)
        await expect(page.getByText('Saved.')).toBeVisible()
      })

      await test.step('5. Assert the record belongs to the caller and is a DRAFT', async () => {
        const records = await staffApi.get('/training/records?page=0&size=20', 'list own records')
        const created = records.content.find((row) => row.title === title)
        expect(created, 'the saved record is missing from the caller\'s own list').toBeTruthy()
        expect(created.workflowStatus).toBe('DRAFT')
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-CP-05 | Critical Path: the main screens of every role render without a runtime error', async ({ browser }) => {
    // The cheapest possible net for the crash family found while writing L4: three committed pages
    // reference identifiers that were never declared or imported (D42, D43, D44), so React throws
    // during render and the user gets a blank screen. No level below L4 can observe that.
    const sweeps = [
      {
        role: ROLES.staff,
        paths: ['/staff/dashboard', '/staff/training', '/staff/training-status', '/staff/competency',
          '/staff/professional-competency', '/staff/exam/history', '/staff/profile', '/staff/notifications'],
      },
      {
        role: ROLES.manager,
        paths: ['/manager/dashboard', '/manager/employees', '/manager/exam-results',
          '/manager/quality/checklists', '/manager/quality/history'],
      },
      {
        role: ROLES.admin,
        paths: ['/admin/dashboard', '/admin/accounts', '/admin/quality/checklists',
          '/admin/training/activity-types', '/admin/system-settings', '/admin/evaluation/question-bank'],
      },
    ]

    const failures = []
    for (const { role, paths } of sweeps) {
      const account = requireAccount(test, role)
      const context = await browser.newContext()
      const rolePage = await context.newPage()
      let errors = []
      rolePage.on('pageerror', (error) => errors.push(`${error.name}: ${error.message}`))

      try {
        await gotoAs(rolePage, browser, account, paths[0])
        for (const path of paths) {
          await test.step(`${role} opens ${path}`, async () => {
            errors = []
            await rolePage.goto(path)
            // A crashed render leaves the React root empty; a healthy one always paints the shell.
            await expect(rolePage.locator('#root')).not.toBeEmpty()
            if (errors.length > 0) {
              failures.push(`${path} → ${errors.join(' | ')}`)
            }
          })
        }
      } finally {
        await context.close()
      }
    }

    expect(failures, `pages threw during render:\n${failures.join('\n')}`).toEqual([])
  })
})
