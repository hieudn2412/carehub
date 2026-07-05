import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const evaluationDashboardApi = {
  getDashboard() {
    return httpClient.get('/evaluation-dashboard', {
      headers: authHeaders(),
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

  getQuestionItemAnalysis() {
    return httpClient.get('/evaluation-dashboard/question-item-analysis', {
      headers: authHeaders(),
    })
  },
}
