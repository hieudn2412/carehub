import { expect, request as playwrightRequest } from '@playwright/test'

/**
 * Data seeding over HTTP.
 *
 * E2E is about the browser, not about clicking twelve admin screens to build a precondition. These
 * helpers create the rows a journey needs by calling the same REST endpoints the L3 suite already
 * pins (see docs/l3-system-api-tests/), then the spec starts at the screen it actually tests.
 *
 * The backend is reached directly on API_BASE (default http://localhost:8081/api/v1) rather than
 * through the Vite proxy, so seeding does not depend on the dev server being up yet.
 */

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:8081/api/v1'

export async function apiClient(account) {
  const context = await playwrightRequest.newContext({ baseURL: API_BASE })
  const login = await context.post('/auth/login', {
    data: { employeeCode: account.employeeCode, password: account.password },
  })
  expect(login.ok(), `seed login failed for ${account.employeeCode}: ${login.status()}`).toBeTruthy()
  const token = (await login.json()).data.accessToken

  const authorised = (options = {}) => ({
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  })

  const unwrap = async (response, what) => {
    expect(response.ok(), `${what} failed: ${response.status()} ${await response.text()}`).toBeTruthy()
    const body = await response.json()
    return body.data
  }

  return {
    token,
    raw: context,
    get: async (path, what = `GET ${path}`) => unwrap(await context.get(path, authorised()), what),
    post: async (path, data, what = `POST ${path}`) =>
      unwrap(await context.post(path, authorised({ data })), what),
    put: async (path, data, what = `PUT ${path}`) =>
      unwrap(await context.put(path, authorised({ data })), what),
    patch: async (path, data, what = `PATCH ${path}`) =>
      unwrap(await context.patch(path, authorised({ data })), what),
    delete: async (path, what = `DELETE ${path}`) =>
      unwrap(await context.delete(path, authorised()), what),
    dispose: () => context.dispose(),
  }
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9)

/** Active training activity type — the one precondition every CME journey needs. */
export async function seedActivityType(admin) {
  const suffix = stamp()
  return admin.post('/training/activity-types', {
    code: `E2E${suffix}`.slice(0, 50),
    name: `E2E hình thức ${suffix}`,
    description: 'Tạo bởi bộ test E2E L4',
    defaultDurationUnit: 'HOUR',
    requiresEvidence: false,
    sortOrder: 0,
    active: true,
  }, 'seed activity type')
}

export async function seedProfessionalField(admin) {
  const suffix = stamp()
  return admin.post('/training/professional-fields', {
    code: `E2EPF${suffix}`.slice(0, 50),
    name: `E2E lĩnh vực ${suffix}`,
    active: true,
  }, 'seed professional field')
}

/** A submitted-ready draft training record owned by `employeeId`. */
export async function seedTrainingRecord(client, {
  activityTypeId,
  employeeId,
  professionalFieldId,
  hours = 2,
  title,
  startDate = '2026-06-01',
  endDate = startDate,
}) {
  return client.post('/training/records', {
    employeeId,
    activityTypeId,
    ...(professionalFieldId != null ? { professionalFieldId } : {}),
    title: title ?? `E2E hồ sơ ${stamp()}`,
    provider: 'Bệnh viện Việt Đức',
    description: 'Tạo bởi bộ test E2E L4',
    startDate,
    endDate,
    durationValue: hours,
    durationUnit: 'HOUR',
    declaredHours: hours,
  }, 'seed training record')
}

/**
 * A published checklist with exactly one required SINGLE_CHOICE question, assigned to `assigneeId`.
 * Returns the ids the spec needs plus the question/option keys so answers can be filled by API too.
 */
export async function seedAssignedChecklist(admin, assigneeId) {
  const suffix = stamp()
  const questionKey = crypto.randomUUID()
  const optionLow = crypto.randomUUID()
  const optionHigh = crypto.randomUUID()

  const form = await admin.post('/forms', {
    code: `E2EF${suffix}`.slice(0, 50),
    title: `E2E bảng kiểm ${suffix}`,
    subjectType: 'USER',
  }, 'seed form')

  const version = await admin.post(`/forms/${form.id}/versions`, {
    title: `E2E phiên bản ${suffix}`,
    settings: { scoringEnabled: true },
    sections: [{
      sectionKey: crypto.randomUUID(),
      title: 'Tiêu chí kiểm tra',
      displayOrder: 0,
      items: [{
        itemKey: crypto.randomUUID(),
        itemType: 'QUESTION',
        displayOrder: 0,
        question: {
          questionKey,
          code: `E2E_Q_${suffix}`,
          title: 'Nhân viên tuân thủ quy trình?',
          fieldType: 'SINGLE_CHOICE',
          required: true,
          weight: 1,
          options: [
            { optionKey: optionLow, value: 'NO', label: 'Không', scoreValue: 0, displayOrder: 0 },
            { optionKey: optionHigh, value: 'YES', label: 'Có', scoreValue: 1, displayOrder: 1 },
          ],
        },
      }],
    }],
  }, 'seed form version')

  await admin.post(`/forms/${form.id}/versions/${version.id}/publication`, undefined, 'publish form version')

  const assignment = await admin.post('/form-assignments', {
    managerId: assigneeId,
    formVersionIds: [version.id],
  }, 'seed form assignment')

  return {
    formId: form.id,
    versionId: version.id,
    assignmentItemId: assignment.items[0].assignmentItemId,
    questionKey,
    optionHighKey: optionHigh,
    optionLowKey: optionLow,
  }
}

