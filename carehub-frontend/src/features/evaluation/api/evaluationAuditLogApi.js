import { httpClient } from '../../../shared/api/httpClient.js'

export const evaluationAuditLogApi = {
  list(params = {}) {
    const query = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    )
    return httpClient.get('/evaluation-audit-logs', { params: query })
  },

  get(auditLogId) {
    return httpClient.get(`/evaluation-audit-logs/${auditLogId}`)
  },
}
