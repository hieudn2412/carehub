import { useCallback, useEffect, useMemo, useState } from 'react'
import { EyeOutlined, FilterOutlined, HistoryOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { evaluationAuditLogApi } from '../api/evaluationAuditLogApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/EvaluationAuditLogPage.css'

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'QUESTION', label: 'Ngân hàng câu hỏi' },
  { value: 'DOCUMENT_CANDIDATE', label: 'Review tài liệu' },
  { value: 'PARAPHRASE', label: 'Paraphrase' },
  { value: 'QUESTION_CATEGORY', label: 'Danh mục câu hỏi' },
  { value: 'CLASSIFICATION_RULE', label: 'Quy tắc phân loại' },
  { value: 'EXAM_CONFIG', label: 'Cấu hình đề' },
  { value: 'EXAM_PAPER', label: 'Bộ đề' },
  { value: 'EXAM_ASSIGNMENT', label: 'Phân công' },
]

const ENTITY_OPTIONS = [
  { value: '', label: 'Tất cả đối tượng' },
  { value: 'QUESTION', label: 'Câu hỏi' },
  { value: 'DOCUMENT_QUESTION_CANDIDATE', label: 'Câu hỏi đề xuất' },
  { value: 'DOCUMENT_QUESTION_JOB', label: 'Phiên sinh câu hỏi' },
  { value: 'PARAPHRASE_JOB', label: 'Phiên paraphrase' },
  { value: 'PARAPHRASE_CANDIDATE', label: 'Candidate paraphrase' },
  { value: 'QUESTION_CATEGORY', label: 'Danh mục câu hỏi' },
  { value: 'QUESTION_CLASSIFICATION_RULE', label: 'Quy tắc phân loại' },
  { value: 'EXAM_CONFIG', label: 'Cấu hình đề' },
  { value: 'EXAM_PAPER', label: 'Bộ đề' },
  { value: 'EXAM_ASSIGNMENT', label: 'Phân công' },
]

function EvaluationAuditLogPage() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const [filters, setFilters] = useState({ q: '', action: '', entityType: '', actor: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await evaluationAuditLogApi.list(filters)
      const rows = apiData(response, [])
      setLogs(rows)
      setSelectedLog((current) => rows.find((row) => row.id === current?.id) || rows[0] || null)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [filters, showToast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const detailJson = useMemo(() => formatJson(selectedLog?.detailJson), [selectedLog])
  const breadcrumbs = [{ label: 'Audit đánh giá' }]

  return (
    <AppShell className="dashboard-layout" breadcrumbs={breadcrumbs}>
      <div className="eal-page">
              <section className="eal-toolbar admin-control-toolbar" aria-label="Công cụ audit đánh giá">
                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__controls">
                    <div className="eal-toolbar__search admin-control-toolbar__search">
                      <SearchOutlined />
                      <input
                        aria-label="Tìm audit đánh giá"
                        value={filters.q}
                        onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                        placeholder="Tìm hành động, người thao tác hoặc mô tả..."
                      />
                    </div>
                    <button
                      type="button"
                      className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      aria-controls="evaluation-audit-filter-panel"
                      aria-expanded={isFilterOpen}
                      onClick={() => setIsFilterOpen((current) => !current)}
                    >
                      <FilterOutlined />
                      Bộ lọc
                      {[filters.action, filters.entityType, filters.actor].filter(Boolean).length > 0 && (
                        <span className="admin-control-toolbar__filter-count">
                          {[filters.action, filters.entityType, filters.actor].filter(Boolean).length}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="eal-toolbar__actions">
                    <span>{logs.length} bản ghi</span>
                    <button
                      type="button"
                      className="eal-toolbar__reload"
                      onClick={loadLogs}
                      disabled={isLoading}
                      aria-label="Tải lại audit đánh giá"
                      title="Tải lại"
                    >
                      <ReloadOutlined spin={isLoading} />
                    </button>
                  </div>
                </div>

                {isFilterOpen && (
                  <div id="evaluation-audit-filter-panel" className="eal-filter-panel admin-control-toolbar__panel">
                  <label>
                    <span>Hành động</span>
                    <select
                      value={filters.action}
                      onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
                    >
                      {ACTION_OPTIONS.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Đối tượng</span>
                    <select
                      value={filters.entityType}
                      onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
                    >
                      {ENTITY_OPTIONS.map((option) => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Người thao tác</span>
                    <input
                      value={filters.actor}
                      onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))}
                      placeholder="Tên đăng nhập"
                    />
                  </label>
                  </div>
                )}
              </section>

              <section className="eal-content">
                <div className="eal-table-panel">
                  {isLoading ? (
                    <div className="eal-empty">Đang tải audit đánh giá...</div>
                  ) : logs.length === 0 ? (
                    <div className="eal-empty">Chưa có audit log phù hợp.</div>
                  ) : (
                    <table className="eal-table admin-table-uppercase">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Thao tác</th>
                          <th>Đối tượng</th>
                          <th>Người thao tác</th>
                          <th>Mô tả</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className={selectedLog?.id === log.id ? 'eal-row--active' : ''}>
                            <td>{formatDateTime(log.createdAt)}</td>
                            <td><span className="eal-badge">{log.actionText || log.action}</span></td>
                            <td>{entityText(log.entityType)} #{log.entityId || '---'}</td>
                            <td>{log.actor || 'system'}</td>
                            <td>{log.summary || '---'}</td>
                            <td>
                              <button
                                aria-label={`Xem chi tiết audit ${log.id}`}
                                className="eal-icon-btn admin-table-action admin-table-action--icon admin-table-action--primary"
                                onClick={() => setSelectedLog(log)}
                                title="Xem chi tiết"
                                type="button"
                              >
                                <EyeOutlined />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <aside className="eal-detail">
                  {selectedLog ? (
                    <>
                      <div className="eal-detail-head">
                        <HistoryOutlined />
                        <div>
                          <h2>{selectedLog.actionText || selectedLog.action}</h2>
                          <p>{formatDateTime(selectedLog.createdAt)}</p>
                        </div>
                      </div>
                      <dl className="eal-detail-list">
                        <div>
                          <dt>Người thao tác</dt>
                          <dd>{selectedLog.actor || 'system'}</dd>
                        </div>
                        <div>
                          <dt>Đối tượng</dt>
                          <dd>{entityText(selectedLog.entityType)} #{selectedLog.entityId || '---'}</dd>
                        </div>
                        <div>
                          <dt>Mã hành động</dt>
                          <dd>{selectedLog.action}</dd>
                        </div>
                        <div>
                          <dt>Mô tả</dt>
                          <dd>{selectedLog.summary || '---'}</dd>
                        </div>
                      </dl>
                      <div className="eal-json">
                        <div className="eal-json-title">Metadata</div>
                        <pre>{detailJson}</pre>
                      </div>
                    </>
                  ) : (
                    <div className="eal-empty">Chọn một audit log để xem chi tiết.</div>
                  )}
                </aside>
              </section>
      </div>
    </AppShell>
  )
}

function entityText(entityType) {
  const match = ENTITY_OPTIONS.find((option) => option.value === entityType)
  return match?.label || entityType || 'Không rõ'
}

function formatJson(value) {
  if (!value) return '{}'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export default EvaluationAuditLogPage
