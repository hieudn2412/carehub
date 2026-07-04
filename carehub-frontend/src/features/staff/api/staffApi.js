import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const staffApi = {
  changePassword(payload) {
    return httpClient.patch('/user/change-password', payload, {
      headers: authHeaders(),
    })
  },

  getProfile() {
    return httpClient.get('/me', {
      headers: authHeaders(),
    })
  },

  getAssignedForms(params) {
    return httpClient.get('/assigned-forms', {
      headers: authHeaders(),
      params,
    })
  },

  getAssignedForm(assignmentItemId) {
    return httpClient.get(`/assigned-forms/${assignmentItemId}`, {
      headers: authHeaders(),
    })
  },

  findAssignedFormSubject(params) {
    return httpClient.get('/form-subjects/users', {
      headers: authHeaders(),
      params,
    })
  },

  createFormSubmission(data) {
    return httpClient.post('/form-submissions', data, {
      headers: authHeaders(),
    })
  },

  updateFormSubmission(id, data) {
    return httpClient.put(`/form-submissions/${id}`, data, {
      headers: authHeaders(),
    })
  },

  submitFormSubmission(id, data) {
    return httpClient.post(`/form-submissions/${id}/submission`, data, {
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
}
