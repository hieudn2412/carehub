import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const resolvedResponse = { data: { data: {} }, headers: {} }
  const createRequestMock = () => vi.fn(() => Promise.resolve(resolvedResponse))

  return {
    httpClient: {
      get: createRequestMock(),
      post: createRequestMock(),
      put: createRequestMock(),
      patch: createRequestMock(),
      delete: createRequestMock(),
    },
    getAccessToken: vi.fn(() => 'access-token'),
  }
})

vi.mock('./httpClient.js', () => ({ httpClient: mocks.httpClient }))
vi.mock('../auth/tokenStorage.js', () => ({
  tokenStorage: {
    getAccessToken: mocks.getAccessToken,
  },
}))

import { adminApi } from '../../features/admin/api/adminApi.js'
import { authApi } from '../../features/auth/api/authApi.js'
import { classificationRuleApi } from '../../features/evaluation/api/classificationRuleApi.js'
import { documentQuestionApi } from '../../features/evaluation/api/documentQuestionApi.js'
import { evaluationAudienceApi } from '../../features/evaluation/api/evaluationAudienceApi.js'
import { evaluationAuditLogApi } from '../../features/evaluation/api/evaluationAuditLogApi.js'
import { evaluationDashboardApi } from '../../features/evaluation/api/evaluationDashboardApi.js'
import { evaluationImportApi } from '../../features/evaluation/api/evaluationImportApi.js'
import { competencyApi, examAssignmentApi } from '../../features/evaluation/api/examAssignmentApi.js'
import { examConfigApi } from '../../features/evaluation/api/examConfigApi.js'
import { examPaperApi } from '../../features/evaluation/api/examPaperApi.js'
import { myCompetencyApi } from '../../features/evaluation/api/myCompetencyApi.js'
import { myExamApi } from '../../features/evaluation/api/myExamApi.js'
import { questionBankApi } from '../../features/evaluation/api/questionBankApi.js'
import { questionCategoryApi } from '../../features/evaluation/api/questionCategoryApi.js'
import { trainingGroupApi } from '../../features/evaluation/api/trainingGroupApi.js'
import { notificationsApi } from '../../features/staff/api/notificationsApi.js'
import { staffApi } from '../../features/staff/api/staffApi.js'
import { trainingApi } from '../../features/training/api/trainingApi.js'

const facades = {
  adminApi,
  authApi,
  classificationRuleApi,
  competencyApi,
  documentQuestionApi,
  evaluationAudienceApi,
  evaluationAuditLogApi,
  evaluationDashboardApi,
  evaluationImportApi,
  examAssignmentApi,
  examConfigApi,
  examPaperApi,
  myCompetencyApi,
  myExamApi,
  notificationsApi,
  questionBankApi,
  questionCategoryApi,
  staffApi,
  trainingApi,
  trainingGroupApi,
}

const requestMocks = Object.values(mocks.httpClient)
const requestCount = () => requestMocks.reduce((total, request) => total + request.mock.calls.length, 0)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAccessToken.mockReturnValue('access-token')
})

describe('API facades', () => {
  for (const [facadeName, facade] of Object.entries(facades)) {
    describe(facadeName, () => {
      for (const [methodName, method] of Object.entries(facade)) {
        it(`${methodName} delegates exactly one request to the shared HTTP client`, async () => {
          const before = requestCount()

          await method.call(
            facade,
            'resource-id',
            { value: 'payload', variantCount: 2, zeroOverlap: false },
            { value: 'secondary-payload' },
          )

          expect(requestCount()).toBe(before + 1)
          const invokedRequest = requestMocks.find(request => request.mock.calls.length > 0)
          expect(invokedRequest).toHaveBeenCalledTimes(1)
          expect(invokedRequest.mock.calls[0][0]).toEqual(expect.stringMatching(/^\//))
        })
      }
    })
  }

  it('omits the Authorization header when no access token is stored', async () => {
    mocks.getAccessToken.mockReturnValue(null)

    await adminApi.getDepartments()

    expect(mocks.httpClient.get).toHaveBeenCalledWith('/departments', { headers: {} })
  })
})
