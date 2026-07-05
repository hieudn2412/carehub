import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const examAssignmentApi = {
  listAssignments(params) {
    return httpClient.get('/exam-assignments', {
      headers: authHeaders(),
      params,
    })
  },

  getAssignment(assignmentId) {
    return httpClient.get(`/exam-assignments/${assignmentId}`, {
      headers: authHeaders(),
    })
  },

  getAssignmentResults(assignmentId) {
    return httpClient.get(`/exam-assignments/${assignmentId}/results`, {
      headers: authHeaders(),
    })
  },

  exportAssignmentResults(assignmentId) {
    return httpClient.get(`/exam-assignments/${assignmentId}/export-results`, {
      headers: authHeaders(),
      responseType: 'blob',
    })
  },

  createAssignment(payload) {
    return httpClient.post('/exam-assignments', payload, {
      headers: authHeaders(),
    })
  },

  openAssignment(assignmentId) {
    return httpClient.post(`/exam-assignments/${assignmentId}/open`, {}, {
      headers: authHeaders(),
    })
  },

  closeAssignment(assignmentId) {
    return httpClient.post(`/exam-assignments/${assignmentId}/close`, {}, {
      headers: authHeaders(),
    })
  },

  archiveAssignment(assignmentId) {
    return httpClient.delete(`/exam-assignments/${assignmentId}`, {
      headers: authHeaders(),
    })
  },

  listAttempts(params) {
    return httpClient.get('/exam-attempts', {
      headers: authHeaders(),
      params,
    })
  },

  getAttempt(attemptId) {
    return httpClient.get(`/exam-attempts/${attemptId}`, {
      headers: authHeaders(),
    })
  },
}
