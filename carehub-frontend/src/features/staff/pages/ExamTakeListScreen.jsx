import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayCircleOutlined, SearchOutlined } from '@ant-design/icons'
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
  const [loading, setLoading] = useState(true)

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
      return matchesSearch && assignment.status === 'OPEN'
    })
  }, [assignments, search])

  async function startAssignment(assignment) {
    try {
      const response = await myExamApi.startAssignment(assignment.id)
      const attempt = apiData(response, null)
      navigate(`/staff/exam/take/${attempt.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
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
            </div>

            <div className="eh-table-card">
              <table className="eh-table">
                <thead>
                  <tr>
                    <th>Phân công</th>
                    <th>Bộ đề</th>
                    <th>Hạn nộp</th>
                    <th>Số lượt tối đa</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6">Đang tải bài kiểm tra...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="6">Chưa có bài kiểm tra đang mở.</td></tr>
                  ) : filtered.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.name}</td>
                      <td>{assignment.examPaperName}</td>
                      <td>{formatDateTime(assignment.dueAt)}</td>
                      <td>{assignment.maxAttempts}</td>
                      <td>{assignment.statusText}</td>
                      <td>
                        <button className="eh-btn eh-btn--retry" onClick={() => startAssignment(assignment)}>
                          <PlayCircleOutlined /> Làm bài
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
