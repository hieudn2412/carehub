import { expect, test } from '@playwright/test'
import { ROLES, requireAccount } from './fixtures/accounts.js'
import { gotoAs } from './fixtures/auth.js'
import {
  apiClient,
  currentUserId,
  seedActivityType,
  seedAssignedChecklist,
  seedOpenExamAssignment,
  seedTrainingRecord,
} from './fixtures/api.js'
import {
  ADMIN_ACCOUNTS,
  ADMIN_CHECKLISTS,
  CHECKLIST,
  EXAM,
  MANAGER,
  STAFF_TRAINING,
  TOAST_SELECTOR,
  TRAINING_RECORDS,
} from './fixtures/strings.js'

/**
 * L4 E2E — sheet {@code L4-UserJourneys}, ids L4-F01-xx … L4-F05-xx (18 cases).
 *
 * Full regression: each business flow end to end plus the error branches a real user hits. Where a
 * precondition is just data, it is seeded over HTTP (fixtures/api.js) so the browser part stays about
 * the screens under test.
 *
 * F01 deliberately drives the staff-specific screens `/staff/training*`, which is where D42 and D43
 * live — those two cases stay red until the missing declarations are added.
 */

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('L4-UserJourneys — F01 CME training hours', () => {
  test('L4-F01-01 | User Journey - Happy: staff records CME hours from /staff/training and the hours show up on the progress screen', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const title = `E2E CME ${Date.now()}`
    const adminApi = await apiClient(admin)

    try {
      const activityType = await test.step('1. Seed an active activity type (API)', async () =>
        seedActivityType(adminApi))

      await test.step('2. Open the staff CME list', async () => {
        await gotoAs(page, browser, staff, '/staff/training')
        // Pins D42: TrainingHoursListScreen references setStatus/getStatusLabel/handleDirectSubmit/
        // submittingId/SendOutlined/EditOutlined without declaring or importing them, so this page
        // currently throws during render and shows a blank screen.
        await expect(page.getByRole('heading', { name: STAFF_TRAINING.listHeading })).toBeVisible()
      })

      await test.step('3. Start a new record', async () => {
        await page.getByRole('button', { name: STAFF_TRAINING.addButton }).click()
        await page.waitForURL(/\/staff\/training\/new$/)
      })

      await test.step('4. Fill title, hours and activity type', async () => {
        await page.getByPlaceholder(STAFF_TRAINING.titlePlaceholder).fill(title)
        await page.getByPlaceholder(STAFF_TRAINING.hoursPlaceholder).fill('3')
        // Activity type is a hand-rolled dropdown, not a <select>.
        await page.getByText(STAFF_TRAINING.activityTypePlaceholder).click()
        await page.getByText(activityType.name, { exact: false }).click()
      })

      await test.step('5. Save and submit', async () => {
        await page.getByRole('button', { name: STAFF_TRAINING.saveAndSubmit }).click()
        await expect(page.locator(TOAST_SELECTOR).filter({ hasText: STAFF_TRAINING.submitToast }))
          .toBeVisible()
        await page.waitForURL(/\/staff\/training$/)
      })

      await test.step('6. Assert the submitted hours are counted on the progress screen', async () => {
        await page.goto('/staff/training-status')
        await expect(page.getByRole('heading', { name: STAFF_TRAINING.progressHeading })).toBeVisible()
        await expect(page.getByText('3', { exact: false }).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
    }
  })

  test('L4-F01-02 | Negative UI: submitting the CME form without the required fields is blocked', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open the empty CME form', async () => {
      await gotoAs(page, browser, staff, '/staff/training/new')
    })

    await test.step('2. Press "Lưu và nộp" with everything empty', async () => {
      await page.getByRole('button', { name: STAFF_TRAINING.saveAndSubmit }).click()
    })

    await test.step('3. Assert nothing was created and the user stays on the form', async () => {
      await expect(page).toHaveURL(/\/staff\/training\/new$/)
      // Required inputs keep focus/invalid state; no success toast may appear.
      await expect(page.locator(TOAST_SELECTOR).filter({ hasText: STAFF_TRAINING.submitToast }))
        .toHaveCount(0)
    })
  })

  test('L4-F01-03 | Negative UI: a .txt evidence file is rejected before any upload happens', async ({ page, browser }) => {
    const staff = requireAccount(test, ROLES.staff)

    await test.step('1. Open the CME form', async () => {
      await gotoAs(page, browser, staff, '/staff/training/new')
    })

    await test.step('2. Attach a .txt file to the hidden evidence input', async () => {
      await page.locator('input[type=file]').first().setInputFiles({
        name: 'ghi-chu.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('không phải minh chứng'),
      })
    })

    await test.step('3. Assert the client-side rule rejects it', async () => {
      // getEvidenceFileError allows PDF/JPG/PNG only (src/features/training/utils/evidenceFile.js).
      await expect(page.locator(TOAST_SELECTOR).first()).toBeVisible()
      await expect(page.getByText('ghi-chu.txt')).toHaveCount(0)
    })
  })

  test('L4-F01-04 | User Journey - Error: the evidence screen of a submitted record is read-only', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const recordId = await test.step('1. Seed a submitted record (API)', async () => {
        const activityType = await seedActivityType(adminApi)
        const staffId = await currentUserId(staffApi)
        const record = await seedTrainingRecord(staffApi, {
          activityTypeId: activityType.id,
          employeeId: staffId,
        })
        await staffApi.post(`/training/records/${record.id}/submit`, {}, 'submit seeded record')
        return record.id
      })

      await test.step('2. Open its evidence screen', async () => {
        await gotoAs(page, browser, staff, `/staff/training/${recordId}/evidence`)
        // Pins D43: TrainingHoursEvidenceScreen uses navigate() and <ArrowLeftOutlined /> without
        // importing either, so the back-link block throws while rendering this page.
        await expect(page.getByRole('heading', { name: STAFF_TRAINING.evidenceHeading })).toBeVisible()
      })

      await test.step('3. Assert uploading is not offered for a submitted record', async () => {
        await expect(page.locator('input[type=file]')).toHaveCount(0)
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })
})

