import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const competencyApi = {
  getEmployeeClassification(employeeId) {
    return httpClient.get(`/competency/employees/${employeeId}`, { headers: authHeaders() })
  },

  getDepartmentClassification(departmentId) {
    return httpClient.get(`/competency/departments/${departmentId}`, { headers: authHeaders() })
  },

  getThresholds() {
    return httpClient.get('/competency/thresholds', { headers: authHeaders() })
  },

  updateThresholds(payload) {
    return httpClient.put('/competency/thresholds', payload, { headers: authHeaders() })
  },

  getByField(params) {
    return httpClient.get('/competency/by-field', { headers: authHeaders(), params })
  },

  getEmployeeByField(employeeId, params) {
    return httpClient.get(`/competency/employees/${employeeId}/by-field`, { headers: authHeaders(), params })
  },

  getByTechnique(params) {
    return httpClient.get('/competency/by-technique', { headers: authHeaders(), params })
  },

  getEmployeeByTechnique(employeeId, params) {
    return httpClient.get(`/competency/employees/${employeeId}/by-technique`, { headers: authHeaders(), params })
  },

  getSummary(params) {
    return httpClient.get('/competency/summary', { headers: authHeaders(), params })
  },

  updateDepartmentTarget(departmentId, targetScore) {
    return httpClient.put(`/competency/departments/${departmentId}/target`, { targetScore }, {
      headers: authHeaders(),
    })
  },
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