/**
 * The whole direct-bank exam chain: question(category + field + cognitive) → audience → blueprint
 * → paper → open assignment targeting `assigneeId`. This intentionally does not create a legacy
 * QuestionSet or send a single professionalFieldId/inline target to the assignment API.
 */
export async function seedOpenExamAssignment(admin, assigneeId, { maxAttempts = 2 } = {}) {
  const suffix = stamp()
  const field = await seedProfessionalField(admin)

  const category = await admin.post('/question-categories', {
    code: `E2EQC${suffix}`.slice(0, 80),
    name: `E2E danh mục ${suffix}`,
    status: 'ACTIVE',
  }, 'seed question category')

  const question = await admin.post('/questions', {
    stem: `E2E câu hỏi ${suffix}?`,
    optionA: 'Đúng',
    optionB: 'Sai',
    optionC: 'Có thể',
    optionD: 'Không rõ',
    correctAnswer: 'A',
    categoryId: category.id,
    professionalFieldId: field.id,
    cognitiveLevel: 'FOUNDATION',
    language: 'vi',
    status: 'APPROVED',
  }, 'seed question')

  const audience = await admin.post('/evaluation-audiences', {
    name: `E2E đối tượng ${suffix}`,
    ruleJson: JSON.stringify({ version: 1, all: [{ type: 'USER_IN', ids: [assigneeId] }] }),
  }, 'seed evaluation audience')
  await admin.post(`/evaluation-audiences/${audience.id}/activate`, {}, 'activate evaluation audience')

  const config = await admin.post('/exam-configs', {
    name: `E2E cấu hình ${suffix}`,
    audienceId: audience.id,
    totalQuestions: 1,
    timeLimitMinutes: 60,
    passingScore: 5,
    maxRetakes: maxAttempts,
    shuffleQuestions: false,
    shuffleOptions: false,
    questionSelectionMode: 'FIXED_PAPER',
    fieldBlueprints: [{
      professionalFieldId: field.id,
      percentage: 100,
      displayOrder: 0,
      cognitive: [
        { cognitiveLevel: 'FOUNDATION', percentage: 100 },
        { cognitiveLevel: 'CLINICAL_APPLICATION', percentage: 0 },
        { cognitiveLevel: 'CLINICAL_REASONING_ANALYSIS', percentage: 0 },
      ],
    }],
    sourceFilters: {
      includedCategoryIds: [category.id],
      excludedCategoryIds: [],
      includedDocumentIds: [],
      excludedDocumentIds: [],
    },
  }, 'seed exam config')
  await admin.post(`/exam-configs/${config.id}/activate`, {}, 'activate exam config')

  const papers = await admin.post('/exam-papers/generate', {
    examConfigId: config.id,
    namePrefix: `E2E đề ${suffix}`,
    variantCount: 1,
    randomSeed: 42,
    idempotencyKey: `e2e-paper-${suffix}`,
  }, 'generate exam paper')
  const paperId = papers[0].id
  await admin.post(`/exam-papers/${paperId}/publish`, {}, 'publish exam paper')

  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
  const assignment = await admin.post('/exam-assignments', {
    name: `E2E phân công ${suffix}`,
    examPaperId: paperId,
    audienceId: audience.id,
    maxAttempts,
    resultVisibility: 'SCORE_AND_ANSWERS',
    status: 'DRAFT',
    dueAt,
    idempotencyKey: `e2e-assignment-${suffix}`,
  }, 'seed exam assignment')
  await admin.post(`/exam-assignments/${assignment.id}/open`, {}, 'open exam assignment')

  return { assignmentId: assignment.id, paperId, questionId: question.id, professionalFieldId: field.id, audienceId: audience.id, dueAt }
}

/** The caller's own user id — needed to target assignments at the staff account. */
export async function currentUserId(client) {
  const me = await client.get('/me', 'read own profile')
  return me.id
}
