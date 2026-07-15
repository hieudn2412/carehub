import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const evaluationDashboardApi = {
  getDashboard(params = {}) {
    return httpClient.get('/evaluation-dashboard', {
      headers: authHeaders(),
      params,
    })
  },

  getQuestionBankSummary() {
    return httpClient.get('/evaluation-dashboard/question-bank-summary', {
      headers: authHeaders(),
    })
  },

  getExamResultsSummary() {
    return httpClient.get('/evaluation-dashboard/exam-results-summary', {
      headers: authHeaders(),
    })
  },

  getQuestionItemAnalysis(params = {}) {
    return httpClient.get('/evaluation-dashboard/question-item-analysis', {
      headers: authHeaders(),
      params,
    })
  },

  getDiscriminationIndex(params = {}) {
    return httpClient.get('/evaluation-dashboard/discrimination-index', {
      headers: authHeaders(),
      params,
    })
  },

  getWrongAnswerDistribution(params = {}) {
    return httpClient.get('/evaluation-dashboard/wrong-answer-distribution', {
      headers: authHeaders(),
      params,
    })
  },
}
