import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const examPaperApi = {
  listExamPapers(params) {
    return httpClient.get('/exam-papers', {
      headers: authHeaders(),
      params,
    })
  },

  getExamPaper(paperId) {
    return httpClient.get(`/exam-papers/${paperId}`, {
      headers: authHeaders(),
    })
  },

  generateExamPapers(payload) {
    return httpClient.post('/exam-papers/generate', payload, {
      headers: authHeaders(),
    })
  },

  publishExamPaper(paperId) {
    return httpClient.post(`/exam-papers/${paperId}/publish`, {}, {
      headers: authHeaders(),
    })
  },

  archiveExamPaper(paperId) {
    return httpClient.delete(`/exam-papers/${paperId}`, {
      headers: authHeaders(),
    })
  },

  exportExamPaper(paperId, includeAnswers = false, format = 'txt') {
    return httpClient.get(`/exam-papers/${paperId}/export`, {
      headers: authHeaders(),
      params: { includeAnswers, format },
      responseType: 'blob',
    })
  },
}
