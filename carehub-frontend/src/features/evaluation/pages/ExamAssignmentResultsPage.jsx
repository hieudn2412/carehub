import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EyeOutlined,
  LoadingOutlined,
  ReloadOutlined,
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

  async function exportResults() {
    setIsExporting(true)
    try {
      const response = await examAssignmentApi.exportAssignmentResults(assignmentId)
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ket-qua-dot-giao-${assignmentId}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
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
            <button type="button" className="ear-button ear-button--primary" onClick={exportResults} disabled={isLoading || isExporting || !results}>
              {isExporting ? <LoadingOutlined spin /> : <DownloadOutlined />} {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
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
            <section className="ear-summary-grid" aria-label="Tổng quan kết quả">
              <SummaryCard label="Tổng nhân viên" value={results.targetCount || 0} />
              <SummaryCard label="Đã hoàn thành" value={completedCount} tone="passed" />
              <SummaryCard label="Điểm trung bình" value={scoreWithScale(results.averageScore)} />
              <SummaryCard label="Điểm cao nhất" value={scoreWithScale(results.bestScore)} tone="highlight" />
            </section>

            <section className="ear-section">
              <div className="ear-section__heading">
                <div>
                  <span className="ear-section__eyebrow">DANH SÁCH NHÂN VIÊN</span>
                  <h2>Kết quả theo người làm bài</h2>
                </div>
                <span className="ear-section__count">{rows.length} nhân viên</span>
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
                      <th>Đánh giá</th>
                      <th>Lượt mới nhất</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? <EmptyTableRow colSpan={8}>Chưa có nhân viên trong đợt giao này.</EmptyTableRow> : rows.map((row) => (
                      <tr key={row.userId}>
                        <td>
                          <strong>{row.userName || 'Chưa có tên'}</strong>
                          <small>{row.employeeCode || '—'}</small>
                        </td>
                        <td>{row.departmentName || '—'}</td>
                        <td>{row.attemptCount || 0}</td>
                        <td><strong>{formatScore(row.bestScore)}</strong></td>
                        <td>{formatScore(row.latestScore)}</td>
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