test.describe('L4-UserJourneys — F02 quality checklist', () => {
  test('L4-F02-01 | User Journey - Happy: staff completes an assigned checklist and the result is submitted', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      await test.step('1. Seed a published checklist assigned to the staff user (API)', async () => {
        const staffId = await currentUserId(staffApi)
        await seedAssignedChecklist(adminApi, staffId)
      })

      await test.step('2. Open the assigned-checklist list', async () => {
        await gotoAs(page, browser, staff, '/staff/checklists')
        await expect(page.getByRole('heading', { name: CHECKLIST.listHeading })).toBeVisible()
      })

      await test.step('3. Start the evaluation', async () => {
        await page.getByRole('button', { name: CHECKLIST.startCta }).first().click()
        await page.waitForURL(/\/staff\/checklists\/\d+\/evaluate$/)
      })

      await test.step('4. Look the supervised employee up by code', async () => {
        await page.getByPlaceholder(CHECKLIST.employeeLookupPlaceholder).fill(staff.employeeCode)
        await page.getByRole('button', { name: CHECKLIST.lookupButton }).click()
        await expect(page.getByText(CHECKLIST.lookupResult)).toBeVisible()
        await page.getByText(CHECKLIST.chooseEmployee).click()
      })

      await test.step('5. Answer the single required question', async () => {
        await page.getByRole('radio').first().check()
      })

      await test.step('6. Submit and assert the success toast', async () => {
        await page.getByRole('button', { name: CHECKLIST.submit }).click()
        await expect(page.locator(TOAST_SELECTOR).filter({ hasText: CHECKLIST.submittedToast }))
          .toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F02-02 | Negative UI: submitting a checklist with a required question unanswered is refused', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const seeded = await test.step('1. Seed an assigned checklist (API)', async () => {
        const staffId = await currentUserId(staffApi)
        return seedAssignedChecklist(adminApi, staffId)
      })

      await test.step('2. Open the evaluation form and pick the subject', async () => {
        await gotoAs(page, browser, staff, `/staff/checklists/${seeded.assignmentItemId}/evaluate`)
        await page.getByPlaceholder(CHECKLIST.employeeLookupPlaceholder).fill(staff.employeeCode)
        await page.getByRole('button', { name: CHECKLIST.lookupButton }).click()
        await page.getByText(CHECKLIST.chooseEmployee).click()
      })

      await test.step('3. Submit without answering', async () => {
        await page.getByRole('button', { name: CHECKLIST.submit }).click()
      })

      await test.step('4. Assert the toast names the missing required questions', async () => {
        await expect(page.locator(TOAST_SELECTOR).filter({ hasText: 'câu hỏi bắt buộc' })).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F02-03 | User Journey - Happy: a checklist draft survives leaving and re-opening the page', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const seeded = await test.step('1. Seed an assigned checklist (API)', async () => {
        const staffId = await currentUserId(staffApi)
        return seedAssignedChecklist(adminApi, staffId)
      })
      const evaluatePath = `/staff/checklists/${seeded.assignmentItemId}/evaluate`

      await test.step('2. Answer and save a draft', async () => {
        await gotoAs(page, browser, staff, evaluatePath)
        await page.getByPlaceholder(CHECKLIST.employeeLookupPlaceholder).fill(staff.employeeCode)
        await page.getByRole('button', { name: CHECKLIST.lookupButton }).click()
        await page.getByText(CHECKLIST.chooseEmployee).click()
        await page.getByRole('radio').first().check()
        await page.getByRole('button', { name: CHECKLIST.saveDraft }).click()
        await expect(page.locator(TOAST_SELECTOR).filter({ hasText: CHECKLIST.draftSavedToast }))
          .toBeVisible()
      })

      await test.step('3. Leave and come back', async () => {
        await page.goto('/staff/dashboard')
        await page.goto(evaluatePath)
      })

      await test.step('4. Assert the saved answer is still selected', async () => {
        await expect(page.getByRole('radio').first()).toBeChecked()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F02-04 | User Journey - Error: a second open draft for the same assignment is rejected with a conflict message', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const seeded = await test.step('1. Seed an assigned checklist and an open draft (API)', async () => {
        const staffId = await currentUserId(staffApi)
        const checklist = await seedAssignedChecklist(adminApi, staffId)
        await staffApi.post('/form-submissions', {
          assignmentItemId: checklist.assignmentItemId,
          subject: { type: 'USER', employeeCode: staff.employeeCode },
        }, 'seed open draft submission')
        return checklist
      })

      await test.step('2. Try to start a second evaluation of the same assignment for the same subject', async () => {
        await gotoAs(page, browser, staff, `/staff/checklists/${seeded.assignmentItemId}/evaluate`)
        await page.getByPlaceholder(CHECKLIST.employeeLookupPlaceholder).fill(staff.employeeCode)
        await page.getByRole('button', { name: CHECKLIST.lookupButton }).click()
        await page.getByText(CHECKLIST.chooseEmployee).click()
        await page.getByRole('radio').first().check()
        await page.getByRole('button', { name: CHECKLIST.submit }).click()
      })

      await test.step('3. Assert the 409 is surfaced as a readable message, not a blank failure', async () => {
        await expect(page.locator(TOAST_SELECTOR).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })
})

test.describe('L4-UserJourneys — F03 professional exam', () => {
  test('L4-F03-01 | User Journey - Happy: staff sits an assigned exam and sees the graded result in the history', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      await test.step('1. Seed an open exam assignment targeting the staff user (API)', async () => {
        const staffId = await currentUserId(staffApi)
        await seedOpenExamAssignment(adminApi, staffId)
      })

      await test.step('2. Open the assigned-exam list', async () => {
        await gotoAs(page, browser, staff, '/staff/exam/take')
        await expect(page.getByRole('heading', { name: EXAM.listHeading }).first()).toBeVisible()
      })

      await test.step('3. Start the attempt', async () => {
        await page.getByTitle(EXAM.detailAction).first().click()
        await page.waitForURL(/\/staff\/exam\/take\/\d+$/)
        await expect(page.getByText(EXAM.timerLabel)).toBeVisible()
      })

      await test.step('4. Answer every question', async () => {
        const options = page.getByRole('radio')
        await options.first().check()
        await expect(page.getByText(EXAM.allAnswered)).toBeVisible()
      })

      await test.step('5. Submit, accepting the native confirm', async () => {
        page.once('dialog', (dialog) => dialog.accept())
        await page.getByRole('button', { name: EXAM.submit }).first().click()
        await page.waitForURL(/\/staff\/exam\/history$/)
      })

      await test.step('6. Assert the attempt is listed with a grade', async () => {
        await expect(page.getByRole('heading', { name: EXAM.historyHeading }).first()).toBeVisible()
        await expect(page.getByText(EXAM.passed).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F03-02 | Negative UI: submitting an exam with unanswered questions warns before it goes through', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const assignmentId = await test.step('1. Seed an open exam assignment (API)', async () => {
        const staffId = await currentUserId(staffApi)
        const seeded = await seedOpenExamAssignment(adminApi, staffId)
        return seeded.assignmentId
      })

      const attempt = await test.step('2. Start the attempt through the API and open it', async () => {
        const started = await staffApi.post(`/me/exam-assignments/${assignmentId}/start`, {}, 'start attempt')
        await gotoAs(page, browser, staff, `/staff/exam/take/${started.id}`)
        return started
      })

      await test.step('3. Press "Nộp bài" without answering anything', async () => {
        const messages = []
        page.once('dialog', (dialog) => {
          messages.push(dialog.message())
          dialog.dismiss()
        })
        await page.getByRole('button', { name: EXAM.submit }).first().click()
        await expect.poll(() => messages.length).toBeGreaterThan(0)
        expect(messages[0]).toContain('chưa trả lời')
      })

      await test.step('4. Assert dismissing the confirm keeps the attempt open', async () => {
        expect(new URL(page.url()).pathname).toBe(`/staff/exam/take/${attempt.id}`)
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F03-03 | User Journey - Happy: leaving mid-exam and returning restores the answers', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const attemptId = await test.step('1. Seed an assignment and start an attempt (API)', async () => {
        const staffId = await currentUserId(staffApi)
        const seeded = await seedOpenExamAssignment(adminApi, staffId)
        const started = await staffApi.post(`/me/exam-assignments/${seeded.assignmentId}/start`, {}, 'start attempt')
        return started.id
      })
      const takePath = `/staff/exam/take/${attemptId}`

      await test.step('2. Answer a question and wait for the autosave indicator', async () => {
        await gotoAs(page, browser, staff, takePath)
        await page.getByRole('radio').first().check()
        await expect(page.getByText(EXAM.savedIndicator).first()).toBeVisible({ timeout: 20_000 })
      })

      await test.step('3. Navigate away, accepting the leave confirmation', async () => {
        page.once('dialog', (dialog) => dialog.accept())
        await page.goto('/staff/dashboard')
      })

      await test.step('4. Re-open the attempt and assert the answer is still there', async () => {
        await page.goto(takePath)
        await expect(page.getByRole('radio').first()).toBeChecked()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F03-04 | User Journey - Error: once the attempt quota is used the exam cannot be started again', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      await test.step('1. Seed a single-attempt assignment and consume it (API)', async () => {
        const staffId = await currentUserId(staffApi)
        const seeded = await seedOpenExamAssignment(adminApi, staffId, { maxAttempts: 1 })
        const attempt = await staffApi.post(`/me/exam-assignments/${seeded.assignmentId}/start`, {}, 'start attempt')
        const paperQuestionId = attempt.questions[0].paperQuestionId
        await staffApi.post(`/me/exam-attempts/${attempt.id}/submit`, {
          answers: [{ paperQuestionId, selectedAnswer: 'A' }],
        }, 'submit attempt')
      })

      await test.step('2. Open the assigned-exam list', async () => {
        await gotoAs(page, browser, staff, '/staff/exam/take')
        await expect(page.getByRole('heading', { name: EXAM.listHeading }).first()).toBeVisible()
      })

      await test.step('3. Assert the row reports a result and offers no new attempt', async () => {
        await expect(page.getByText(EXAM.passed).first()).toBeVisible()
        // The action button turns into a read-only "view" for an exhausted assignment.
        await expect(page.getByTitle(EXAM.detailAction).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })
})

test.describe('L4-UserJourneys — F04 manager oversight', () => {
  test('L4-F04-01 | User Journey - Happy: a manager opens the department roster and drills into one employee', async ({ page, browser }) => {
    const manager = requireAccount(test, ROLES.manager)

    await test.step('1. Open the department roster', async () => {
      await gotoAs(page, browser, manager, '/manager/employees')
      await expect(page.getByRole('heading', { name: MANAGER.employeesHeading }).first()).toBeVisible()
    })

    await test.step('2. Open the first employee', async () => {
      await page.getByTitle(/Xem tổng hợp nhân sự/).first().click()
      await page.waitForURL(/\/manager\/employees\/\d+$/)
    })

    await test.step('3. Assert the employee detail screen renders', async () => {
      await expect(page.getByRole('heading', { name: MANAGER.employeeDetailHeading }).first()).toBeVisible()
    })
  })

  test('L4-F04-02 | User Journey - Happy: a manager reviews an employee CME record and its evidence', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const manager = requireAccount(test, ROLES.manager)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const recordId = await test.step('1. Seed a submitted record with evidence (API)', async () => {
        const activityType = await seedActivityType(adminApi)
        const staffId = await currentUserId(staffApi)
        const record = await seedTrainingRecord(staffApi, {
          activityTypeId: activityType.id,
          employeeId: staffId,
        })
        const upload = await staffApi.raw.post(`/training/records/${record.id}/evidences`, {
          headers: { Authorization: `Bearer ${staffApi.token}` },
          multipart: {
            file: { name: 'minh-chung.png', mimeType: 'image/png', buffer: PNG_1PX },
          },
        })
        expect(upload.ok(), `evidence upload failed: ${upload.status()}`).toBeTruthy()
        await staffApi.post(`/training/records/${record.id}/submit`, {}, 'submit seeded record')
        return record.id
      })

      await test.step('2. Open the record detail as the manager', async () => {
        await gotoAs(page, browser, manager, `/training/records/${recordId}#evidence`)
      })

      await test.step('3. Assert the evidence section is visible for the reviewer', async () => {
        await expect(page.getByText(/Minh chứng/).first()).toBeVisible()
        await expect(page.getByText(TRAINING_RECORDS.statusSubmitted).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('L4-F04-03 | User Journey - Error: an admin returns a submitted record to draft through the confirm dialog', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)

    try {
      const recordId = await test.step('1. Seed a submitted record (API)', async () => {
        const activityType = await seedActivityType(adminApi)
        const staffId = await currentUserId(staffApi)
        const record = await seedTrainingRecord(staffApi, {
          activityTypeId: activityType.id,
          employeeId: staffId,
        })
        await staffApi.post(`/training/records/${record.id}/submit`, {}, 'submit seeded record')
        return record.id
      })

      await test.step('2. Open the record as ADMIN', async () => {
        await gotoAs(page, browser, admin, `/training/records/${recordId}`)
        await expect(page.getByText(TRAINING_RECORDS.statusSubmitted).first()).toBeVisible()
      })

      await test.step('3. Return it to draft, accepting the native confirm', async () => {
        page.once('dialog', (dialog) => {
          expect(dialog.message()).toContain('trả hồ sơ này về nháp')
          dialog.accept()
        })
        await page.getByRole('button', { name: TRAINING_RECORDS.returnToDraft }).click()
      })

      await test.step('4. Assert the status is now a draft', async () => {
        await expect(page.getByText(TRAINING_RECORDS.statusDraft).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })
})

test.describe('L4-UserJourneys — F05 administration', () => {
  test('L4-F05-01 | User Journey - Happy: an admin creates an employee account and finds it in the list', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const suffix = `${Date.now()}`.slice(-6)
    const employeeCode = `E2E${suffix}`

    await test.step('1. Open the account list', async () => {
      await gotoAs(page, browser, admin, '/admin/accounts')
      await expect(page.getByRole('heading', { name: ADMIN_ACCOUNTS.heading })).toBeVisible()
    })

    await test.step('2. Open the create dialog', async () => {
      await page.getByRole('button', { name: ADMIN_ACCOUNTS.addButton }).click()
      await expect(page.getByText(ADMIN_ACCOUNTS.modalHeading)).toBeVisible()
    })

    await test.step('3. Fill the mandatory fields and pick a department', async () => {
      await page.getByPlaceholder(ADMIN_ACCOUNTS.employeeCodePlaceholder).fill(employeeCode)
      await page.getByPlaceholder(ADMIN_ACCOUNTS.fullNamePlaceholder).fill(`E2E Nhân viên ${suffix}`)
      await page.getByPlaceholder(ADMIN_ACCOUNTS.emailPlaceholder).fill(`e2e${suffix}@example.com`)
      await page.getByPlaceholder(ADMIN_ACCOUNTS.departmentPlaceholder).click()
      await page.locator('[role="option"], .dept-combobox__option').first().click()
      await page.getByRole('checkbox').first().check()
    })

    await test.step('4. Save', async () => {
      await page.getByRole('button', { name: ADMIN_ACCOUNTS.save }).click()
    })

    await test.step('5. Assert the new account is searchable in the list', async () => {
      await page.getByPlaceholder(ADMIN_ACCOUNTS.searchPlaceholder).fill(employeeCode)
      await expect(page.getByText(employeeCode).first()).toBeVisible()
    })
  })

  test('L4-F05-02 | User Journey - Happy: an admin publishes a checklist version and the badge turns active', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const adminApi = await apiClient(admin)

    try {
      const formId = await test.step('1. Seed a form with one draft version (API)', async () => {
        const suffix = `${Date.now()}`.slice(-6)
        const form = await adminApi.post('/forms', {
          code: `E2EPUB${suffix}`,
          title: `E2E công bố ${suffix}`,
          subjectType: 'USER',
        }, 'seed form')
        await adminApi.post(`/forms/${form.id}/versions`, {
          title: 'Phiên bản E2E',
          settings: { scoringEnabled: true },
          sections: [{
            sectionKey: crypto.randomUUID(),
            title: 'Tiêu chí',
            displayOrder: 0,
            items: [{
              itemKey: crypto.randomUUID(),
              itemType: 'QUESTION',
              displayOrder: 0,
              question: {
                questionKey: crypto.randomUUID(),
                code: `E2E_PUB_${suffix}`,
                title: 'Đạt yêu cầu?',
                fieldType: 'SINGLE_CHOICE',
                required: true,
                weight: 1,
                options: [
                  { optionKey: crypto.randomUUID(), value: 'NO', label: 'Không', scoreValue: 0, displayOrder: 0 },
                  { optionKey: crypto.randomUUID(), value: 'YES', label: 'Có', scoreValue: 1, displayOrder: 1 },
                ],
              },
            }],
          }],
        }, 'seed draft version')
        return form.id
      })

      await test.step('2. Open the version manager', async () => {
        await gotoAs(page, browser, admin, `/admin/quality/checklists/${formId}/edit`)
        await expect(page.getByText(ADMIN_CHECKLISTS.versionsHeading)).toBeVisible()
      })

      await test.step('3. Publish the draft version', async () => {
        await page.getByRole('button', { name: ADMIN_CHECKLISTS.publish }).first().click()
      })

      await test.step('4. Assert the version now reports the active badge', async () => {
        await expect(page.getByText(ADMIN_CHECKLISTS.publishedBadge).first()).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
    }
  })

  test('L4-F05-03 | Negative UI: assigning a checklist that has no published version is blocked with an explanation', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const adminApi = await apiClient(admin)

    try {
      const formId = await test.step('1. Seed a form with no published version (API)', async () => {
        const suffix = `${Date.now()}`.slice(-6)
        const form = await adminApi.post('/forms', {
          code: `E2ENOP${suffix}`,
          title: `E2E chưa công bố ${suffix}`,
          subjectType: 'USER',
        }, 'seed form')
        return form.id
      })

      await test.step('2. Open its assignment screen', async () => {
        await gotoAs(page, browser, admin, `/admin/quality/checklists/${formId}/assignments`)
      })

      await test.step('3. Assert the screen refuses to assign and says why', async () => {
        await expect(page.getByText(ADMIN_CHECKLISTS.notPublishedWarning, { exact: false })).toBeVisible()
      })
    } finally {
      await adminApi.dispose()
    }
  })
})
