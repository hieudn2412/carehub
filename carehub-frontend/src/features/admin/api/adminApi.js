import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const adminApi = {
  getUsers(params) {
    return httpClient.get('/users', {
      headers: authHeaders(),
      params,
    })
  },

  getDepartments() {
    return httpClient.get('/departments', {
      headers: authHeaders(),
    })
  },

  getDepartmentById(id) {
    return httpClient.get(`/departments/${id}`, {
      headers: authHeaders(),
    })
  },

  createDepartment(data) {
    return httpClient.post('/departments', data, {
      headers: authHeaders(),
    })
  },

  updateDepartment(id, data) {
    return httpClient.put(`/departments/${id}`, data, {
      headers: authHeaders(),
    })
  },

  deleteDepartment(id) {
    return httpClient.delete(`/departments/${id}`, {
      headers: authHeaders(),
    })
  },

  getRoles() {
    return httpClient.get('/roles', {
      headers: authHeaders(),
    })
  },

  getPositions() {
    return httpClient.get('/positions', {
      headers: authHeaders(),
    })
  },

  getEducationLevels() {
    return httpClient.get('/education-levels', {
      headers: authHeaders(),
    })
  },

  getUserById(id) {
    return httpClient.get(`/user/${id}`, {
      headers: authHeaders(),
    })
  },

  createUser(data) {
    return httpClient.post('/users', data, {
      headers: authHeaders(),
    })
  },

  updateUser(id, data) {
    return httpClient.put(`/users/${id}`, data, {
      headers: authHeaders(),
    })
  },

  deleteUser(id) {
    return httpClient.delete(`/user/${id}`, {
      headers: authHeaders(),
    })
  },

  lockUser(id) {
    return httpClient.patch(`/users/${id}/lock`, {}, {
      headers: authHeaders(),
    })
  },

  unlockUser(id) {
    return httpClient.patch(`/users/${id}/unlock`, {}, {
      headers: authHeaders(),
    })
  },

  resetUserPassword(id) {
    return httpClient.patch(`/users/${id}/reset-password`, {}, {
      headers: authHeaders(),
    })
  },

  assignRole(userId, roleId) {
    return httpClient.post(`/users/${userId}/roles/${roleId}`, {}, {
      headers: authHeaders(),
    })
  },

  removeRole(userId, roleId) {
    return httpClient.delete(`/users/${userId}/roles/${roleId}`, {
      headers: authHeaders(),
    })
  },

  importUsers(file) {
    const formData = new FormData()
    formData.append('file', file)
    return httpClient.post('/users/import', formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  exportUsers(params) {
    return httpClient.get('/users/export', {
      headers: authHeaders(),
      params,
    })
  },

  getImportLogs(params) {
    return httpClient.get('/system/import-logs', {
      headers: authHeaders(),
      params,
    })
  },

  getImportLogById(id) {
    return httpClient.get(`/system/import-logs/${id}`, {
      headers: authHeaders(),
    })
  },

  getNotificationConfig() {
    return httpClient.get('/notifications/config', {
      headers: authHeaders(),
    })
  },

  updateNotificationConfig(data) {
    return httpClient.put('/notifications/config', data, {
      headers: authHeaders(),
    })
  },

  getNotificationEvents() {
    return httpClient.get('/notification-events', {
      headers: authHeaders(),
    })
  },

  resetNotificationConfig() {
    return httpClient.put('/notifications/config/defaults', {}, {
      headers: authHeaders(),
    })
  },

  getEmailTemplates(params) {
    return httpClient.get('/email/templates', {
      headers: authHeaders(),
      params,
    })
  },

  getEmailTemplateById(id) {
    return httpClient.get(`/email/templates/${id}`, {
      headers: authHeaders(),
    })
  },

  createEmailTemplate(data) {
    return httpClient.post('/email/templates', data, {
      headers: authHeaders(),
    })
  },

  updateEmailTemplate(id, data) {
    return httpClient.put(`/email/templates/${id}`, data, {
      headers: authHeaders(),
    })
  },

  deleteEmailTemplate(id) {
    return httpClient.delete(`/email/templates/${id}`, {
      headers: authHeaders(),
    })
  },

  previewEmailTemplate(data) {
    return httpClient.post('/email/template-previews', data, {
      headers: authHeaders(),
    })
  },
  
  // Forms Management
  getForms(params) {
    return httpClient.get('/forms', {
      headers: authHeaders(),
      params,
    })
  },

  createForm(data) {
    return httpClient.post('/forms', data, {
      headers: authHeaders(),
    })
  },

  getFormById(id) {
    return httpClient.get(`/forms/${id}`, {
      headers: authHeaders(),
    })
  },

  updateForm(id, data) {
    return httpClient.put(`/forms/${id}`, data, {
      headers: authHeaders(),
    })
  },

  deleteForm(id) {
    return httpClient.delete(`/forms/${id}`, {
      headers: authHeaders(),
    })
  },

  // Form Versions
  getFormVersions(formId, params) {
    return httpClient.get(`/forms/${formId}/versions`, {
      headers: authHeaders(),
      params,
    })
  },

  createFormVersion(formId, data) {
    return httpClient.post(`/forms/${formId}/versions`, data, {
      headers: authHeaders(),
    })
  },

  getFormVersionById(formId, versionId) {
    return httpClient.get(`/forms/${formId}/versions/${versionId}`, {
      headers: authHeaders(),
    })
  },

  updateFormVersion(formId, versionId, data) {
    return httpClient.put(`/forms/${formId}/versions/${versionId}`, data, {
      headers: authHeaders(),
    })
  },

  deleteFormVersion(formId, versionId) {
    return httpClient.delete(`/forms/${formId}/versions/${versionId}`, {
      headers: authHeaders(),
    })
  },

  publishFormVersion(formId, versionId) {
    return httpClient.post(`/forms/${formId}/versions/${versionId}/publication`, {}, {
      headers: authHeaders(),
    })
  },

  // Form Previews
  getFormPreviews(params) {
    return httpClient.get('/form-previews', {
      headers: authHeaders(),
      params,
    })
  },

  getFormPreviewById(formId, params) {
    return httpClient.get(`/form-previews/${formId}`, {
      headers: authHeaders(),
      params,
    })
  },

  // Google Form Importer
  createFormImportBatch(data) {
    return httpClient.post('/form-import-batches', data, {
      headers: authHeaders(),
    })
  },

  getFormImportBatches(params) {
    return httpClient.get('/form-import-batches', {
      headers: authHeaders(),
      params,
    })
  },

  getFormImportBatchById(batchId) {
    return httpClient.get(`/form-import-batches/${batchId}`, {
      headers: authHeaders(),
    })
  },

  applyFormImportBatch(batchId) {
    return httpClient.post(`/form-import-batches/${batchId}/application`, {}, {
      headers: authHeaders(),
    })
  },

  // Form Subjects (Employee Lookup)
  findFormSubject(params) {
    return httpClient.get('/form-subjects/users', {
      headers: authHeaders(),
      params,
    })
  },

  // Form Assignments
  createFormAssignment(data) {
    return httpClient.post('/form-assignments', data, {
      headers: authHeaders(),
    })
  },

  getFormAssignments(params) {
    return httpClient.get('/form-assignments', {
      headers: authHeaders(),
      params,
    })
  },

  getFormAssignmentsByForm(formId, params) {
    return httpClient.get(`/forms/${formId}/assignments`, {
      headers: authHeaders(),
      params,
    })
  },

  getFormAssignmentById(id) {
    return httpClient.get(`/form-assignments/${id}`, {
      headers: authHeaders(),
    })
  },

  revokeFormAssignment(id) {
    return httpClient.delete(`/form-assignments/${id}`, {
      headers: authHeaders(),
    })
  },

  revokeFormAssignmentItem(id) {
    return httpClient.delete(`/form-assignment-items/${id}`, {
      headers: authHeaders(),
    })
  },

  getFormSubmissions(params) {
    return httpClient.get('/form-submissions', {
      headers: authHeaders(),
      params,
    })
  },

  getFormSubmission(id) {
    return httpClient.get(`/form-submissions/${id}`, {
      headers: authHeaders(),
    })
  },

  // Dashboard
  getDashboardOverview(params) {
    return httpClient.get('/dashboard/overview', {
      headers: authHeaders(),
      params,
    })
  },

  getDashboardFormSummary(params) {
    return httpClient.get('/dashboard/forms/summary', {
      headers: authHeaders(),
      params,
    })
  },

  getDashboardFormTrend(params) {
    return httpClient.get('/dashboard/forms/trend', {
      headers: authHeaders(),
      params,
    })
  },

  getDashboardFormPerformance(params) {
    return httpClient.get('/dashboard/forms/performance', {
      headers: authHeaders(),
      params,
    })
  },
}
