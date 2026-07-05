import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const questionBankApi = {
  listQuestions(params) {
    return httpClient.get('/questions', {
      headers: authHeaders(),
      params,
    })
  },

  getQuestion(questionId) {
    return httpClient.get(`/questions/${questionId}`, {
      headers: authHeaders(),
    })
  },

  createQuestion(payload) {
    return httpClient.post('/questions', payload, {
      headers: authHeaders(),
    })
  },

  updateQuestion(questionId, payload) {
    return httpClient.put(`/questions/${questionId}`, payload, {
      headers: authHeaders(),
    })
  },

  approveQuestion(questionId) {
    return httpClient.post(`/questions/${questionId}/approve`, {}, {
      headers: authHeaders(),
    })
  },

  deactivateQuestion(questionId) {
    return httpClient.post(`/questions/${questionId}/deactivate`, {}, {
      headers: authHeaders(),
    })
  },

  archiveQuestion(questionId) {
    return httpClient.delete(`/questions/${questionId}`, {
      headers: authHeaders(),
    })
  },

  exportQuestions(params) {
    return httpClient.get('/questions/export', {
      headers: authHeaders(),
      params,
      responseType: 'blob',
    })
  },

  downloadImportTemplate() {
    return httpClient.get('/questions/import/template', {
      headers: authHeaders(),
      responseType: 'blob',
    })
  },

  previewImport(file, columnMapping = null) {
    const formData = new FormData()
    formData.append('file', file)
    if (columnMapping) {
      formData.append('columnMapping', JSON.stringify(columnMapping))
    }
    return httpClient.post('/questions/import/preview', formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  commitImport(rows, importJobId = null, duplicateHandlingMode = 'BLOCK') {
    return httpClient.post('/questions/import/commit', { importJobId, duplicateHandlingMode, rows }, {
      headers: authHeaders(),
    })
  },

  getModelRuntimeStatus() {
    return httpClient.get('/ai-model-runtime/status', {
      headers: authHeaders(),
    })
  },

  createParaphraseJob(questionId, payload) {
    return httpClient.post(`/questions/${questionId}/paraphrase-jobs`, payload, {
      headers: authHeaders(),
    })
  },

  createBatchParaphraseJobs(payload) {
    return httpClient.post('/paraphrase-jobs/batch', payload, {
      headers: authHeaders(),
    })
  },

  listParaphraseJobs(questionId) {
    return httpClient.get(`/questions/${questionId}/paraphrase-jobs`, {
      headers: authHeaders(),
    })
  },

  getParaphraseJob(jobId) {
    return httpClient.get(`/paraphrase-jobs/${jobId}`, {
      headers: authHeaders(),
    })
  },

  getParaphraseCandidate(candidateId) {
    return httpClient.get(`/paraphrase-candidates/${candidateId}`, {
      headers: authHeaders(),
    })
  },

  updateParaphraseCandidate(candidateId, payload) {
    return httpClient.patch(`/paraphrase-candidates/${candidateId}`, payload, {
      headers: authHeaders(),
    })
  },

  approveParaphraseCandidate(candidateId, reviewerNotes) {
    return httpClient.post(`/paraphrase-candidates/${candidateId}/approve`, { reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  rejectParaphraseCandidate(candidateId, reviewerNotes) {
    return httpClient.post(`/paraphrase-candidates/${candidateId}/reject`, { reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  saveParaphraseCandidateAsQuestion(candidateId) {
    return httpClient.post(`/paraphrase-candidates/${candidateId}/save-as-question`, {}, {
      headers: authHeaders(),
    })
  },

  approveParaphraseCandidates(candidateIds, reviewerNotes = '') {
    return httpClient.post('/paraphrase-candidates/batch/approve', { candidateIds, reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  rejectParaphraseCandidates(candidateIds, reviewerNotes = '') {
    return httpClient.post('/paraphrase-candidates/batch/reject', { candidateIds, reviewerNotes }, {
      headers: authHeaders(),
    })
  },

  saveParaphraseCandidatesAsQuestions(candidateIds) {
    return httpClient.post('/paraphrase-candidates/batch/save-as-questions', { candidateIds }, {
      headers: authHeaders(),
    })
  },
}
