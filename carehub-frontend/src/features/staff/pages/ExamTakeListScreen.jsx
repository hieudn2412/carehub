import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'

function ExamTakeListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIONABLE')
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState(null)

  useEffect(() => {
    async function loadAssignments() {
      setLoading(true)
      try {
        const response = await myExamApi.listAssignments()
        setAssignments(apiData(response, []))
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      } finally {
        setLoading(false)
      }
    }
    loadAssignments()
  }, [showToast])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return assignments.filter((assignment) => {
      const matchesSearch = !normalized
        || (assignment.name || '').toLowerCase().includes(normalized)
        || (assignment.examPaperName || '').toLowerCase().includes(normalized)
      const matchesStatus = statusFilter === ''
        || (statusFilter === 'ACTIONABLE' && assignment.actionable)
        || (statusFilter === 'IN_PROGRESS' && assignment.availabilityStatus === 'IN_PROGRESS')
        || (statusFilter === 'COMPLETED' && assignment.availabilityStatus === 'COMPLETED')
        || (statusFilter === 'UNAVAILABLE' && !assignment.actionable && assignment.availabilityStatus !== 'COMPLETED')
      return matchesSearch && matchesStatus
    })
  }, [assignments, search, statusFilter])

  async function startAssignment(assignment) {
    if (!assignment.actionable || startingId) return
    if (assignment.currentAttemptId) {
      navigate(`/staff/exam/take/${assignment.currentAttemptId}`)
      return
    }
    setStartingId(assignment.id)
    try {
      const response = await myExamApi.startAssignment(assignment.id)
      const attempt = apiData(response, null)
      navigate(`/staff/exam/take/${attempt.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Làm bài thi" />
        <div className="dashboard-layout__body">
          <div className="eh-page">
            <div className="eh-header">
              <h2 className="eh-page-title">Bài kiểm tra được phân công</h2>
              <p className="eh-page-sub">Chọn bài đang mở để bắt đầu hoặc tiếp tục lượt làm hiện tại</p>
            </div>

            <div className="eh-filter-bar">
              <div className="eh-search">
                <span className="eh-search-icon"><SearchOutlined /></span>
                <input className="eh-search-input" placeholder="Tìm tên bài kiểm tra..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIONABLE">Có thể làm</option>
                <option value="IN_PROGRESS">Đang làm</option>
                <option value="COMPLETED">Đã hoàn thành</option>
                <option value="UNAVAILABLE">Đã đóng / quá hạn</option>
              </select>
            </div>

            <div className="eh-table-card">
              <table className="eh-table">
                <thead>
                  <tr>
                    <th>Phân công</th>
                    <th>Bộ đề</th>
                    <th>Lĩnh vực chuyên môn</th>
                    <th>Hạn nộp</th>
                      <th>Số lượt</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="7">Đang tải bài kiểm tra...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="7">Chưa có bài kiểm tra nào. Liên hệ trưởng phòng để được phân công bài kiểm tra.</td></tr>
                  ) : filtered.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.name}</td>
                      <td>{assignment.examPaperName}</td>
                      <td>{assignment.professionalFieldName || '—'}</td>
                      <td>{formatDateTime(assignment.dueAt)}</td>
                      <td>{assignment.usedAttempts || 0}/{assignment.maxAttempts}</td>
                      <td>
                        <span className={`eh-badge eh-badge--availability-${String(assignment.availabilityStatus || '').toLowerCase()}`}>
                          <span className="eh-badge__dot" />
                          {assignment.availabilityText}
                        </span>
                      </td>
                      <td>
                        <button
                          className="eh-btn eh-btn--retry"
                          onClick={() => startAssignment(assignment)}
                          disabled={!assignment.actionable || startingId !== null}
                        >
                          {startingId === assignment.id ? <LoadingOutlined spin /> : <PlayCircleOutlined />}
                          {startingId === assignment.id ? 'Đang mở...' : assignment.actionLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExamTakeListScreen
