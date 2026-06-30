import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const documentQuestionApi = {
  listDocuments(params) {
    return httpClient.get('/documents', {
      headers: authHeaders(),
      params,
    })
  },

  getDocument(documentId) {
    return httpClient.get(`/documents/${documentId}`, {
      headers: authHeaders(),
    })
  },

  uploadDocument(file) {
    const formData = new FormData()
    formData.append('file', file)

    return httpClient.post('/documents', formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  createQuestionJob(documentId, payload) {
    return httpClient.post(`/documents/${documentId}/question-jobs`, payload, {
      headers: authHeaders(),
    })
  },

  getQuestionJob(jobId) {
    return httpClient.get(`/document-question-jobs/${jobId}`, {
      headers: authHeaders(),
    })
  },

  retryFailedChunks(jobId) {
    return httpClient.post(`/document-question-jobs/${jobId}/retry-failed-chunks`, {}, {
      headers: authHeaders(),
    })
  },

  getCandidate(candidateId) {
    return httpClient.get(`/document-question-candidates/${candidateId}`, {
      headers: authHeaders(),
    })
  },

  updateCandidate(candidateId, payload) {
    return httpClient.put(`/document-question-candidates/${candidateId}`, payload, {
      headers: authHeaders(),
    })
  },

  approveCandidate(candidateId, reviewerNotes) {
    return httpClient.post(`/document-question-candidates/${candidateId}/approve`, { reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  rejectCandidate(candidateId, reviewerNotes) {
    return httpClient.post(`/document-question-candidates/${candidateId}/reject`, { reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  saveCandidateAsQuestion(candidateId) {
    return httpClient.post(`/document-question-candidates/${candidateId}/save-as-question`, {}, {
      headers: authHeaders(),
    })
  },
}
