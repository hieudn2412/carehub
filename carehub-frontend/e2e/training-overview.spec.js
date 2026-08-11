import { expect, test } from '@playwright/test'
import { ROLES, requireAccount } from './fixtures/accounts.js'
import { gotoAs } from './fixtures/auth.js'
import {
  apiClient,
  currentUserId,
  seedActivityType,
  seedProfessionalField,
  seedTrainingRecord,
} from './fixtures/api.js'

const currentYear = new Date().getFullYear()
const previousYear = currentYear - 1

test.describe('Training overview and full list', () => {
  test('overview order, chart year, search and the four combined filters work end to end', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)
    const title = `E2E tổng quan đào tạo ${Date.now()}`

    try {
      const activityType = await seedActivityType(adminApi)
      const professionalField = await seedProfessionalField(adminApi)
      const employeeId = await currentUserId(staffApi)
      const record = await seedTrainingRecord(staffApi, {
        activityTypeId: activityType.id,
        professionalFieldId: professionalField.id,
        employeeId,
        title,
        startDate: `${previousYear}-06-15`,
      })
      await staffApi.post(`/training/records/${record.id}/submit`, { version: record.version }, 'submit chart record')

      await gotoAs(page, browser, staff, '/staff/training')
      await expect(page.locator('[data-overview-section]')).toHaveCount(4)
      expect(await page.locator('[data-overview-section]').evaluateAll((sections) =>
        sections.map((section) => section.dataset.overviewSection)))
        .toEqual(['chart', 'progress', 'tools', 'latest'])

      const yearResponse = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.pathname.endsWith('/training/status/me/professional-field-hours')
          && url.searchParams.get('year') === String(previousYear)
      })
      await page.getByRole('combobox', { name: 'Năm biểu đồ' }).selectOption(String(previousYear))
      await yearResponse
      await expect(page.getByRole('combobox', { name: 'Năm biểu đồ' })).toHaveValue(String(previousYear))

      const search = page.getByRole('textbox', { name: 'Tìm theo nội dung đào tạo' })
      await search.fill(title)
      await search.press('Enter')
      await page.waitForURL((url) =>
        url.pathname === '/staff/training/all' && url.searchParams.get('q') === title)
      await expect(page.getByText(title, { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
      await page.getByRole('combobox', { name: 'Lọc theo trạng thái hồ sơ' }).selectOption('SUBMITTED')
      await page.getByLabel('Lọc từ ngày').fill(`${previousYear}-01-01`)
      await page.getByLabel('Lọc đến ngày').fill(`${previousYear}-12-31`)
      await page.getByRole('combobox', { name: 'Lọc theo lĩnh vực chuyên môn' })
        .selectOption(String(professionalField.id))
      await page.getByRole('combobox', { name: 'Lọc theo hình thức đào tạo' })
        .selectOption(String(activityType.id))
      await page.getByRole('button', { name: 'Áp dụng' }).click()

      await page.waitForURL((url) => (
        url.pathname === '/staff/training/all'
        && url.searchParams.get('status') === 'SUBMITTED'
        && url.searchParams.get('dateFrom') === `${previousYear}-01-01`
        && url.searchParams.get('dateTo') === `${previousYear}-12-31`
        && url.searchParams.get('professionalFieldId') === String(professionalField.id)
        && url.searchParams.get('activityTypeId') === String(activityType.id)
      ))
      await expect(page.getByText(title, { exact: true })).toBeVisible()
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })

  test('draft, submitted and cancelled rows expose only their allowed actions', async ({ page, browser }) => {
    const admin = requireAccount(test, ROLES.admin)
    const staff = requireAccount(test, ROLES.staff)
    const adminApi = await apiClient(admin)
    const staffApi = await apiClient(staff)
    const suffix = Date.now()
    const draftTitle = `E2E nháp ${suffix}`
    const submittedTitle = `E2E đã nộp ${suffix}`
    const cancelledTitle = `E2E đã hủy ${suffix}`

    try {
      const activityType = await seedActivityType(adminApi)
      const employeeId = await currentUserId(staffApi)
      await seedTrainingRecord(staffApi, {
        activityTypeId: activityType.id,
        employeeId,
        title: draftTitle,
      })
      const submitted = await seedTrainingRecord(staffApi, {
        activityTypeId: activityType.id,
        employeeId,
        title: submittedTitle,
      })
      await staffApi.post(`/training/records/${submitted.id}/submit`, { version: submitted.version }, 'submit action record')
      const cancelled = await seedTrainingRecord(staffApi, {
        activityTypeId: activityType.id,
        employeeId,
        title: cancelledTitle,
      })
      await staffApi.delete(`/training/records/${cancelled.id}?version=${cancelled.version}`, 'cancel action record')

      await gotoAs(page, browser, staff, `/staff/training/all?q=${encodeURIComponent(draftTitle)}`)
      await expect(page.getByRole('button', { name: `Xem chi tiết ${draftTitle}` })).toBeVisible()
      await expect(page.getByRole('button', { name: `Chỉnh sửa ${draftTitle}` })).toBeVisible()
      await expect(page.getByRole('button', { name: `Xóa hồ sơ ${draftTitle}` })).toBeVisible()
      await expect(page.getByRole('button', { name: /Nộp hồ sơ/ })).toHaveCount(0)
      await expect(page.getByRole('columnheader', { name: 'Minh chứng' })).toHaveCount(0)

      await page.goto(`/staff/training/all?q=${encodeURIComponent(submittedTitle)}`)
      await expect(page.getByRole('button', { name: `Xem chi tiết ${submittedTitle}` })).toBeVisible()
      await expect(page.getByRole('button', { name: `Chỉnh sửa ${submittedTitle}` })).toHaveCount(0)
      await expect(page.getByRole('button', { name: `Xóa hồ sơ ${submittedTitle}` })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Quản lý minh chứng/ })).toHaveCount(0)

      await page.goto(`/staff/training/all?q=${encodeURIComponent(cancelledTitle)}`)
      await expect(page.getByRole('button', { name: `Xem chi tiết ${cancelledTitle}` })).toBeVisible()
      await expect(page.getByRole('button', { name: `Chỉnh sửa ${cancelledTitle}` })).toHaveCount(0)
      await expect(page.getByRole('button', { name: `Xóa hồ sơ ${cancelledTitle}` })).toHaveCount(0)
    } finally {
      await adminApi.dispose()
      await staffApi.dispose()
    }
  })
})
