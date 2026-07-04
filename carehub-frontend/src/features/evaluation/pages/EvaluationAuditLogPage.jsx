import { useCallback, useEffect, useMemo, useState } from 'react'
import { EyeOutlined, FilterOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
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
  { value: 'QUESTION_SET', label: 'Bộ câu hỏi' },
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
  { value: 'QUESTION_SET', label: 'Bộ câu hỏi' },
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
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="eal-page">
              <section className="eal-header">
                <div>
                  <h1>Audit đánh giá</h1>
                  <p>Theo dõi thao tác tạo câu hỏi, review, publish đề và phân công kiểm tra</p>
                </div>
                <button type="button" className="eal-btn" onClick={loadLogs} disabled={isLoading}>
                  <ReloadOutlined />
                  <span>Tải lại</span>
                </button>
              </section>

              <section className="eal-filter">
                <label>
                  <span>Từ khóa</span>
                  <input
                    value={filters.q}
                    onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Tìm hành động, người thao tác, mô tả"
                  />
                </label>
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
                <button
                  type="button"
                  className="eal-btn eal-btn--primary"
                  onClick={loadLogs}
                  disabled={isLoading}
                >
                  <FilterOutlined />
                  <span>Lọc</span>
                </button>
              </section>

              <section className="eal-content">
                <div className="eal-table-panel">
                  {isLoading ? (
                    <div className="eal-empty">Đang tải audit đánh giá...</div>
                  ) : logs.length === 0 ? (
                    <div className="eal-empty">Chưa có audit log phù hợp.</div>
                  ) : (
                    <table className="eal-table">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Hành động</th>
                          <th>Đối tượng</th>
                          <th>Người thao tác</th>
                          <th>Mô tả</th>
                          <th></th>
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
                              <button type="button" className="eal-icon-btn" onClick={() => setSelectedLog(log)} title="Xem chi tiết">
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
          </main>
        </div>
      </div>
    </div>
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
