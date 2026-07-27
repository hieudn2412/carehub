import { useEffect, useMemo, useState } from 'react'
import { EyeOutlined, LoadingOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime, formatNumber } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'

export default function ExamTakeListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [search, setSearch] = useState('')
  const [fieldId, setFieldId] = useState('')
  // Mặc định KHÔNG lọc theo ngày: điều kiện lọc là dueAt <= toDate, nếu mặc định
  // toDate = hôm nay thì mọi bài còn hạn (dueAt trong tương lai) đều bị ẩn.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
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

  const openAttempt = attemptId => navigate(`/staff/exam/take/${attemptId}`)

  // Nút hành động chính. Thứ tự bám theo dữ liệu backend trả về:
  // 1. currentAttemptId → còn lượt đang làm dở, vào thẳng lượt đó (ExamAttemptService.start
  //    cũng resume đúng lượt này, nên gọi start hay điều hướng thẳng đều không tạo lượt thừa).
  // 2. actionable → assignment mở, chưa quá hạn, còn lượt: tạo lượt mới (luồng "Làm lại").
  const startAssignment = async (assignment) => {
    if (startingId) return
    if (assignment.currentAttemptId) {
      openAttempt(assignment.currentAttemptId)
      return
    }
    setStartingId(assignment.id)
    try {
      const attempt = apiData(await myExamApi.startAssignment(assignment.id), null)
      if (!attempt?.id) throw new Error('Thiếu id lượt làm bài trong phản hồi')
      openAttempt(attempt.id)
    } catch (error) { showToast(apiErrorMessage(error), 'error') }
    finally { setStartingId(null) }
  }

  const assessmentLabel = value => value === 'PASSED' ? 'Đạt' : value === 'FAILED' ? 'Chưa đạt' : 'Chưa làm'
  const canStart = item => Boolean(item.currentAttemptId || item.actionable)
  // detailAttemptId là lượt điểm cao nhất; khi chưa có lượt nào được chấm nó trùng
  // currentAttemptId → bỏ qua để không render hai nút cùng đích.
  const detailIdOf = item => (item.detailAttemptId && item.detailAttemptId !== item.currentAttemptId ? item.detailAttemptId : null)
  // Không tự chế nhãn: backend đã trả actionLabel cho đủ 5 trạng thái khả dụng.
  const primaryLabel = (item) => {
    if (item.actionLabel) return item.actionLabel
    if (item.currentAttemptId) return 'Tiếp tục'
    if (item.actionable) return 'Bắt đầu'
    return item.availabilityText || 'Không khả dụng'
  }
  const primaryHint = (item) => {
    if (startingId === item.id) return 'Đang tạo lượt làm bài...'
    if (canStart(item)) return primaryLabel(item)
    return item.availabilityText || 'Bài kiểm tra hiện không khả dụng'
  }

  return <AppShell title="Năng lực chuyên môn"><div className="eh-page">
      <div className="eh-header"><h1 className="eh-page-title">Năng lực chuyên môn</h1><p className="eh-page-sub">Theo dõi và hoàn thành các bài kiểm tra được giao</p></div>
      <div className="eh-summary-grid">
        <div className="eh-take-summary-card"><span>Tổng</span><strong>{stats.total}</strong></div>
        <div className="eh-take-summary-card eh-take-summary-card--success"><span>Đạt</span><strong>{stats.passed}</strong></div>
        <div className="eh-take-summary-card eh-take-summary-card--danger"><span>Chưa đạt</span><strong>{stats.failed}</strong></div>
        <div className="eh-take-summary-card"><span>Chưa làm</span><strong>{stats.notTaken}</strong></div>
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
        <div className="eh-date-range" role="group" aria-label="Khoảng thời hạn hoàn thành">
          <label className="eh-date-filter">
            <span className="eh-date-filter__label">Từ ngày</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={event => setFromDate(event.target.value)}
              aria-label="Từ ngày"
            />
          </label>
          <span className="eh-date-range__divider" aria-hidden="true" />
          <label className="eh-date-filter">
            <span className="eh-date-filter__label">Đến ngày</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={event => setToDate(event.target.value)}
              aria-label="Đến ngày"
            />
          </label>
        </div>
      </div>
      <div className="eh-table-card"><table className="eh-table eh-table--cards"><thead><tr><th>Tên bài kiểm tra</th><th>Thời hạn hoàn thành</th><th>Lượt làm bài</th><th>Điểm cao nhất</th><th>Đánh giá</th><th>Hành động</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6">Đang tải bài kiểm tra...</td></tr> : filtered.length === 0 ? <tr><td colSpan="6">{assignments.length === 0 ? 'Bạn chưa được giao bài kiểm tra nào.' : 'Không có bài kiểm tra khớp bộ lọc đã chọn.'}</td></tr> : filtered.map(item => <tr key={item.id} className={item.assessmentStatus === 'FAILED' ? 'eh-row--danger' : ''}>
          <td data-label="Tên bài kiểm tra"><strong>{item.name}</strong></td><td data-label="Thời hạn">{formatDateTime(item.dueAt)}</td>
          <td data-label="Lượt làm bài"><span className="eh-attempt-cell">
            <span className="eh-attempt-count">{item.usedAttempts ?? 0}/{item.maxAttempts ?? '—'}</span>
            {item.currentAttemptId
              ? <span className="ch-badge ch-badge--amber">{item.availabilityText || 'Đang làm'}</span>
              : !item.actionable && item.availabilityText ? <span className="ch-badge ch-badge--neutral">{item.availabilityText}</span> : null}
          </span></td>
          <td data-label="Điểm cao nhất">{item.bestScore == null ? '—' : `${formatNumber(item.bestScore)}/10`}</td>
          <td data-label="Đánh giá"><span className={`eh-badge eh-badge--${String(item.assessmentStatus).toLowerCase()}`}>{assessmentLabel(item.assessmentStatus)}</span></td>
          <td><span className="eh-row-actions">
            {detailIdOf(item) ? <button type="button" className="eh-btn eh-btn--view" onClick={() => openAttempt(detailIdOf(item))} title="Xem chi tiết lượt điểm cao nhất">
              <EyeOutlined /><span>Xem chi tiết</span>
            </button> : null}
            {/* Tooltip đặt trên span bọc ngoài: trình duyệt không hiện title của button bị disabled */}
            <span className="eh-action-wrap" title={primaryHint(item)}>
              <button type="button" className="eh-btn eh-btn--retry" onClick={() => startAssignment(item)} disabled={startingId !== null || !canStart(item)} title={primaryHint(item)} aria-busy={startingId === item.id}>
                {startingId === item.id ? <LoadingOutlined spin /> : canStart(item) ? <PlayCircleOutlined /> : null}
                <span>{primaryLabel(item)}</span>
              </button>
            </span>
          </span></td>
        </tr>)}
      </tbody></table></div>
  </div></AppShell>
}
