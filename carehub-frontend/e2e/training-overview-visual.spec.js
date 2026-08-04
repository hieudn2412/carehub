import { expect, test } from '@playwright/test'

const currentYear = new Date().getFullYear()
const previousYear = currentYear - 1
const viewports = [
  { name: 'mobile-320', width: 320, height: 760 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
]

const records = [
  {
    id: 101,
    title: 'Hồ sơ nháp kiểm thử giao diện',
    workflowStatus: 'DRAFT',
    startDate: `${currentYear}-01-10`,
    submittedAt: null,
    declaredHours: 4,
    professionalFieldName: 'Hồi sức cấp cứu',
    version: 0,
  },
  {
    id: 102,
    title: 'Hồ sơ đã nộp kiểm thử giao diện',
    workflowStatus: 'SUBMITTED',
    startDate: `${currentYear}-02-10`,
    submittedAt: `${currentYear}-02-11T08:00:00Z`,
    declaredHours: 8,
    professionalFieldName: 'Ngoại khoa với tên lĩnh vực chuyên môn rất dài',
    version: 1,
  },
  {
    id: 103,
    title: 'Hồ sơ đã hủy kiểm thử giao diện',
    workflowStatus: 'CANCELLED',
    startDate: `${currentYear}-03-10`,
    submittedAt: null,
    declaredHours: 2,
    professionalFieldName: null,
    version: 1,
  },
]

function apiEnvelope(data) {
  return { data }
}

function fakeAccessToken(role = 'USER') {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: '42',
    roles: [role],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`
}

async function installSessionAndTrainingApi(page, {
  chartState = 'data',
  listState = 'data',
  chartDelayMs = 0,
  chartFieldCount = 18,
  role = 'USER',
  pendingExamCount = 0,
  unreadCount = 0,
  competencyAssignments = null,
  competencySummary = null,
  competencyAttempt = null,
} = {}) {
  const requestedChartYears = []
  await page.addInitScript((token) => {
    window.sessionStorage.setItem('carehub.accessToken', token)
    window.sessionStorage.setItem('carehub.refreshToken', 'visual-refresh-token')
    window.sessionStorage.setItem('carehub.requiresFirstLoginSetup', 'false')
  }, fakeAccessToken(role))

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^.*\/api\/v1/, '')
    const fulfill = (data, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })

    if (path === '/me') {
      return fulfill(apiEnvelope({
        id: 42,
        fullName: 'Nhân viên Visual QA',
        employeeCode: 'VISUAL-QA',
        roles: [{ name: role }],
      }))
    }
    if (path === '/me/notifications') {
      return fulfill(apiEnvelope({ content: [], totalElements: 0 }))
    }
    if (path === '/me/notifications/unread-count') {
      return fulfill(apiEnvelope({ unreadCount }))
    }
    if (path === '/me/exam-assignments') {
      const assignments = competencyAssignments || Array.from({ length: pendingExamCount }, (_, index) => ({
        id: index + 1,
        status: 'ASSIGNED',
        actionable: true,
      }))
      return fulfill(apiEnvelope(assignments))
    }
    if (path === '/me/competency/summary') {
      return fulfill(apiEnvelope(competencySummary || {
        fromDate: `${currentYear}-01-01`,
        toDate: `${currentYear}-08-31`,
        knowledgeAverage: 7.5,
        skillAverage: 6.5,
        knowledgeAttemptCount: 3,
        skillEvaluationCount: 8,
        overallScore: 7,
        targetScore: 5,
        isPassed: true,
      }))
    }
    if (request.method() === 'GET' && path.match(/^\/me\/exam-attempts\/\d+$/)) {
      return fulfill(apiEnvelope(competencyAttempt || {
        id: Number(path.split('/').at(-1)),
        assignmentId: 11,
        assignmentName: 'Bài kiểm tra đã hoàn tất',
        examPaperName: 'Bộ đề kiểm tra',
        status: 'SUBMITTED',
        statusText: 'Đã nộp',
        submittedAt: `${currentYear}-08-03T09:30:00`,
        expiresAt: `${currentYear}-08-03T10:00:00`,
        score: 8.5,
        correctCount: 1,
        totalQuestions: 1,
        passed: true,
        questions: [{
          paperQuestionId: 5001,
          position: 1,
          stem: 'Đâu là thao tác đúng?',
          optionA: 'Thao tác A',
          optionB: 'Thao tác B',
          optionC: 'Thao tác C',
          optionD: 'Thao tác D',
          selectedAnswer: 'A',
        }],
        answers: [{ paperQuestionId: 5001, position: 1, selectedAnswer: 'A', correct: true, correctAnswer: 'A', explanation: 'Đúng' }],
      }))
    }
    if (request.method() === 'POST' && path.match(/^\/me\/exam-assignments\/\d+\/start$/)) {
      const id = Number(path.split('/')[3])
      return fulfill(apiEnvelope({ id: id + 1000 }))
    }
    if (path === '/training/status/me') {
      return fulfill(apiEnvelope({
        status: 'CONFIGURED',
        submittedHours: 72,
        requiredHours: 120,
      }))
    }
    if (path === '/training/status/me/professional-field-hours') {
      requestedChartYears.push(Number(url.searchParams.get('year')))
      if (chartDelayMs) await new Promise((resolve) => setTimeout(resolve, chartDelayMs))
      if (chartState === 'error') return fulfill({ message: 'chart error' }, 500)
      const fields = chartState === 'empty'
        ? []
        : Array.from({ length: chartFieldCount }, (_, index) => ({
            professionalFieldId: index + 1,
            professionalFieldName: index === 0
              ? 'Ngoại khoa với tên lĩnh vực chuyên môn rất dài cần được cắt gọn'
              : `Lĩnh vực ${index + 1}`,
            submittedHours: index + 1.5,
          }))
      return fulfill(apiEnvelope({
        year: Number(url.searchParams.get('year')) || currentYear,
        availableYears: [currentYear, previousYear],
        fields,
      }))
    }
    if (path === '/training/records/options') {
      return fulfill(apiEnvelope({
        professionalFields: [{ id: 1, name: 'Hồi sức cấp cứu' }],
        activityTypes: [{ id: 2, name: 'Hội thảo' }],
      }))
    }
    if (path === '/training/records') {
      if (listState === 'error') return fulfill({ message: 'list error' }, 500)
      if (listState === 'loading') await new Promise((resolve) => setTimeout(resolve, 900))
      let content = listState === 'empty' ? [] : [...records]
      const q = (url.searchParams.get('titleKeyword') || '').toLowerCase()
      const status = url.searchParams.get('workflowStatus')
      if (q) content = content.filter((record) => record.title.toLowerCase().includes(q))
      if (status) content = content.filter((record) => record.workflowStatus === status)
      if (url.searchParams.get('size') === '1') {
        content = content.filter((record) => record.workflowStatus === 'SUBMITTED').slice(0, 1)
      }
      return fulfill(apiEnvelope({
        content,
        totalElements: content.length,
        totalPages: content.length ? 1 : 0,
      }))
    }
    return fulfill(apiEnvelope([]))
  })

  return { requestedChartYears }
}

async function hasDocumentOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

test.describe('Training overview deterministic browser QA', () => {
  test('layout order, chart year, search, filters and action visibility', async ({ page }) => {
    const api = await installSessionAndTrainingApi(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/staff/training')

    await expect(page.locator('[data-overview-section]')).toHaveCount(4)
    expect(await page.locator('[data-overview-section]').evaluateAll((sections) =>
      sections.map((section) => section.dataset.overviewSection)))
      .toEqual(['chart', 'progress', 'tools', 'latest'])

    await page.getByRole('combobox', { name: 'Năm biểu đồ' }).selectOption(String(previousYear))
    await expect.poll(() => api.requestedChartYears.at(-1)).toBe(previousYear)

    const search = page.getByRole('textbox', { name: 'Tìm theo nội dung đào tạo' })
    await search.fill('Hồ sơ nháp')
    await search.press('Enter')
    await page.waitForURL((url) =>
      url.pathname === '/staff/training/all' && url.searchParams.get('q') === 'Hồ sơ nháp')
    await expect(page.getByRole('button', { name: 'Xem chi tiết Hồ sơ nháp kiểm thử giao diện' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Chỉnh sửa Hồ sơ nháp kiểm thử giao diện' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Xóa hồ sơ Hồ sơ nháp kiểm thử giao diện' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Nộp hồ sơ/ })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Minh chứng' })).toHaveCount(0)

    await page.goto('/staff/training/all')
    await page.getByRole('button', { name: 'Mở bộ lọc' }).click()
    await page.getByRole('combobox', { name: 'Lọc theo trạng thái hồ sơ' }).selectOption('SUBMITTED')
    await page.getByLabel('Lọc từ ngày').fill(`${currentYear}-01-01`)
    await page.getByLabel('Lọc đến ngày').fill(`${currentYear}-12-31`)
    await page.getByRole('combobox', { name: 'Lọc theo lĩnh vực chuyên môn' }).selectOption('1')
    await page.getByRole('combobox', { name: 'Lọc theo hình thức đào tạo' }).selectOption('2')
    await page.getByRole('button', { name: 'Áp dụng' }).click()
    await page.waitForURL((url) =>
      url.searchParams.get('status') === 'SUBMITTED'
      && url.searchParams.get('professionalFieldId') === '1'
      && url.searchParams.get('activityTypeId') === '2')
    await expect(page.getByRole('button', { name: 'Xem chi tiết Hồ sơ đã nộp kiểm thử giao diện' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Chỉnh sửa Hồ sơ đã nộp/ })).toHaveCount(0)
  })

  test('one professional field renders as a single chart column', async ({ page }) => {
    await installSessionAndTrainingApi(page, { chartFieldCount: 1 })
    await page.goto('/staff/training')

    await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(1)
    await expect(page.getByText('Ngoại khoa với tên lĩnh vực chuyên môn rất dài cần được cắt gọn')).toHaveCount(0)
    await expect(page.locator('.th-overview-chart-scroll')).toBeVisible()
    expect(await hasDocumentOverflow(page)).toBe(false)
  })

  test('mobile toolbar shows exam count and applies training search filters from a bottom sheet', async ({ page }) => {
    await installSessionAndTrainingApi(page, { pendingExamCount: 3, unreadCount: 2 })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/staff/training')

    await expect(page.getByRole('button', { name: 'Mở menu điều hướng' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mở tìm kiếm và bộ lọc giờ đào tạo' })).toBeVisible()
    await expect(page.getByRole('link', { name: '3 bài kiểm tra chưa làm' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mở thông báo' })).toBeVisible()
    await expect(page.locator('.account-dropdown__trigger')).toBeVisible()

    const searchButton = page.getByRole('button', { name: 'Mở tìm kiếm và bộ lọc giờ đào tạo' })
    await searchButton.click()
    const sheet = page.getByRole('dialog', { name: 'Tìm kiếm giờ đào tạo' })
    await expect(sheet).toBeVisible()
    const query = sheet.getByRole('textbox', { name: 'Tìm theo nội dung đào tạo' })
    await expect(query).toBeFocused()
    await query.fill('Hồ sơ nháp')
    await sheet.getByRole('combobox', { name: 'Bộ lọc trạng thái' }).selectOption('DRAFT')
    await sheet.getByLabel('Bộ lọc từ ngày').fill(`${currentYear}-01-01`)
    await sheet.getByLabel('Bộ lọc đến ngày').fill(`${currentYear}-12-31`)
    await sheet.getByRole('combobox', { name: 'Bộ lọc lĩnh vực chuyên môn' }).selectOption('1')
    await sheet.getByRole('combobox', { name: 'Bộ lọc hình thức đào tạo' }).selectOption('2')
    await sheet.getByRole('button', { name: 'Áp dụng' }).click()

    await page.waitForURL((url) => url.pathname === '/staff/training/all'
      && url.searchParams.get('q') === 'Hồ sơ nháp'
      && url.searchParams.get('status') === 'DRAFT'
      && url.searchParams.get('professionalFieldId') === '1'
      && url.searchParams.get('activityTypeId') === '2'
      && !url.searchParams.get('page'))
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('professional competency dashboard shows summary cards, available exams and full-list link', async ({ page }) => {
    await installSessionAndTrainingApi(page, {
      competencyAssignments: [
        { id: 11, name: 'Bài đang làm', professionalFieldName: 'Hồi sức', dueAt: `${currentYear}-08-10T08:00:00Z`, createdAt: `${currentYear}-07-01T08:00:00Z`, currentAttemptId: 901, actionable: true },
        { id: 12, name: 'Bài gần hạn', professionalFieldName: 'Ngoại khoa', dueAt: `${currentYear}-08-05T08:00:00Z`, createdAt: `${currentYear}-07-02T08:00:00Z`, actionable: true },
        { id: 13, name: 'Bài thứ ba', dueAt: `${currentYear}-08-20T08:00:00Z`, createdAt: `${currentYear}-07-03T08:00:00Z`, actionable: true },
        { id: 14, name: 'Bài thứ tư', dueAt: `${currentYear}-08-21T08:00:00Z`, createdAt: `${currentYear}-07-04T08:00:00Z`, actionable: true },
        { id: 15, name: 'Không được hiển thị', dueAt: `${currentYear}-08-22T08:00:00Z`, createdAt: `${currentYear}-07-05T08:00:00Z`, actionable: true },
      ],
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/staff/professional-competency')

    await expect(page.getByRole('heading', { name: 'Kiến thức' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kỹ năng' })).toBeVisible()
    await expect(page.getByText('7,0')).toBeVisible()
    await expect(page.getByText('Đạt')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kiểm tra kiến thức' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bài đang làm/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Không được hiển thị/ })).toHaveCount(0)

    await page.getByRole('button', { name: /Bài đang làm/ }).click()
    await page.waitForURL('/staff/exam/take/901')

    await page.goto('/staff/professional-competency')
    await page.getByRole('button', { name: /Xem toàn bộ/ }).click()
    await page.waitForURL('/staff/professional-competency/all')
  })

  test('professional competency mobile search sheet validates dates and keeps the page within the viewport', async ({ page }) => {
    await installSessionAndTrainingApi(page, {
      pendingExamCount: 2,
      competencyAssignments: [{
        id: 701,
        name: 'Kiểm tra an toàn người bệnh',
        actionable: true,
        dueAt: `${currentYear}-09-15T12:00:00`,
        createdAt: `${currentYear}-08-01T08:00:00`,
      }, {
        id: 702,
        name: 'Kiểm tra kiểm soát nhiễm khuẩn',
        actionable: true,
        dueAt: `${currentYear}-10-15T12:00:00`,
        createdAt: `${currentYear}-08-02T08:00:00`,
      }],
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/staff/professional-competency')

    const searchButton = page.getByRole('button', { name: 'Mở tìm kiếm năng lực chuyên môn' })
    await expect(searchButton).toBeVisible()
    await expect(page.getByRole('link', { name: '2 bài kiểm tra chưa làm' })).toBeVisible()
    await searchButton.click()

    const sheet = page.getByRole('dialog', { name: 'Tìm kiếm năng lực chuyên môn' })
    await expect(sheet.getByRole('textbox', { name: 'Tìm bài kiểm tra' })).toBeFocused()
    await sheet.getByLabel('Từ ngày năng lực').fill(`${currentYear}-09-10`)
    await sheet.getByLabel('Đến ngày năng lực').fill(`${currentYear}-09-01`)
    await sheet.getByRole('button', { name: 'Áp dụng' }).click()
    await expect(sheet.getByRole('alert')).toHaveText('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(new URL(page.url()).pathname).toBe('/staff/professional-competency')

    await sheet.getByRole('textbox', { name: 'Tìm bài kiểm tra' }).fill('an toàn')
    await sheet.getByLabel('Đến ngày năng lực').fill(`${currentYear}-09-20`)
    await sheet.getByRole('button', { name: 'Áp dụng' }).click()
    await page.waitForURL(url => url.pathname === '/staff/professional-competency'
      && url.searchParams.get('q') === 'an toàn'
      && url.searchParams.get('dateFrom') === `${currentYear}-09-10`
      && url.searchParams.get('dateTo') === `${currentYear}-09-20`)
    expect(await hasDocumentOverflow(page)).toBe(false)
  })

  test('completed exam eye opens a read-only review instead of the exam submission screen', async ({ page }) => {
    await installSessionAndTrainingApi(page, {
      competencyAssignments: [{
        id: 11,
        name: 'Bài kiểm tra đã hoàn tất',
        actionable: false,
        assessmentStatus: 'PASSED',
        detailAttemptId: 901,
        usedAttempts: 1,
        maxAttempts: 1,
      }],
    })
    await page.goto('/staff/professional-competency/all')

    await page.getByRole('button', { name: 'Xem kết quả Bài kiểm tra đã hoàn tất' }).click()
    await page.waitForURL('/staff/exam/take/901')
    await expect(page.getByRole('heading', { name: 'Xem lại bài kiểm tra' })).toBeVisible()
    await expect(page.getByText('8,5/10')).toBeVisible()
    await expect(page.getByText('Bạn đang xem lại bài làm')).toBeVisible()
    await expect(page.getByRole('button', { name: /Nộp bài/ })).toHaveCount(0)
    await expect(page.locator('.eh-option-row--correct')).toHaveCount(1)
    await expect(page.locator('.eh-option-row input:disabled')).toHaveCount(4)

    await page.getByRole('button', { name: 'Quay lại' }).click()
    await page.waitForURL('/staff/professional-competency/all')
  })

  test('create, view and edit controls keep their established routes', async ({ page }) => {
    await installSessionAndTrainingApi(page)
    await page.goto('/staff/training')

    await page.getByRole('button', { name: 'Cập nhật giờ đào tạo' }).click()
    await page.waitForURL('/staff/training/new')

    await page.goto('/staff/training/all?q=H%E1%BB%93%20s%C6%A1%20nh%C3%A1p')
    await page.getByRole('button', { name: 'Chỉnh sửa Hồ sơ nháp kiểm thử giao diện' }).click()
    await page.waitForURL('/staff/training/101/edit')

    await page.goto('/staff/training/all?q=H%E1%BB%93%20s%C6%A1%20nh%C3%A1p')
    await page.getByRole('button', { name: 'Xem chi tiết Hồ sơ nháp kiểm thử giao diện' }).click()
    await page.waitForURL('/staff/training/101')
  })

  for (const viewport of viewports) {
    test(`responsive ${viewport.name} keeps overflow inside chart and table regions`, async ({ page }, testInfo) => {
      await installSessionAndTrainingApi(page)
      await page.setViewportSize(viewport)
      await page.goto('/staff/training')
      await expect(page.getByRole('heading', { name: 'Giờ đào tạo theo lĩnh vực' })).toBeVisible()
      expect(await hasDocumentOverflow(page), `overview overflows at ${viewport.width}px`).toBe(false)

      const chartScroll = page.locator('.th-overview-chart-scroll')
      await expect(chartScroll).toBeVisible()
      expect(await chartScroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)

      await page.goto('/staff/training/all')
      await expect(page.getByRole('table')).toBeVisible()
      expect(await hasDocumentOverflow(page), `full list overflows at ${viewport.width}px`).toBe(false)
      const listBody = page.locator('.training-page--list .th-table tbody')
      expect(await listBody.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        `full list should stack vertically at ${viewport.width}px`).toBe(true)
      if (viewport.width <= 768) {
        const pageBody = page.locator('.training-hours-list-shell .app-shell__body')
        expect(await pageBody.evaluate((element) => element.scrollHeight > element.clientHeight),
          `full list should scroll vertically at ${viewport.width}px`).toBe(true)
        await pageBody.evaluate((element) => { element.scrollTop = element.scrollHeight })
        expect(await pageBody.evaluate((element) => element.scrollTop > 0),
          `full list vertical scroll did not move at ${viewport.width}px`).toBe(true)
      }
      await testInfo.attach(`training-${viewport.name}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    })
  }

  test('empty, loading and error states remain independently readable', async ({ browser }) => {
    const emptyContext = await browser.newContext()
    const emptyPage = await emptyContext.newPage()
    await installSessionAndTrainingApi(emptyPage, { chartState: 'empty', listState: 'empty' })
    await emptyPage.goto('/staff/training')
    await expect(emptyPage.getByText(`Chưa có dữ liệu biểu đồ trong năm ${currentYear}.`)).toBeVisible()
    await expect(emptyPage.getByText('Chưa có hồ sơ giờ đào tạo đã nộp.')).toBeVisible()
    await emptyPage.goto('/staff/training/all')
    await expect(emptyPage.getByText('Chưa có hồ sơ nào')).toBeVisible()
    await emptyContext.close()

    const loadingContext = await browser.newContext()
    const loadingPage = await loadingContext.newPage()
    await installSessionAndTrainingApi(loadingPage, { chartDelayMs: 900, listState: 'loading' })
    await loadingPage.goto('/staff/training')
    await expect(loadingPage.getByText('Đang tải biểu đồ...')).toBeVisible()
    await expect(loadingPage.getByText('Đang tải hồ sơ gần nhất...')).toBeVisible()
    await loadingPage.goto('/staff/training/all')
    await expect(loadingPage.getByText('Đang tải danh sách...')).toBeVisible()
    await loadingContext.close()

    const errorContext = await browser.newContext()
    const errorPage = await errorContext.newPage()
    await installSessionAndTrainingApi(errorPage, { chartState: 'error', listState: 'error' })
    await errorPage.goto('/staff/training')
    await expect(errorPage.getByText('Không thể tải biểu đồ giờ đào tạo.')).toBeVisible()
    await expect(errorPage.getByText('Không thể tải hồ sơ giờ đào tạo gần nhất.')).toBeVisible()
    await errorPage.goto('/staff/training/all')
    await expect(errorPage.getByText('Không thể tải danh sách giờ đào tạo.')).toBeVisible()
    await expect(errorPage.getByRole('button', { name: /Thử lại/ })).toBeVisible()
    await errorContext.close()
  })

  test('primary overview controls expose a visible keyboard focus state', async ({ page }) => {
    await installSessionAndTrainingApi(page)
    await page.goto('/staff/training')
    const controls = [
      page.getByRole('combobox', { name: 'Năm biểu đồ' }),
      page.getByRole('textbox', { name: 'Tìm theo nội dung đào tạo' }),
      page.getByRole('button', { name: 'Mở bộ lọc giờ đào tạo' }),
      page.getByRole('button', { name: 'Cập nhật giờ đào tạo' }),
    ]

    const expectVisibleFocus = async (control) => {
      await expect(control).toBeFocused()
      const focusVisible = await control.evaluate((element) => {
        const style = getComputedStyle(element)
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none'
      })
      const controlName = await control.getAttribute('aria-label')
        ?? await control.textContent()
        ?? await control.getAttribute('placeholder')
      expect(focusVisible, `no visible focus style for ${controlName}`).toBe(true)
    }

    await controls[0].focus()
    await expectVisibleFocus(controls[0])
    await controls[1].focus()
    await expectVisibleFocus(controls[1])
    await page.keyboard.press('Tab')
    await expectVisibleFocus(controls[2])
    await page.keyboard.press('Tab')
    await expectVisibleFocus(controls[3])
  })
})
