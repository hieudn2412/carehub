import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatDateTime, formatNumber } from '../utils/documentQuestionUi.js'
import './ExamResultPages.css'

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  const score = Number(value)
  return Number.isFinite(score) ? formatNumber(score) : '—'
}

function scoreWithScale(value) {
  const score = formatScore(value)
  return score === '—' ? score : `${score}/10`
}

function resultLabel(passed) {
  if (passed === null || passed === undefined) return 'Chưa có kết quả'
  return passed ? 'Đạt' : 'Chưa đạt'
}

function resultTone(passed) {
  if (passed === null || passed === undefined) return 'pending'
  return passed ? 'passed' : 'failed'
}

function SummaryCard({ label, value, tone = '' }) {
  return (
    <article className={`ear-summary-card${tone ? ` ear-summary-card--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function EmptyTableRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan} className="ear-empty">{children}</td></tr>
}

export default function ExamAssignmentResultsPage() {
  const navigate = useNavigate()
  const { assignmentId } = useParams()
  const { showToast } = useToast()
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedResult, setSelectedResult] = useState('all')
  const [selectedViolation, setSelectedViolation] = useState('all')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const resultsResponse = await examAssignmentApi.getAssignmentResults(assignmentId)
      setResults(apiData(resultsResponse, null))
    } catch (requestError) {
      setResults(null)
      setError(apiErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rows = useMemo(() => results?.rows || [], [results])
  const completedCount = (results?.submittedCount || 0) + (results?.gradedCount || 0)
  const backPath = '/admin/evaluation/exam-management?view=assignments'

  // Extract departments with candidate count
  const departmentOptions = useMemo(() => {
    const deptMap = new Map()
    for (const r of rows) {
      const dept = r.departmentName?.trim()
      if (dept) {
        deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
      }
    }
    return Array.from(deptMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [rows])

  // Count candidates with violations
  const violationCandidatesCount = useMemo(() => {
    return rows.filter(r => Number(r.latestTabSwitchCount) > 0).length
  }, [rows])

  // Check if any filter is active
  const isFiltered = useMemo(() => {
    return Boolean(
      searchQuery.trim() ||
      selectedDepartment !== 'all' ||
      selectedResult !== 'all' ||
      selectedViolation !== 'all'
    )
  }, [searchQuery, selectedDepartment, selectedResult, selectedViolation])

  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedDepartment('all')
    setSelectedResult('all')
    setSelectedViolation('all')
  }, [])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchName = row.userName?.toLowerCase().includes(query)
        const matchCode = row.employeeCode?.toLowerCase().includes(query)
        if (!matchName && !matchCode) return false
      }

      // 2. Department
      if (selectedDepartment !== 'all') {
        if (row.departmentName?.trim() !== selectedDepartment) return false
      }

      // 3. Result Status
      if (selectedResult !== 'all') {
        if (selectedResult === 'passed') {
          if (!row.bestPassed) return false
        } else if (selectedResult === 'failed') {
          if (row.bestPassed !== false) return false
        } else if (selectedResult === 'not_started') {
          if (row.attemptCount > 0 || (row.latestStatus && row.latestStatus !== 'NOT_STARTED')) return false
        } else if (selectedResult === 'in_progress') {
          if (row.latestStatus !== 'IN_PROGRESS') return false
        }
      }

      // 4. Violation Status
      if (selectedViolation !== 'all') {
        const hasViolation = Number(row.latestTabSwitchCount) > 0
        if (selectedViolation === 'has_violation' && !hasViolation) return false
        if (selectedViolation === 'clean' && hasViolation) return false
      }

      return true
    })
  }, [rows, searchQuery, selectedDepartment, selectedResult, selectedViolation])

  async function exportResults() {
    setIsExporting(true)
    try {
      const params = {}
      if (searchQuery.trim()) params.q = searchQuery.trim()
      if (selectedDepartment !== 'all') params.department = selectedDepartment
      if (selectedResult !== 'all') params.status = selectedResult
      if (selectedViolation === 'has_violation') params.violation = true
      if (selectedViolation === 'clean') params.violation = false

      const response = await examAssignmentApi.exportAssignmentResults(assignmentId, params)
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const filterSuffix = isFiltered ? '-loc' : ''
      link.download = `ket-qua-dot-giao-${assignmentId}${filterSuffix}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
      showToast(
        isFiltered
          ? `Đã xuất kết quả ${filteredRows.length} nhân viên (theo bộ lọc) ra file Excel.`
          : `Đã xuất toàn bộ kết quả (${rows.length} nhân viên) ra file Excel.`,
        'success'
      )
    } catch (requestError) {
      showToast(apiErrorMessage(requestError), 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell
      title="Kết quả bài kiểm tra"
      back={{ to: backPath, label: 'Quản lý giao đề' }}
      breadcrumbs={[
        { label: 'Quản lý bài kiểm tra', link: backPath },
        { label: 'Kết quả bài kiểm tra' },
      ]}
    >
      <div className="ear-page">
        <section className="ear-hero">
          <div className="ear-hero__copy">
            <span className="ear-eyebrow">KẾT QUẢ ĐỢT GIAO</span>
            <h1>{results?.assignmentName || `Đợt giao #${assignmentId}`}</h1>
            <p>{results?.examPaperCode ? `${results.examPaperCode} · ${results.examPaperName}` : 'Theo dõi tiến độ, điểm số và kết quả của nhân viên.'}</p>
          </div>
          <div className="ear-hero__actions">
            <button type="button" className="ear-button ear-button--secondary" onClick={() => navigate(backPath)}>
              <ArrowLeftOutlined /> Quay lại giao đề
            </button>
            <button type="button" className="ear-button ear-button--secondary" onClick={loadData} disabled={isLoading}>
              <ReloadOutlined /> Tải lại
            </button>
            <button
              type="button"
              className="ear-button ear-button--primary"
              onClick={exportResults}
              disabled={isLoading || isExporting || !results}
              title={isFiltered ? `Xuất Excel ${filteredRows.length} nhân viên theo bộ lọc` : 'Xuất Excel toàn bộ danh sách'}
            >
              {isExporting ? <LoadingOutlined spin /> : <DownloadOutlined />}
              {isExporting ? 'Đang xuất...' : isFiltered ? `Xuất Excel lọc (${filteredRows.length})` : 'Xuất Excel'}
            </button>
            <button
              type="button"
              className="ear-button ear-button--secondary"
              onClick={() => navigate(`/admin/evaluation/exam-management/assignments/${assignmentId}/paper/${results?.examPaperId}`)}
              disabled={!results?.examPaperId}
            >
              Xem mã đề
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="ear-state ear-state--loading"><LoadingOutlined spin /> Đang tải kết quả bài kiểm tra...</div>
        ) : error ? (
          <div className="ear-state ear-state--error" role="alert">
            <strong>Chưa tải được kết quả</strong>
            <span>{error}</span>
            <button type="button" className="ear-button ear-button--secondary" onClick={loadData}>Thử lại</button>
          </div>
        ) : results ? (
          <>
            <section className="ear-summary-grid ear-summary-grid--5" aria-label="Tổng quan kết quả">
              <SummaryCard label="Tổng nhân viên" value={results.targetCount || 0} />
              <SummaryCard label="Đã hoàn thành" value={completedCount} tone="passed" />
              <SummaryCard label="Điểm trung bình" value={scoreWithScale(results.averageScore)} />
              <SummaryCard label="Điểm cao nhất" value={scoreWithScale(results.bestScore)} tone="highlight" />
              <SummaryCard
                label="Vi phạm giám sát"
                value={violationCandidatesCount > 0 ? `${violationCandidatesCount} nhân viên` : '0 vi phạm'}
                tone={violationCandidatesCount > 0 ? 'failed' : 'passed'}
              />
            </section>

            {/* Filter Section */}
            <section className="ear-filter-card" aria-label="Bộ lọc kết quả nhân viên">
              <div className="ear-filter-card__header">
                <div className="ear-filter-card__title">
                  <FilterOutlined /> <strong>Bộ lọc danh sách nhân viên</strong>
                </div>
                {isFiltered && (
                  <button
                    type="button"
                    className="ear-button ear-button--secondary ear-button--sm"
                    onClick={resetFilters}
                  >
                    <ClearOutlined /> Xóa bộ lọc
                  </button>
                )}
              </div>

              <div className="ear-filter-grid">
                <div className="ear-filter-field ear-filter-field--search">
                  <label htmlFor="ear-filter-search" className="ear-filter-label">Tìm kiếm nhân viên</label>
                  <div className="ear-search-box">
                    <SearchOutlined className="ear-search-icon" />
                    <input
                      id="ear-filter-search"
                      type="text"
                      className="ear-input ear-input--search"
                      placeholder="Tìm theo họ tên hoặc mã nhân viên..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="ear-search-clear-btn"
                        onClick={() => setSearchQuery('')}
                        aria-label="Xóa từ khóa tìm kiếm"
                      >
                        <CloseCircleOutlined />
                      </button>
                    )}
                  </div>
                </div>

                <div className="ear-filter-field">
                  <label htmlFor="ear-filter-dept" className="ear-filter-label">Khoa/phòng</label>
                  <select
                    id="ear-filter-dept"
                    className="ear-select"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                  >
                    <option value="all">Tất cả khoa/phòng ({rows.length})</option>
                    {departmentOptions.map(dept => (
                      <option key={dept.name} value={dept.name}>
                        {dept.name} ({dept.count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ear-filter-field">
                  <label htmlFor="ear-filter-status" className="ear-filter-label">Đánh giá / Kết quả</label>
                  <select
                    id="ear-filter-status"
                    className="ear-select"
                    value={selectedResult}
                    onChange={(e) => setSelectedResult(e.target.value)}
                  >
                    <option value="all">Tất cả kết quả</option>
                    <option value="passed">Đạt</option>
                    <option value="failed">Chưa đạt</option>
                    <option value="not_started">Chưa làm</option>
                    <option value="in_progress">Đang làm</option>
                  </select>
                </div>

                <div className="ear-filter-field">
                  <label htmlFor="ear-filter-violation" className="ear-filter-label">Giám sát vi phạm</label>
                  <select
                    id="ear-filter-violation"
                    className="ear-select"
                    value={selectedViolation}
                    onChange={(e) => setSelectedViolation(e.target.value)}
                  >
                    <option value="all">Tất cả giám sát</option>
                    <option value="has_violation">⚠️ Có vi phạm ({violationCandidatesCount})</option>
                    <option value="clean">✓ Bình thường ({rows.length - violationCandidatesCount})</option>
                  </select>
                </div>
              </div>

              <div className="ear-filter-status-bar">
                <span>
                  Đang hiển thị <strong>{filteredRows.length}</strong> / <strong>{rows.length}</strong> nhân viên
                  {isFiltered && <span className="ear-filter-pill">Đã lọc</span>}
                </span>
                {isFiltered && (
                  <span className="ear-filter-hint">
                    Nút &quot;Xuất Excel&quot; sẽ xuất chính xác {filteredRows.length} nhân viên này.
                  </span>
                )}
              </div>
            </section>

            <section className="ear-section">
              <div className="ear-section__heading">
                <div>
                  <span className="ear-section__eyebrow">DANH SÁCH NHÂN VIÊN</span>
                  <h2>Kết quả theo người làm bài</h2>
                </div>
                <div className="ear-section__heading-right">
                  <span className="ear-section__count">
                    {filteredRows.length} / {rows.length} nhân viên
                  </span>
                  <button
                    type="button"
                    className="ear-button ear-button--primary ear-button--sm"
                    onClick={exportResults}
                    disabled={isLoading || isExporting || filteredRows.length === 0}
                    title={isFiltered ? `Xuất Excel ${filteredRows.length} nhân viên theo bộ lọc` : 'Xuất Excel toàn bộ danh sách'}
                  >
                    {isExporting ? <LoadingOutlined spin /> : <DownloadOutlined />}
                    {isExporting ? 'Đang xuất...' : isFiltered ? `Xuất Excel lọc (${filteredRows.length})` : 'Xuất Excel'}
                  </button>
                </div>
              </div>
              <div className="ear-table-wrap">
                <table className="ear-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Khoa/phòng</th>
                      <th>Lượt làm</th>
                      <th>Điểm cao nhất <small>/10</small></th>
                      <th>Điểm mới nhất <small>/10</small></th>
                      <th>Giám sát</th>
                      <th>Đánh giá</th>
                      <th>Lượt mới nhất</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <EmptyTableRow colSpan={9}>
                        <div className="ear-empty-filter-state">
                          <p>{isFiltered ? 'Không tìm thấy nhân viên nào phù hợp với bộ lọc đã chọn.' : 'Chưa có nhân viên trong đợt giao này.'}</p>
                          {isFiltered && (
                            <button
                              type="button"
                              className="ear-button ear-button--secondary ear-button--sm"
                              onClick={resetFilters}
                            >
                              <ClearOutlined /> Xóa bộ lọc để xem tất cả
                            </button>
                          )}
                        </div>
                      </EmptyTableRow>
                    ) : filteredRows.map((row) => (
                      <tr key={row.userId}>
                        <td>
                          <strong>{row.userName || 'Chưa có tên'}</strong>
                          <small>{row.employeeCode || '—'}</small>
                        </td>
                        <td>{row.departmentName || '—'}</td>
                        <td>{row.attemptCount || 0}</td>
                        <td><strong>{formatScore(row.bestScore)}</strong></td>
                        <td>{formatScore(row.latestScore)}</td>
                        <td>
                          {row.latestTabSwitchCount > 0 ? (
                            <span className="ear-tag ear-tag--warning" title="Phát hiện chụp màn hình hoặc rời tab">
                              ⚠️ {row.latestTabSwitchCount} lần out
                            </span>
                          ) : (
                            <span className="ear-tag ear-tag--clean" title="Không phát hiện rời màn hình">
                              0 lần
                            </span>
                          )}
                        </td>
                        <td><span className={`ear-result-badge ear-result-badge--${resultTone(row.bestPassed)}`}>{resultLabel(row.bestPassed)}</span></td>
                        <td>
                          {row.latestStatus === 'GRADED' || row.latestStatus === 'SUBMITTED' ? (
                            <small>{formatDateTime(row.latestSubmittedAt)}</small>
                          ) : (
                            <span className={`ear-status ear-status--${String(row.latestStatus || 'NOT_STARTED').toLowerCase()}`}>
                              {row.latestStatusText || 'Chưa làm'}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ear-detail-button"
                            disabled={!row.latestAttemptId || row.latestStatus !== 'GRADED'}
                            onClick={() => navigate(`/admin/evaluation/exam-management/assignments/${assignmentId}/results/${row.latestAttemptId}`)}
                          >
                            <EyeOutlined /> Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </>
        ) : null}
      </div>
    </AppShell>
  )
}
