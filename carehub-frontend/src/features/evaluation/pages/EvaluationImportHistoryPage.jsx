import { useCallback, useEffect, useMemo, useState } from 'react'
import { DownloadOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { evaluationImportApi } from '../api/evaluationImportApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function EvaluationImportHistoryPage() {
  const { showToast } = useToast()
  const [imports, setImports] = useState([])
  const [selectedImport, setSelectedImport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')

  const loadImports = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await evaluationImportApi.listImports({ q: keyword || undefined, status: status || undefined })
      setImports(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [keyword, status, showToast])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  const rows = useMemo(() => imports, [imports])

  async function viewImport(importJob) {
    try {
      const response = await evaluationImportApi.getImport(importJob.id)
      setSelectedImport(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function exportErrorFile(importJob) {
    try {
      const response = await evaluationImportApi.exportErrorFile(importJob.id)
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `evaluation-import-errors-${importJob.id}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showToast('Đã tải file lỗi import.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  const breadcrumbs = [{ label: 'Lịch sử import đánh giá' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <div className="exp-title-card">
                <div>
                  <h1 className="exp-title">Lịch sử import đánh giá</h1>
                  <p className="exp-subtitle">Theo dõi file import ngân hàng câu hỏi, số dòng hợp lệ và lỗi theo từng lần xử lý</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={loadImports} disabled={isLoading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                </div>
              </div>

              <div className="exp-filter-bar">
                <div className="exp-search">
                  <SearchOutlined />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm file, người import, mã import..." />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Trạng thái</option>
                  <option value="PREVIEWED">Đã preview</option>
                  <option value="COMMITTED">Đã import</option>
                  <option value="FAILED">Thất bại</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </div>

              <div className="exp-table-card">
                <table className="exp-table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Loại import</th>
                      <th>File</th>
                      <th>Trạng thái</th>
                      <th>Dòng</th>
                      <th>Đã lưu</th>
                      <th>Bỏ qua</th>
                      <th>Người import</th>
                      <th>Thời gian</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="10" className="exp-empty">Đang tải lịch sử import...</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan="10" className="exp-empty">Chưa có lịch sử import.</td></tr>
                    ) : rows.map((item) => (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td>{item.importTypeText || item.importType}</td>
                        <td>{item.fileName || 'Không có tên file'}</td>
                        <td><span className={`exp-badge exp-badge--${String(item.status || '').toLowerCase()}`}>{item.statusText || item.status}</span></td>
                        <td>{item.totalRows || 0} dòng</td>
                        <td>{item.createdRows || 0}</td>
                        <td>{item.skippedRows || 0}</td>
                        <td>{item.actor || 'system'}</td>
                        <td>{formatDateTime(item.createdAt)}</td>
                        <td>
                          <div className="exp-actions">
                            <button type="button" onClick={() => viewImport(item)} title="Xem chi tiết"><EyeOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedImport && (
                <div className="exp-form-card">
                  <div className="exp-question-head">
                    <strong>Import #{selectedImport.id} - {selectedImport.fileName || selectedImport.importTypeText}</strong>
                    <span>{selectedImport.statusText}</span>
                  </div>
                  <div className="exp-info-strip">
                    <span>Tổng dòng: {selectedImport.totalRows || 0}</span>
                    <span>Hợp lệ: {selectedImport.validRows || 0}</span>
                    <span>Lỗi: {selectedImport.invalidRows || selectedImport.failedRows || 0}</span>
                    <span>Đã lưu: {selectedImport.createdRows || 0}</span>
                    <span>Bỏ qua: {selectedImport.skippedRows || 0}</span>
                  </div>
                  <div className="exp-form-actions exp-form-actions--inline">
                    <button
                      type="button"
                      className="exp-btn-secondary"
                      onClick={() => exportErrorFile(selectedImport)}
                      disabled={!((selectedImport.failedRows || selectedImport.invalidRows || selectedImport.skippedRows || 0) > 0)}
                    >
                      <DownloadOutlined /> Tải file lỗi
                    </button>
                  </div>
                  <div className="exp-table-card">
                    <table className="exp-table">
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Câu hỏi</th>
                          <th>Trạng thái</th>
                          <th>Kết quả</th>
                          <th>Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedImport.rows || []).length === 0 ? (
                          <tr><td colSpan="5" className="exp-empty">Không có dữ liệu dòng import.</td></tr>
                        ) : (selectedImport.rows || []).map((row) => (
                          <tr key={`${selectedImport.id}-${row.rowNumber}`}>
                            <td>{row.rowNumber}</td>
                            <td>{row.stem}</td>
                            <td>{row.status}</td>
                            <td>{row.createdQuestionId ? `Đã lưu #${row.createdQuestionId}` : (row.skipped ? 'Bỏ qua' : (row.valid ? 'Hợp lệ' : 'Có lỗi'))}</td>
                            <td>{row.errorsText || 'Không có lỗi'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default EvaluationImportHistoryPage
