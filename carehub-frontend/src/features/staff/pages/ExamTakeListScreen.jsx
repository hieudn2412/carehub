import { useEffect, useMemo, useState } from 'react'
import { EyeOutlined, FilterOutlined, LoadingOutlined, LockOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
import '../styles/ExamHistoryScreen.css'
import { myExamApi } from '../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime, formatNumber } from '../../../shared/utils/apiUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { validateHistoricalDateRange } from '../../../shared/utils/dateRange.js'

export default function ExamTakeListScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [search, setSearch] = useState('')
  // Mặc định KHÔNG lọc theo ngày: điều kiện lọc là dueAt <= toDate, nếu mặc định
  // toDate = hôm nay thì mọi bài còn hạn (dueAt trong tương lai) đều bị ẩn.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [draftFromDate, setDraftFromDate] = useState('')
  const [draftToDate, setDraftToDate] = useState('')
  const [filterError, setFilterError] = useState('')
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try { setAssignments(apiData(await myExamApi.listAssignments(), [])) }
      catch (error) { showToast(apiErrorMessage(error), 'error') }
      finally { setLoading(false) }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [showToast])

  const filtered = useMemo(() => assignments.filter(item => {
    const dueDate = item.dueAt?.slice(0, 10)
    const matchesDate = (!fromDate || !dueDate || dueDate >= fromDate) && (!toDate || !dueDate || dueDate <= toDate)
    return matchesDate
      && (!search.trim() || (item.name || '').toLowerCase().includes(search.trim().toLowerCase()))
  }), [assignments, fromDate, search, toDate])

  const stats = useMemo(() => ({
    total: filtered.length,
    passed: filtered.filter(item => item.assessmentStatus === 'PASSED').length,
    failed: filtered.filter(item => item.assessmentStatus === 'FAILED').length,
    notTaken: filtered.filter(item => item.assessmentStatus === 'NOT_TAKEN').length,
  }), [filtered])
  const activeFilterCount = Number(Boolean(fromDate)) + Number(Boolean(toDate))

  const applyDateFilters = () => {
    const dateError = validateHistoricalDateRange(draftFromDate, draftToDate, {
      maxDate: null,
      required: false,
    })
    if (dateError) {
      setFilterError(dateError)
      return
    }
    setFilterError('')
    setFromDate(draftFromDate)
    setToDate(draftToDate)
    setIsFilterOpen(false)
  }

  const resetDateFilters = () => {
    setFilterError('')
    setDraftFromDate('')
    setDraftToDate('')
    setFromDate('')
    setToDate('')
  }

  const openAttempt = attemptId => navigate(`/staff/exam/take/${attemptId}`, {
    state: { from: `${location.pathname}${location.search}` },
  })

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

  const assessmentLabel = value => {
    if (value === 'PASSED') return 'Đạt'
    if (value === 'FAILED') return 'Chưa đạt'
    if (value === 'PENDING') return 'Chờ công bố'
    return 'Chưa làm'
  }
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

  const isProfessionalList = location.pathname.startsWith('/staff/professional-competency')

  return <AppShell
    title={isProfessionalList ? 'Danh sách bài kiểm tra' : 'Bài kiểm tra'}
    back={isProfessionalList ? { label: 'Năng lực chuyên môn', to: '/staff/professional-competency' } : undefined}
    breadcrumbs={isProfessionalList ? [
      { label: 'Năng lực chuyên môn', link: '/staff/professional-competency' },
      { label: 'Danh sách bài kiểm tra' },
    ] : [{ label: 'Bài kiểm tra' }]}
  ><div className="eh-page">
      <div className="eh-summary-grid">
        <div className="eh-take-summary-card"><span>Tổng</span><strong>{stats.total}</strong></div>
        <div className="eh-take-summary-card eh-take-summary-card--success"><span>Đạt</span><strong>{stats.passed}</strong></div>
        <div className="eh-take-summary-card eh-take-summary-card--danger"><span>Chưa đạt</span><strong>{stats.failed}</strong></div>
        <div className="eh-take-summary-card"><span>Chưa làm</span><strong>{stats.notTaken}</strong></div>
      </div>
      <div className="eh-filter-bar admin-control-toolbar">
        <div className="admin-control-toolbar__main">
          <div className="eh-search"><span className="eh-search-icon"><SearchOutlined /></span><input className="eh-search-input" placeholder="Tìm tên bài kiểm tra..." value={search} onChange={event => setSearch(event.target.value)} /></div>
          <button
            type="button"
            className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
            aria-expanded={isFilterOpen}
            aria-controls="staff-exam-filter-panel"
            onClick={() => {
              setFilterError('')
              setDraftFromDate(fromDate)
              setDraftToDate(toDate)
              setIsFilterOpen(current => !current)
            }}
          >
            <FilterOutlined />
            Bộ lọc
            {activeFilterCount > 0 && <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>}
          </button>
        </div>
        {isFilterOpen && (
          <div id="staff-exam-filter-panel" className="eh-filter-panel admin-control-toolbar__panel">
            <label className="admin-control-toolbar__field">
              <span>Từ ngày</span>
              <KeyboardDatePicker allowInvalidValue value={draftFromDate} max={draftToDate || undefined} onChange={val => { setFilterError(''); setDraftFromDate(val) }} />
            </label>
            <label className="admin-control-toolbar__field">
              <span>Đến ngày</span>
              <KeyboardDatePicker allowInvalidValue value={draftToDate} min={draftFromDate || undefined} onChange={val => { setFilterError(''); setDraftToDate(val) }} />
            </label>
            <FilterActionButtons onApply={applyDateFilters} onReset={resetDateFilters} />
            {filterError && <p className="applied-filter-toolbar__error" role="alert">{filterError}</p>}
          </div>
        )}
      </div>
      <div className="eh-table-card"><table className="eh-table eh-table--cards eh-take-table admin-table-uppercase">
        <colgroup>
          <col className="eh-take-table__name-col" />
          <col className="eh-take-table__due-col" />
          <col className="eh-take-table__attempt-col" />
          <col className="eh-take-table__score-col" />
          <col className="eh-take-table__score-col" />
          <col className="eh-take-table__status-col" />
          <col className="eh-take-table__action-col" />
        </colgroup>
        <thead><tr><th>Tên bài kiểm tra</th><th>Thời hạn hoàn thành</th><th>Lượt làm bài</th><th>Điểm đạt <small>/10</small></th><th>Điểm cao nhất <small>/10</small></th><th>Đánh giá</th><th>Hành động</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7">Đang tải bài kiểm tra...</td></tr> : filtered.length === 0 ? <tr><td colSpan="7">{assignments.length === 0 ? 'Bạn chưa được giao bài kiểm tra nào.' : 'Không có bài kiểm tra khớp bộ lọc đã chọn.'}</td></tr> : filtered.map(item => <tr key={item.id} className={item.assessmentStatus === 'FAILED' ? 'eh-row--danger' : ''}>
          <td data-label="Tên bài kiểm tra"><strong>{item.name}</strong></td><td data-label="Thời hạn">{formatDateTime(item.dueAt)}</td>
          <td data-label="Lượt làm bài"><span className="eh-attempt-cell">
            <span className="eh-attempt-count">{item.usedAttempts ?? 0}/{item.maxAttempts ?? '—'}</span>
            {item.currentAttemptId
              ? <span className="ch-badge ch-badge--amber">{item.availabilityText || 'Đang làm'}</span>
              : !item.actionable && item.availabilityText ? <span className="ch-badge ch-badge--neutral">{item.availabilityText}</span> : null}
          </span></td>
          <td data-label="Điểm đạt (/10)">{item.passingScore == null ? '—' : formatNumber(item.passingScore)}</td>
          <td data-label="Điểm cao nhất (/10)">{item.bestScore == null ? '—' : formatNumber(item.bestScore)}</td>
          <td data-label="Đánh giá"><span className={`eh-badge eh-badge--${String(item.assessmentStatus).toLowerCase()}`}>{assessmentLabel(item.assessmentStatus)}</span></td>
          <td data-label="Hành động"><span className="eh-row-actions">
            {detailIdOf(item) ? <button type="button" className="eh-btn eh-btn--view admin-table-action admin-table-action--icon admin-table-action--primary" onClick={() => openAttempt(detailIdOf(item))} title="Xem chi tiết lượt điểm cao nhất" aria-label={`Xem kết quả ${item.name}`}>
              <EyeOutlined />
            </button> : null}
            {/* Tooltip đặt trên span bọc ngoài: trình duyệt không hiện title của button bị disabled */}
            <span className="eh-action-wrap" title={primaryHint(item)}>
              <button
                type="button"
                className="eh-btn eh-btn--retry admin-table-action admin-table-action--icon admin-table-action--success"
                onClick={() => startAssignment(item)}
                disabled={startingId !== null || !canStart(item)}
                title={primaryHint(item)}
                aria-label={`${primaryLabel(item)}: ${item.name}`}
                aria-busy={startingId === item.id}
              >
                {startingId === item.id ? <LoadingOutlined spin /> : canStart(item) ? <PlayCircleOutlined /> : <LockOutlined />}
              </button>
            </span>
          </span></td>
        </tr>)}
      </tbody></table></div>
  </div></AppShell>
}
