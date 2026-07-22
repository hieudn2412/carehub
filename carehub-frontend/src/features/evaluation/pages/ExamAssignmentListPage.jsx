import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloseOutlined, DeleteOutlined, FolderOpenOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, StopOutlined, BarChartOutlined, LoadingOutlined } from '@ant-design/icons'
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
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null)
  const [results, setResults] = useState(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)

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
    const timer = window.setTimeout(loadAssignments, 0)
    return () => window.clearTimeout(timer)
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
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function viewResults(assignment) {
    if (selectedAssignmentId === assignment.id) {
      setSelectedAssignmentId(null)
      setResults(null)
      return
    }
    setSelectedAssignmentId(assignment.id)
    setResults(null)
    setIsLoadingResults(true)
    try {
      const response = await examAssignmentApi.getAssignmentResults(assignment.id)
      setResults(apiData(response, null))
    } catch (error) {
      setSelectedAssignmentId(null)
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoadingResults(false)
    }
  }

  function closeResults() {
    setSelectedAssignmentId(null)
    setResults(null)
  }

  const breadcrumbs = [{ label: 'Bài kiểm tra đã giao' }]

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
                  <h1 className="exp-title">Bài kiểm tra đã giao</h1>
                  <p className="exp-subtitle">Theo dõi bài đã giao và xem điểm từng nhân viên ngay tại đây</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={loadAssignments} disabled={isLoading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                  <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-assignments/new')}>
                    <PlusCircleOutlined /> Tạo & giao bài
                  </button>
                </div>
              </div>

              <div className="exp-filter-bar">
                <div className="exp-search">
                  <SearchOutlined />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm phân công, mã đề, tên đề" />
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
                      <th>Lĩnh vực chuyên môn</th>
                      <th>Số NV</th>
                      <th>Đã nộp</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th style={{ width: 170, textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="8" className="exp-empty">Đang tải phân công kiểm tra...</td></tr>
                    ) : filteredAssignments.length === 0 ? (
                      <tr><td colSpan="8" className="exp-empty">Chưa có phân công kiểm tra.</td></tr>
                    ) : filteredAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td><strong>{assignment.name}</strong></td>
                        <td>{assignment.examPaperCode} - {assignment.examPaperName}</td>
                        <td>{assignment.professionalFieldName || '—'}</td>
                        <td>{assignment.targetCount}</td>
                        <td>{assignment.submittedCount ?? 0}/{assignment.attemptCount ?? '-'}</td>
                        <td>{formatDateTime(assignment.dueAt)}</td>
                        <td><span className={`exp-badge exp-badge--${assignment.status?.toLowerCase()}`}>{assignment.statusText || assignment.status}</span></td>
                        <td>
                          <div className="exp-actions">
                            <button
                              type="button"
                              className={selectedAssignmentId === assignment.id ? 'is-active' : ''}
                              onClick={() => viewResults(assignment)}
                              title="Xem điểm"
                            ><BarChartOutlined /></button>
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

                {selectedAssignmentId && (
                  <section className="exp-detail-panel exp-assignment-results">
                    <div className="exp-detail-header">
                      <div>
                        <strong>Điểm bài kiểm tra: {results?.assignmentName || assignments.find((item) => item.id === selectedAssignmentId)?.name}</strong>
                        <span>{results?.professionalFieldName || 'Đang tải thông tin kết quả'}</span>
                      </div>
                      <button type="button" className="exp-btn-secondary" onClick={closeResults}><CloseOutlined /> Đóng</button>
                    </div>

                    {isLoadingResults ? (
                      <div className="exp-results-loading"><LoadingOutlined spin /> Đang tải điểm...</div>
                    ) : results && (
                      <>
                        <div className="exp-results-summary">
                          <div><span>Tổng nhân viên</span><strong>{results.targetCount || 0}</strong></div>
                          <div><span>Chưa làm</span><strong>{results.notStartedCount || 0}</strong></div>
                          <div><span>Đã hoàn thành</span><strong>{(results.submittedCount || 0) + (results.gradedCount || 0)}</strong></div>
                          <div><span>Điểm trung bình</span><strong>{results.averageScore ?? '—'}</strong></div>
                          <div><span>Điểm cao nhất</span><strong>{results.bestScore ?? '—'}</strong></div>
                        </div>

                        <div className="exp-results-table-wrap">
                          <table className="exp-table exp-results-table">
                            <thead>
                              <tr>
                                <th>Nhân viên</th>
                                <th>Khoa/phòng</th>
                                <th>Số lượt</th>
                                <th>Điểm mới nhất</th>
                                <th>Điểm cao nhất</th>
                                <th>Kết quả</th>
                                <th>Trạng thái</th>
                                <th>Thời gian nộp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(results.rows || []).length === 0 ? (
                                <tr><td colSpan="8" className="exp-empty">Chưa có nhân viên trong bài kiểm tra này.</td></tr>
                              ) : (results.rows || []).map((row) => (
                                <tr key={row.userId}>
                                  <td><strong>{row.employeeCode}</strong><br /><span>{row.userName}</span></td>
                                  <td>{row.departmentName || '—'}</td>
                                  <td>{row.attemptCount || 0}</td>
                                  <td><strong>{row.latestScore ?? '—'}</strong></td>
                                  <td>{row.bestScore ?? '—'}</td>
                                  <td>
                                    {row.latestPassed === null || row.latestPassed === undefined
                                      ? <span className="exp-result-pending">Chưa có điểm</span>
                                      : <span className={row.latestPassed ? 'exp-result-correct' : 'exp-result-wrong'}>{row.latestPassed ? 'Đạt' : 'Không đạt'}</span>}
                                  </td>
                                  <td>{row.latestStatusText || 'Chưa làm'}</td>
                                  <td>{formatDateTime(row.latestSubmittedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamAssignmentListPage
