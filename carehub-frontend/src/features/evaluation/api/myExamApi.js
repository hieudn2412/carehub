import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const myExamApi = {
  listAssignments() {
    return httpClient.get('/me/exam-assignments', {
      headers: authHeaders(),
    })
  },

  startAssignment(assignmentId) {
    return httpClient.post(`/me/exam-assignments/${assignmentId}/start`, {}, {
      headers: authHeaders(),
    })
  },

  listAttempts() {
    return httpClient.get('/me/exam-attempts', {
      headers: authHeaders(),
    })
  },

  getAttempt(attemptId) {
    return httpClient.get(`/me/exam-attempts/${attemptId}`, {
      headers: authHeaders(),
    })
  },

  saveAnswers(attemptId, answers, tabSwitchCount) {
    const payload = typeof answers === 'object' && !Array.isArray(answers) && answers.answers
      ? answers
      : { answers, tabSwitchCount }
    return httpClient.put(`/me/exam-attempts/${attemptId}/answers`, payload, {
      headers: authHeaders(),
    })
  },

  submitAttempt(attemptId, answers, tabSwitchCount) {
    const payload = typeof answers === 'object' && !Array.isArray(answers) && answers.answers
      ? answers
      : { answers, tabSwitchCount }
    return httpClient.post(`/me/exam-attempts/${attemptId}/submit`, payload, {
      headers: authHeaders(),
    })
  },
}
