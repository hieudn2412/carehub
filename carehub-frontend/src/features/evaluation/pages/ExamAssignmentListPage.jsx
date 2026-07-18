import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeleteOutlined, EyeOutlined, FolderOpenOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, StopOutlined, BarChartOutlined } from '@ant-design/icons'
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

  function viewResults(assignment) {
    navigate(`/admin/evaluation/exam-attempts?assignmentId=${assignment.id}`)
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
                      <th>Số NV</th>
                      <th>Đã nộp</th>
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
                        <td>{assignment.submittedCount ?? 0}/{assignment.attemptCount ?? '-'}</td>
                        <td>{formatDateTime(assignment.dueAt)}</td>
                        <td><span className={`exp-badge exp-badge--${assignment.status?.toLowerCase()}`}>{assignment.statusText || assignment.status}</span></td>
                        <td>
                          <div className="exp-actions">
                            <button type="button" onClick={() => viewResults(assignment)} title="Xem kết quả"><BarChartOutlined /></button>
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
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamAssignmentListPage
