import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteOutlined, EyeOutlined, FileTextOutlined, FolderOpenOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, StopOutlined, FilterOutlined, UserAddOutlined } from '@ant-design/icons'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import AppShell from '../../../shared/components/AppShell.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import ExamPaperPreviewModal from '../components/ExamPaperPreviewModal.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ExamAssignmentAddTargetsModal from '../components/ExamAssignmentAddTargetsModal.jsx'
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
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pendingArchive, setPendingArchive] = useState(null)
  const [pendingAddTargets, setPendingAddTargets] = useState(null)
  const [previewPaperId, setPreviewPaperId] = useState(null)

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

  async function handleTargetsAdded(addedCount) {
    await loadAssignments()
    return addedCount
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

  function viewResults(assignment) {
    navigate(`/admin/evaluation/exam-management/assignments/${assignment.id}/results`)
  }

  const breadcrumbs = [{ label: 'Quản lý bài kiểm tra' }]

  return (
    <AppShell className="dashboard-layout" breadcrumbs={breadcrumbs}>
      <div className="exp-page">
              <section className="exp-management-card">
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
                    <FilterSelectField
                      className="admin-control-toolbar__field"
                      label="Trạng thái"
                      value={status}
                      onChange={setStatus}
                      options={[
                        { value: '', label: 'Tất cả trạng thái' },
                        { value: 'DRAFT', label: 'Bản nháp' },
                        { value: 'OPEN', label: 'Đang mở' },
                        { value: 'CLOSED', label: 'Đã đóng' },
                        { value: 'ARCHIVED', label: 'Đã lưu trữ' },
                      ]}
                    />
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
                      <th>Đã nộp / Tổng NV</th>
                      <th>Hạn nộp</th>
                      <th>Trạng thái</th>
                      <th style={{ width: 260 }}>Hành động</th>
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
                        <td>{assignment.submittedTargetCount ?? 0}/{assignment.targetCount ?? 0}</td>
                        <td>{formatDateTime(assignment.dueAt)}</td>
                        <td><span className={`exp-badge exp-badge--${assignment.status?.toLowerCase()}`}>{assignment.statusText || assignment.status}</span></td>
                        <td>
                          <div className="admin-table-actions exp-table-actions">
                            <button
                              type="button"
                              className="admin-table-action admin-table-action--icon admin-table-action--primary"
                              onClick={() => viewResults(assignment)}
                              title="Xem kết quả"
                              aria-label={`Xem kết quả ${assignment.name}`}
                            ><EyeOutlined /></button>
                            <button
                              type="button"
                              className="admin-table-action admin-table-action--icon"
                              onClick={() => setPreviewPaperId(assignment.examPaperId)}
                              disabled={!assignment.examPaperId}
                              title="Xem mã đề"
                            ><FileTextOutlined /></button>
                            {assignment.status !== 'OPEN' && assignment.status !== 'ARCHIVED' && (
                              <button type="button" className="admin-table-action admin-table-action--icon admin-table-action--success" onClick={() => openAssignment(assignment)} title="Mở"><FolderOpenOutlined /></button>
                            )}
                            {assignment.status === 'OPEN' && (
                              <button
                                type="button"
                                className="admin-table-action admin-table-action--icon admin-table-action--success"
                                onClick={() => setPendingAddTargets(assignment)}
                                title="Giao bổ sung nhân viên"
                              ><UserAddOutlined /></button>
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

                </div>
              </section>
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
      {pendingAddTargets && (
        <ExamAssignmentAddTargetsModal
          assignment={pendingAddTargets}
          onAdded={handleTargetsAdded}
          onClose={() => setPendingAddTargets(null)}
        />
      )}
      {previewPaperId && (
        <ExamPaperPreviewModal
          paperId={previewPaperId}
          onClose={() => setPreviewPaperId(null)}
        />
      )}
    </AppShell>
  )
}

export default ExamAssignmentListPage
