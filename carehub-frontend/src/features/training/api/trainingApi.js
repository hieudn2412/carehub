import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()

  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : {}
}

export const trainingApi = {
  getFoundation() {
    return httpClient.get('/training/foundation', {
      headers: authHeaders(),
    })
  },

  getActivityTypes(params) {
    return httpClient.get('/training/activity-types', {
      headers: authHeaders(),
      params,
    })
  },

  getActivityType(id) {
    return httpClient.get(`/training/activity-types/${id}`, {
      headers: authHeaders(),
    })
  },

  createActivityType(payload) {
    return httpClient.post('/training/activity-types', payload, {
      headers: authHeaders(),
    })
  },

  updateActivityType(id, payload) {
    return httpClient.put(`/training/activity-types/${id}`, payload, {
      headers: authHeaders(),
    })
  },

  updateActivityTypeStatus(id, payload) {
    return httpClient.patch(`/training/activity-types/${id}/status`, payload, {
      headers: authHeaders(),
    })
  },

  getRequirements(params) {
    return httpClient.get('/training/requirements', {
      headers: authHeaders(),
      params,
    })
  },

  getRequirement(id) {
    return httpClient.get(`/training/requirements/${id}`, {
      headers: authHeaders(),
    })
  },

  createRequirement(payload) {
    return httpClient.post('/training/requirements', payload, {
      headers: authHeaders(),
    })
  },

  updateRequirement(id, payload) {
    return httpClient.put(`/training/requirements/${id}`, payload, {
      headers: authHeaders(),
    })
  },

  updateRequirementStatus(id, payload) {
    return httpClient.patch(`/training/requirements/${id}/status`, payload, {
      headers: authHeaders(),
    })
  },

  getApplicableDepartments() {
    return httpClient.get('/training/requirements/applicable-departments', {
      headers: authHeaders(),
    })
  },

  updateApplicableDepartments(payload) {
    return httpClient.put('/training/requirements/applicable-departments', payload, {
      headers: authHeaders(),
    })
  },

  getDepartments() {
    return httpClient.get('/departments', {
      headers: authHeaders(),
    })
  },

  getPositions() {
    return httpClient.get('/positions', {
      headers: authHeaders(),
    })
  },

  getRecordOptions() {
    return httpClient.get('/training/records/options', {
      headers: authHeaders(),
    })
  },

  listRecords(params) {
    return httpClient.get('/training/records', {
      headers: authHeaders(),
      params,
    })
  },


  getRecord(id) {
    return httpClient.get(`/training/records/${id}`, {
      headers: authHeaders(),
    })
  },

  createRecord(payload) {
    return httpClient.post('/training/records', payload, {
      headers: authHeaders(),
    })
  },

  updateRecord(id, payload) {
    return httpClient.put(`/training/records/${id}`, payload, {
      headers: authHeaders(),
    })
  },

  submitRecord(id, payload) {
    return httpClient.post(`/training/records/${id}/submit`, payload, {
      headers: authHeaders(),
    })
  },

  listEvidence(recordId) {
    return httpClient.get(`/training/records/${recordId}/evidences`, {
      headers: authHeaders(),
    })
  },

  uploadEvidence(recordId, file) {
    const formData = new FormData()
    formData.append('file', file)

    return httpClient.post(`/training/records/${recordId}/evidences`, formData, {
      headers: {
        ...authHeaders(),
      },
    })
  },

  deleteEvidence(recordId, evidenceId) {
    return httpClient.delete(`/training/records/${recordId}/evidences/${evidenceId}`, {
      headers: authHeaders(),
    })
  },

  createEvidenceDownloadUrl(recordId, evidenceId) {
    return httpClient.post(`/training/records/${recordId}/evidences/${evidenceId}/download-url`, null, {
      headers: authHeaders(),
    })
  },

  getMyTrainingStatus(params) {
    return httpClient.get('/training/status/me', {
      headers: authHeaders(),
      params,
    })
  },

  getEmployeeTrainingStatus(employeeId, params) {
    return httpClient.get(`/training/employees/${employeeId}/status`, {
      headers: authHeaders(),
      params,
    })
  },

  getEmployeeTrainingStatuses(params) {
    return httpClient.get('/training/employees/status', {
      headers: authHeaders(),
      params,
    })
  },

  getEmployeeTrainingRecords(employeeId, params) {
    return httpClient.get(`/training/employees/${employeeId}/records`, {
      headers: authHeaders(),
      params,
    })
  },

  listLegacyImportBatches(params) {
    return httpClient.get('/training/imports/legacy', {
      headers: authHeaders(),
      params,
    })
  },

  getLegacyImportBatch(batchId) {
    return httpClient.get(`/training/imports/legacy/${batchId}`, {
      headers: authHeaders(),
    })
  },

  previewLegacyImport({ file, activityTypeId, professionalFieldId }) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('activityTypeId', activityTypeId)
    if (professionalFieldId) {
      formData.append('professionalFieldId', professionalFieldId)
    }

    return httpClient.post('/training/imports/legacy/preview', formData, {
      headers: {
        ...authHeaders(),
      },
    })
  },

  applyLegacyImport(batchId, payload) {
    return httpClient.post(`/training/imports/legacy/${batchId}/apply`, payload, {
      headers: authHeaders(),
    })
  },

  parseLegacyDuration(rawText) {
    return httpClient.get('/training/imports/legacy/duration/parse', {
      headers: authHeaders(),
      params: { rawText },
    })
  },
}
