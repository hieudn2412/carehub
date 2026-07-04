import { httpClient } from '../../../shared/api/httpClient.js'
import { tokenStorage } from '../../auth/services/tokenStorage.js'

function authHeaders() {
  const accessToken = tokenStorage.getAccessToken()
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

export const classificationRuleApi = {
  listRules(params) {
    return httpClient.get('/question-classification-rules', {
      headers: authHeaders(),
      params,
    })
  },

  getRule(ruleId) {
    return httpClient.get(`/question-classification-rules/${ruleId}`, {
      headers: authHeaders(),
    })
  },

  createRule(payload) {
    return httpClient.post('/question-classification-rules', payload, {
      headers: authHeaders(),
    })
  },

  updateRule(ruleId, payload) {
    return httpClient.put(`/question-classification-rules/${ruleId}`, payload, {
      headers: authHeaders(),
    })
  },

  disableRule(ruleId) {
    return httpClient.delete(`/question-classification-rules/${ruleId}`, {
      headers: authHeaders(),
    })
  },

  testRule(payload) {
    return httpClient.post('/question-classification-rules/test', payload, {
      headers: authHeaders(),
    })
  },
}
