import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const myCompetencyApi = {
  getKnowledge(params) {
    return httpClient.get('/me/competency/knowledge', { headers: authHeaders(), params })
  },

  getSkills(params) {
    return httpClient.get('/me/competency/skills', { headers: authHeaders(), params })
  },

  getSummary(params) {
    return httpClient.get('/me/competency/summary', { headers: authHeaders(), params })
  },

  getExamAttempt(attemptId) {
    return httpClient.get(`/me/exam-attempts/${attemptId}`, { headers: authHeaders() })
  },

  getSkillEvaluation(submissionId) {
    return httpClient.get(`/me/competency/skills/${submissionId}`, { headers: authHeaders() })
  },
}
