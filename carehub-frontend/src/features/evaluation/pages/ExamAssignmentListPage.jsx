import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloseOutlined, DeleteOutlined, FolderOpenOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, StopOutlined, BarChartOutlined, LoadingOutlined, FilterOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import ConfirmModal from '../../admin/components/ConfirmModal.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ExamManagementViewSwitch from '../components/ExamManagementViewSwitch.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function ExamAssignmentListPage({
  activeView = 'assignments',
  canViewPapers = true,
  canViewAssignments = true,
  onViewChange = () => {},
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null)
  const [results, setResults] = useState(null)
  const [resultReport, setResultReport] = useState(null)
  const [selectedAttemptResult, setSelectedAttemptResult] = useState(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const [isLoadingAttemptResult, setIsLoadingAttemptResult] = useState(false)
  const [pendingArchive, setPendingArchive] = useState(null)

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
      showToast('Đã mở đợt giao đề.', 'success')
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function closeAssignment(assignment) {
    try {
      await examAssignmentApi.closeAssignment(assignment.id)
      showToast('Đã đóng đợt giao đề.', 'success')
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function archiveAssignment(assignment) {
    setPendingArchive(assignment)
  }

  async function confirmArchiveAssignment() {
    if (!pendingArchive) return
    const assignment = pendingArchive
    setPendingArchive(null)
    try {
      await examAssignmentApi.archiveAssignment(assignment.id)
      showToast('Đã lưu trữ đợt giao đề.', 'success')
      loadAssignments()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function viewResults(assignment) {
    if (selectedAssignmentId === assignment.id) {
      setSelectedAssignmentId(null)
      setResults(null)
      setResultReport(null)
      setSelectedAttemptResult(null)
      return
    }
    setSelectedAssignmentId(assignment.id)
    setResults(null)
    setResultReport(null)
    setSelectedAttemptResult(null)
    setIsLoadingResults(true)
    try {
      const [response, reportResponse] = await Promise.all([
        examAssignmentApi.getAssignmentResults(assignment.id),
        examAssignmentApi.getResultReport(assignment.id),
      ])
      setResults(apiData(response, null))
      setResultReport(apiData(reportResponse, null))
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
    setResultReport(null)
    setSelectedAttemptResult(null)
  }

  async function viewAttemptResult(row) {
    if (!row.latestAttemptId) return
    if (selectedAttemptResult?.attemptId === row.latestAttemptId) {
      setSelectedAttemptResult(null)
      return
    }
    setIsLoadingAttemptResult(true)
    try {
      const response = await examAssignmentApi.getAttemptResultBreakdown(row.latestAttemptId)
      setSelectedAttemptResult(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoadingAttemptResult(false)
    }
  }

  const breadcrumbs = [{ label: 'Quản lý bài kiểm tra' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <section className="exp-management-card">
                <ExamManagementViewSwitch
                  activeView={activeView}
                  canViewPapers={canViewPapers}
                  canViewAssignments={canViewAssignments}
                  onChange={onViewChange}
                />

                <div className="exp-filter-bar admin-control-toolbar">
                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__controls">
                    <div className="exp-search admin-control-toolbar__search">
                      <SearchOutlined />
                      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm đợt giao, mã đề, tên đề" />
                    </div>
                    <button
                      aria-controls="exam-assignment-filter-panel"
                      aria-expanded={isFilterOpen}
                      className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      onClick={() => setIsFilterOpen((current) => !current)}
                      type="button"
                    >
                      <FilterOutlined /> Bộ lọc
                      {status && <span className="admin-control-toolbar__filter-count">1</span>}
                    </button>
                  </div>
                  <div className="exp-title-actions">
                    <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-management/new')}>
                      <PlusCircleOutlined /> Tạo bài kiểm tra mới
                    </button>
                    <button type="button" className="exp-btn-secondary" onClick={loadAssignments} disabled={isLoading}>
                      <ReloadOutlined /> Tải lại
                    </button>
                  </div>
                </div>
                {isFilterOpen && (
                  <div className="admin-control-toolbar__panel" id="exam-assignment-filter-panel">
                    <label className="admin-control-toolbar__field">
                      <span>Trạng thái</span>
                      <select value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="DRAFT">Bản nháp</option>
                        <option value="OPEN">Đang mở</option>
                        <option value="CLOSED">Đã đóng</option>
                        <option value="ARCHIVED">Đã lưu trữ</option>
                      </select>
                    </label>
                  </div>
                  )}
                </div>

                <div className="exp-table-card">
                <table className="exp-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th>Tên đợt giao đề</th>
                      <th>Bộ đề</th>
                      <th>Số NV</th>
                      <th>Đã nộp</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th style={{ width: 170 }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="7" className="exp-empty">Đang tải các đợt giao đề...</td></tr>
                    ) : filteredAssignments.length === 0 ? (
                      <tr><td colSpan="7" className="exp-empty">Chưa có đợt giao đề nào.</td></tr>
                    ) : filteredAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td><strong>{assignment.name}</strong></td>
                        <td>{assignment.examPaperCode} - {assignment.examPaperName}</td>
                        <td>{assignment.targetCount}</td>
                        <td>{assignment.submittedCount ?? 0}/{assignment.attemptCount ?? '-'}</td>
                        <td>{formatDateTime(assignment.dueAt)}</td>
                        <td><span className={`exp-badge exp-badge--${assignment.status?.toLowerCase()}`}>{assignment.statusText || assignment.status}</span></td>
                        <td>
                          <div className="admin-table-actions exp-table-actions">
                            <button
                              type="button"
                              className={`admin-table-action admin-table-action--icon admin-table-action--primary${selectedAssignmentId === assignment.id ? ' is-active' : ''}`}
                              onClick={() => viewResults(assignment)}
                              title="Xem điểm"
                            ><BarChartOutlined /></button>
                            {assignment.status !== 'OPEN' && assignment.status !== 'ARCHIVED' && (
                              <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--success" onClick={() => openAssignment(assignment)} title="Mở"><FolderOpenOutlined /></button>
                            )}
                            {assignment.status === 'OPEN' && (
                              <button type="button" className="admin-table-action admin-table-action--icon" onClick={() => closeAssignment(assignment)} title="Đóng"><StopOutlined /></button>
                            )}
                            <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--danger" onClick={() => archiveAssignment(assignment)} disabled={assignment.status === 'ARCHIVED'} title="Lưu trữ"><DeleteOutlined /></button>
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
                        <span>{results?.examPaperCode ? `${results.examPaperCode} · ${results.examPaperName}` : 'Đang tải thông tin kết quả'}</span>
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
                          <div><span>Điểm TB (theo điểm cao nhất)</span><strong>{results.averageScore ?? '—'}</strong></div>
                          <div><span>Điểm cao nhất toàn đợt</span><strong>{results.bestScore ?? '—'}</strong></div>
                        </div>

                        {resultReport && (
                          <div className="exp-results-table-wrap" style={{ marginTop: 20 }}>
                            <h3>Độ phủ kết quả theo lĩnh vực</h3>
                            <table className="exp-table exp-results-table admin-table-uppercase">
                              <thead><tr><th>Lĩnh vực</th><th>Đúng / tổng câu</th><th>Điểm TB</th><th>Đạt ngưỡng</th><th>Mẫu đánh giá</th></tr></thead>
                              <tbody>
                                {(resultReport.fields || []).length === 0 ? (
                                  <tr><td colSpan="5" className="exp-empty">Chưa có lượt thi đã chấm theo lĩnh vực.</td></tr>
                                ) : (resultReport.fields || []).map((field) => (
                                  <tr key={field.professionalFieldId}>
                                    <td><strong>{field.professionalFieldCode ? `${field.professionalFieldCode} · ` : ''}{field.professionalFieldName}</strong></td>
                                    <td>{field.correctCount}/{field.totalQuestions}</td>
                                    <td>{field.averageScore}</td>
                                    <td>{field.passedAttempts}/{field.evaluatedAttempts}</td>
                                    <td>{field.evaluatedAttempts} lượt</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <h3 style={{ marginTop: 20 }}>Heatmap lĩnh vực × mức nhận thức</h3>
                            <table className="exp-table exp-results-table admin-table-uppercase">
                              <thead><tr><th>Lĩnh vực</th><th>Mức nhận thức</th><th>Đúng / tổng câu</th><th>Số lượt</th><th>Ghi chú</th></tr></thead>
                              <tbody>
                                {(resultReport.cells || []).length === 0 ? (
                                  <tr><td colSpan="5" className="exp-empty">Chưa có dữ liệu cell.</td></tr>
                                ) : (resultReport.cells || []).map((cell) => (
                                  <tr key={`${cell.professionalFieldId}-${cell.cognitiveLevel}`}>
                                    <td>{cell.professionalFieldName}</td>
                                    <td>{cell.cognitiveLabel}</td>
                                    <td>{cell.correctCount}/{cell.totalQuestions}</td>
                                    <td>{cell.evaluatedAttempts}</td>
                                    <td>{cell.smallSample ? 'Mẫu nhỏ (≤ 1 câu/lượt), chỉ tham khảo' : 'Đủ mẫu'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="exp-results-table-wrap">
                          <table className="exp-table exp-results-table admin-table-uppercase">
                            <thead>
                              <tr>
                                <th>Nhân viên</th>
                                <th>Khoa/phòng</th>
                                <th>Số lượt</th>
                                <th>Điểm cao nhất</th>
                                <th>Điểm lượt mới nhất</th>
                                <th>Kết quả (điểm cao nhất)</th>
                                <th>Trạng thái lượt mới nhất</th>
                                <th>Thời gian nộp</th>
                                <th>Phân tích</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(results.rows || []).length === 0 ? (
                                <tr><td colSpan="9" className="exp-empty">Chưa có nhân viên trong bài kiểm tra này.</td></tr>
                              ) : (results.rows || []).map((row) => (
                                <tr key={row.userId}>
                                  <td><strong>{row.employeeCode}</strong><br /><span>{row.userName}</span></td>
                                  <td>{row.departmentName || '—'}</td>
                                  <td>{row.attemptCount || 0}</td>
                                  <td><strong>{row.bestScore ?? '—'}</strong></td>
                                  <td>{row.latestScore ?? '—'}</td>
                                  <td>
                                    {row.bestPassed === null || row.bestPassed === undefined
                                      ? <span className="exp-result-pending">Chưa có điểm</span>
                                      : <span className={row.bestPassed ? 'exp-result-correct' : 'exp-result-wrong'}>{row.bestPassed ? 'Đạt' : 'Không đạt'}</span>}
                                  </td>
                                  <td>{row.latestStatusText || 'Chưa làm'}</td>
                                  <td>{formatDateTime(row.latestSubmittedAt)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="exp-btn-secondary"
                                      disabled={!row.latestAttemptId || row.latestStatus !== 'GRADED' || isLoadingAttemptResult}
                                      onClick={() => viewAttemptResult(row)}
                                    >
                                      {selectedAttemptResult?.attemptId === row.latestAttemptId ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {(isLoadingAttemptResult || selectedAttemptResult) && (
                            <section className="exp-detail-panel" style={{ marginTop: 20 }}>
                              <div className="exp-detail-header">
                                <div>
                                  <strong>Phân tích lượt làm bài</strong>
                                  <span>Điểm theo lĩnh vực, mức nhận thức và từng câu hỏi từ snapshot của đề.</span>
                                </div>
                                {selectedAttemptResult && (
                                  <button type="button" className="exp-btn-secondary" onClick={() => setSelectedAttemptResult(null)}><CloseOutlined /> Đóng</button>
                                )}
                              </div>
                              {isLoadingAttemptResult ? (
                                <div className="exp-results-loading"><LoadingOutlined spin /> Đang tải phân tích lượt làm bài...</div>
                              ) : (
                                <>
                                  <div className="exp-results-table-wrap">
                                    <table className="exp-table exp-results-table admin-table-uppercase">
                                      <thead><tr><th>Lĩnh vực</th><th>Đúng / tổng câu</th><th>Điểm</th><th>Ngưỡng</th><th>Kết quả</th></tr></thead>
                                      <tbody>{(selectedAttemptResult.fields || []).map((field) => (
                                        <tr key={field.professionalFieldId}>
                                          <td>{field.professionalFieldCode ? `${field.professionalFieldCode} · ` : ''}{field.professionalFieldName}</td>
                                          <td>{field.correctCount}/{field.totalQuestions}</td><td>{field.score}</td><td>{field.passingThreshold}</td>
                                          <td>{field.passed ? 'Đạt' : 'Không đạt'}</td>
                                        </tr>
                                      ))}</tbody>
                                    </table>
                                  </div>
                                  <div className="exp-results-table-wrap" style={{ marginTop: 16 }}>
                                    <table className="exp-table exp-results-table admin-table-uppercase">
                                      <thead><tr><th>Lĩnh vực</th><th>Mức nhận thức</th><th>Đúng / tổng câu</th><th>Ghi chú</th></tr></thead>
                                      <tbody>{(selectedAttemptResult.cells || []).map((cell) => (
                                        <tr key={`${cell.professionalFieldId}-${cell.cognitiveLevel}`}>
                                          <td>{cell.professionalFieldName}</td><td>{cell.cognitiveLabel}</td>
                                          <td>{cell.correctCount}/{cell.totalQuestions}</td>
                                          <td>{cell.smallSample ? 'Mẫu nhỏ (≤ 1 câu), chỉ tham khảo' : 'Đủ mẫu'}</td>
                                        </tr>
                                      ))}</tbody>
                                    </table>
                                  </div>
                                  <div className="exp-results-table-wrap" style={{ marginTop: 16 }}>
                                    <table className="exp-table exp-results-table admin-table-uppercase">
                                      <thead><tr><th>Vị trí</th><th>Lĩnh vực</th><th>Mức nhận thức</th><th>Câu hỏi</th><th>Kết quả</th></tr></thead>
                                      <tbody>{(selectedAttemptResult.questions || []).map((question) => (
                                        <tr key={question.paperQuestionId}>
                                          <td>{question.position}</td><td>{question.professionalFieldName}</td><td>{question.cognitiveLabel}</td>
                                          <td>{question.stem}</td><td>{question.correct ? 'Đúng' : 'Sai'}</td>
                                        </tr>
                                      ))}</tbody>
                                    </table>
                                  </div>
                                </>
                              )}
                            </section>
                          )}
                        </div>
                      </>
                    )}
                  </section>
                )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingArchive)}
        title="Lưu trữ đợt giao đề?"
        message={pendingArchive ? `Đợt giao “${pendingArchive.name}” sẽ không còn xuất hiện trong danh sách đang quản lý.` : ''}
        confirmText="Lưu trữ đợt giao"
        danger
        onCancel={() => setPendingArchive(null)}
        onConfirm={confirmArchiveAssignment}
      />
    </div>
  )
}

export default ExamAssignmentListPage
