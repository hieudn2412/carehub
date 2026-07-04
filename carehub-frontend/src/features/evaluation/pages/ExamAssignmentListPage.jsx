import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteOutlined, DownloadOutlined, EyeOutlined, FolderOpenOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function ExamAssignmentListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [assignmentResults, setAssignmentResults] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExportingResults, setIsExportingResults] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')

  const loadAssignments = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await examAssignmentApi.listAssignments({})
      setAssignments(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  const filteredAssignments = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return assignments.filter((assignment) => {
      const matchesKeyword = !normalized
        || (assignment.name || '').toLowerCase().includes(normalized)
        || (assignment.examPaperName || '').toLowerCase().includes(normalized)
        || (assignment.examPaperCode || '').toLowerCase().includes(normalized)
      const matchesStatus = !status || assignment.status === status
      return matchesKeyword && matchesStatus
    })
  }, [assignments, keyword, status])

  async function viewAssignment(assignment) {
    try {
      const [detailResponse, resultsResponse] = await Promise.all([
        examAssignmentApi.getAssignment(assignment.id),
        examAssignmentApi.getAssignmentResults(assignment.id),
      ])
      setSelectedAssignment(apiData(detailResponse, null))
      setAssignmentResults(apiData(resultsResponse, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function exportResults(assignment) {
    setIsExportingResults(true)
    try {
      const response = await examAssignmentApi.exportAssignmentResults(assignment.id)
      downloadBlob(`ket-qua-${assignment.name || assignment.id}.xlsx`, response.data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      showToast('Đã export kết quả phân công.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsExportingResults(false)
    }
  }

  async function openAssignment(assignment) {
    try {
      await examAssignmentApi.openAssignment(assignment.id)
      showToast('Đã mở phân công kiểm tra.', 'success')
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function closeAssignment(assignment) {
    try {
      await examAssignmentApi.closeAssignment(assignment.id)
      showToast('Đã đóng phân công kiểm tra.', 'success')
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function archiveAssignment(assignment) {
    if (!window.confirm(`Lưu trữ phân công "${assignment.name}"?`)) return
    try {
      await examAssignmentApi.archiveAssignment(assignment.id)
      showToast('Đã lưu trữ phân công kiểm tra.', 'success')
      setSelectedAssignment(null)
      setAssignmentResults(null)
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  const breadcrumbs = [{ label: 'Phân công kiểm tra' }]

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
                  <h1 className="exp-title">Phân công kiểm tra</h1>
                  <p className="exp-subtitle">Giao bộ đề đã phát hành cho nhân viên và theo dõi tiến độ làm bài</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={loadAssignments} disabled={isLoading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                  <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-assignments/new')}>
                    <PlusCircleOutlined /> Tạo phân công
                  </button>
                </div>
              </div>

              <div className="exp-filter-bar">
                <div className="exp-search">
                  <SearchOutlined />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm phân công, mã đề, tên đề..." />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Trạng thái</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="OPEN">Đang mở</option>
                  <option value="CLOSED">Đã đóng</option>
                  <option value="ARCHIVED">Đã lưu trữ</option>
                </select>
              </div>

              <div className="exp-table-card">
                <table className="exp-table">
                  <thead>
                    <tr>
                      <th>Tên phân công</th>
                      <th>Bộ đề</th>
                      <th>Nhân viên</th>
                      <th>Lượt làm</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th style={{ width: 170, textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="7" className="exp-empty">Đang tải phân công kiểm tra...</td></tr>
                    ) : filteredAssignments.length === 0 ? (
                      <tr><td colSpan="7" className="exp-empty">Chưa có phân công kiểm tra.</td></tr>
                    ) : filteredAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td><strong>{assignment.name}</strong></td>
                        <td>{assignment.examPaperCode} - {assignment.examPaperName}</td>
                        <td>{assignment.targetCount}</td>
                        <td>{assignment.submittedCount}/{assignment.attemptCount}</td>
                        <td>{formatDateTime(assignment.dueAt)}</td>
                        <td><span className={`exp-badge exp-badge--${assignment.status?.toLowerCase()}`}>{assignment.statusText || assignment.status}</span></td>
                        <td>
                          <div className="exp-actions">
                            <button type="button" onClick={() => viewAssignment(assignment)} title="Xem chi tiết"><EyeOutlined /></button>
                            {assignment.status !== 'OPEN' && assignment.status !== 'ARCHIVED' && (
                              <button type="button" onClick={() => openAssignment(assignment)} title="Mở"><FolderOpenOutlined /></button>
                            )}
                            {assignment.status === 'OPEN' && (
                              <button type="button" onClick={() => closeAssignment(assignment)} title="Đóng"><StopOutlined /></button>
                            )}
                            <button type="button" onClick={() => archiveAssignment(assignment)} disabled={assignment.status === 'ARCHIVED'} title="Lưu trữ"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedAssignment && (
                <div className="exp-form-card">
                  <div className="exp-question-head">
                    <strong>{selectedAssignment.name}</strong>
                    <span>{selectedAssignment.statusText}</span>
                  </div>
                  <div className="exp-info-strip">
                    <span>{selectedAssignment.examPaperCode}</span>
                    <span>{selectedAssignment.targetCount} nhân viên</span>
                    <span>{selectedAssignment.maxAttempts} lượt tối đa</span>
                    <span>{selectedAssignment.resultVisibilityText || 'Chỉ hiển thị điểm'}</span>
                    <span>{selectedAssignment.submittedCount} lượt đã nộp</span>
                    {assignmentResults && <span>Điểm TB {assignmentResults.averageScore ?? '---'}</span>}
                    {assignmentResults && <span>{assignmentResults.notStartedCount} chưa làm</span>}
                  </div>
                  <div className="exp-form-actions exp-form-actions--inline">
                    <button type="button" className="exp-btn-secondary" onClick={() => exportResults(selectedAssignment)} disabled={isExportingResults}>
                      <DownloadOutlined /> Export kết quả
                    </button>
                  </div>
                  <div className="exp-target-list">
                    {(selectedAssignment.targets || []).map((target) => (
                      <div key={target.userId} className="exp-target-item">
                        <strong>{target.employeeCode}</strong>
                        <span>{target.name}</span>
                        <small>{target.departmentName || 'Chưa có phòng ban'}</small>
                      </div>
                    ))}
                  </div>
                  {assignmentResults && (
                    <div className="exp-table-card">
                      <table className="exp-table">
                        <thead>
                          <tr>
                            <th>Nhân viên</th>
                            <th>Khoa/phòng</th>
                            <th>Số lượt</th>
                            <th>Trạng thái</th>
                            <th>Điểm</th>
                            <th>Kết quả</th>
                            <th>Nộp lúc</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(assignmentResults.rows || []).map((row) => (
                            <tr key={row.userId}>
                              <td><strong>{row.employeeCode}</strong> - {row.userName}</td>
                              <td>{row.departmentName || '---'}</td>
                              <td>{row.attemptCount}</td>
                              <td>{row.latestStatusText || 'Chưa làm'}</td>
                              <td>{row.latestScore ?? '---'}</td>
                              <td>{row.latestPassed == null ? '---' : row.latestPassed ? 'Đạt' : 'Không đạt'}</td>
                              <td>{formatDateTime(row.latestSubmittedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamAssignmentListPage

function downloadBlob(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.replace(/[\\/:*?"<>|]+/g, '_')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
