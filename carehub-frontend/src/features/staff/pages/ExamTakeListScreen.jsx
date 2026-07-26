import { useEffect, useMemo, useState } from 'react'
import { EyeOutlined, LoadingOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/sidebar.jsx'
import Header from '../components/Header.jsx'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime, formatNumber } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'

const today = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function ExamTakeListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [search, setSearch] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(today())
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try { setAssignments(apiData(await myExamApi.listAssignments(), [])) }
      catch (error) { showToast(apiErrorMessage(error), 'error') }
      finally { setLoading(false) }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [showToast])

  const fields = useMemo(() => Array.from(new Map(assignments.filter(item => item.professionalFieldId).map(item => [String(item.professionalFieldId), item.professionalFieldName])).entries()), [assignments])
  const filtered = useMemo(() => assignments.filter(item => {
    const dueDate = item.dueAt?.slice(0, 10)
    const matchesDate = (!fromDate || !dueDate || dueDate >= fromDate) && (!toDate || !dueDate || dueDate <= toDate)
    return matchesDate
      && (!fieldId || String(item.professionalFieldId) === fieldId)
      && (!search.trim() || (item.name || '').toLowerCase().includes(search.trim().toLowerCase()))
  }), [assignments, fieldId, fromDate, search, toDate])

  const stats = useMemo(() => ({
    total: filtered.length,
    passed: filtered.filter(item => item.assessmentStatus === 'PASSED').length,
    failed: filtered.filter(item => item.assessmentStatus === 'FAILED').length,
    notTaken: filtered.filter(item => item.assessmentStatus === 'NOT_TAKEN').length,
  }), [filtered])

  const openAssignment = async (assignment) => {
    if (assignment.detailAttemptId) {
      navigate(`/staff/exam/take/${assignment.detailAttemptId}`)
      return
    }
    if (!assignment.actionable || startingId) return
    setStartingId(assignment.id)
    try {
      const attempt = apiData(await myExamApi.startAssignment(assignment.id), null)
      navigate(`/staff/exam/take/${attempt.id}`)
    } catch (error) { showToast(apiErrorMessage(error), 'error') }
    finally { setStartingId(null) }
  }

  const assessmentLabel = value => value === 'PASSED' ? 'Đạt' : value === 'FAILED' ? 'Chưa đạt' : 'Chưa làm'

  return <div className="dashboard-layout"><Sidebar /><div className="dashboard-layout__content">
    <Header title="Năng lực chuyên môn" />
    <div className="dashboard-layout__body"><div className="eh-page">
      <div className="eh-header"><h1 className="eh-page-title">Năng lực chuyên môn</h1><p className="eh-page-sub">Theo dõi và hoàn thành các bài kiểm tra được giao</p></div>
      <div className="eh-summary-grid">
        <div className="eh-summary-card"><span>Tổng</span><strong>{stats.total}</strong></div>
        <div className="eh-summary-card eh-summary-card--success"><span>Đạt</span><strong>{stats.passed}</strong></div>
        <div className="eh-summary-card eh-summary-card--danger"><span>Chưa đạt</span><strong>{stats.failed}</strong></div>
        <div className="eh-summary-card"><span>Chưa làm</span><strong>{stats.notTaken}</strong></div>
      </div>
      <div className="eh-filter-bar">
        <div className="eh-search"><span className="eh-search-icon"><SearchOutlined /></span><input className="eh-search-input" placeholder="Tìm tên bài kiểm tra..." value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="eh-field-filter"><SearchableSelect
          value={fieldId}
          onChange={setFieldId}
          options={[
            { value: '', label: 'Tất cả lĩnh vực' },
            ...fields.map(([id, name]) => ({ value: id, label: name })),
          ]}
          placeholder="Tất cả lĩnh vực"
          searchPlaceholder="Tìm tên lĩnh vực..."
          ariaLabel="Tìm và chọn lĩnh vực chuyên môn"
        /></div>
        <label>Từ <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
        <label>Đến <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
      </div>
      <div className="eh-table-card"><table className="eh-table"><thead><tr><th>Tên bài kiểm tra</th><th>Thời hạn hoàn thành</th><th>Kết quả bài kiểm tra</th><th>Đánh giá</th><th>Chi tiết</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="5">Đang tải bài kiểm tra...</td></tr> : filtered.length === 0 ? <tr><td colSpan="5">Chưa có bài kiểm tra trong phạm vi đã chọn.</td></tr> : filtered.map(item => <tr key={item.id} className={item.assessmentStatus === 'FAILED' ? 'eh-row--danger' : ''}>
          <td><strong>{item.name}</strong></td><td>{formatDateTime(item.dueAt)}</td><td>{item.bestScore == null ? '—' : `${formatNumber(item.bestScore)}/10`}</td>
          <td><span className={`eh-badge eh-badge--${String(item.assessmentStatus).toLowerCase()}`}>{assessmentLabel(item.assessmentStatus)}</span></td>
          <td><button type="button" className="eh-btn eh-btn--retry" onClick={() => openAssignment(item)} disabled={startingId !== null || (!item.detailAttemptId && !item.actionable)} title="Chi tiết">
            {startingId === item.id ? <LoadingOutlined spin /> : item.detailAttemptId ? <EyeOutlined /> : <PlayCircleOutlined />}
          </button></td>
        </tr>)}
      </tbody></table></div>
    </div></div>
  </div></div>
}
