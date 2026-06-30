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
}
