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
  const [isLoadingResults, setIsLoadingResults] = useState(false)
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
    setPendingArchive(assignment)
  }

  async function confirmArchiveAssignment() {
    if (!pendingArchive) return
    const assignment = pendingArchive
    setPendingArchive(null)
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
                      <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm phân công, mã đề, tên đề" />
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
                      <PlusCircleOutlined /> Tạo & giao bài
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
                      <th>Tên phân công</th>
                      <th>Bộ đề</th>
                      <th>Lĩnh vực chuyên môn</th>
                      <th>Số NV</th>
                      <th>Đã nộp</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th style={{ width: 170 }}>Hành động</th>
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
                          <div><span>Điểm TB (theo điểm cao nhất)</span><strong>{results.averageScore ?? '—'}</strong></div>
                          <div><span>Điểm cao nhất toàn đợt</span><strong>{results.bestScore ?? '—'}</strong></div>
                        </div>

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
                                  <td><strong>{row.bestScore ?? '—'}</strong></td>
                                  <td>{row.latestScore ?? '—'}</td>
                                  <td>
                                    {row.bestPassed === null || row.bestPassed === undefined
                                      ? <span className="exp-result-pending">Chưa có điểm</span>
                                      : <span className={row.bestPassed ? 'exp-result-correct' : 'exp-result-wrong'}>{row.bestPassed ? 'Đạt' : 'Không đạt'}</span>}
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
              </section>
            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingArchive)}
        title="Lưu trữ phân công?"
        message={pendingArchive ? `Phân công “${pendingArchive.name}” sẽ không còn xuất hiện trong danh sách đang quản lý.` : ''}
        confirmText="Lưu trữ phân công"
        danger
        onCancel={() => setPendingArchive(null)}
        onConfirm={confirmArchiveAssignment}
      />
    </div>
  )
}

export default ExamAssignmentListPage
