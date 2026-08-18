import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'

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

  deleteDocument(documentId) {
    return httpClient.delete(`/documents/${documentId}`, {
      headers: authHeaders(),
    })
  },

  createQuestionJob(documentId, payload) {
    return httpClient.post(`/documents/${documentId}/question-jobs`, payload, {
      headers: authHeaders(),
    })
  },

  listQuestionJobs(documentId) {
    return httpClient.get(`/documents/${documentId}/question-jobs`, {
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

  retryProblemChunks(jobId, chunkIds = null) {
    return httpClient.post(
      `/document-question-jobs/${jobId}/retry-problem-chunks`,
      chunkIds?.length ? { chunkIds } : {},
      { headers: authHeaders() },
    )
  },

  cancelQuestionJob(jobId) {
    return httpClient.post(`/document-question-jobs/${jobId}/cancel`, {}, {
      headers: authHeaders(),
    })
  },

  getCandidate(candidateId) {
    return httpClient.get(`/document-question-candidates/${candidateId}`, {
      headers: authHeaders(),
    })
  },

  getPotentialDuplicates(candidateId) {
    return httpClient.get(`/document-question-candidates/${candidateId}/potential-duplicates`, {
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

  approveCandidates(candidateIds, reviewerNotes = '') {
    return httpClient.post('/document-question-candidates/batch/approve', { candidateIds, reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  rejectCandidates(candidateIds, reviewerNotes = '') {
    return httpClient.post('/document-question-candidates/batch/reject', { candidateIds, reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  saveCandidatesAsQuestions(candidateIds) {
    return httpClient.post('/document-question-candidates/batch/save-as-questions', { candidateIds }, {
      headers: authHeaders(),
    })
  },
}
