import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { LoadingOutlined } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { examAssignmentApi } from '../../../../features/evaluation/api/examAssignmentApi'
import { formatNumber } from '../../../../shared/utils/apiUi.js'
import '../../styles/ManagerPages.css'

function ManagerExamResultDetailPage() {
  const { id } = useParams()

  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      examAssignmentApi.getManagerAssignmentResults(id)
        .then((resultsRes) => {
          const data = resultsRes.data?.data || {}
          setResults(Array.isArray(data) ? data : (data.rows || []))
        })
        .catch(err => {
          console.error("Error fetching assignment results", err)
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [id])

  // Chỉ số chính thống nhất với màn hình nhân viên: điểm cao nhất (bestScore/bestPassed).
  const getStatusBadge = (item) => {
    const passed = item.bestPassed ?? item.latestPassed
    if (passed == null) {
      return { label: 'Chưa có kết quả', color: 'gray' }
    }
    return {
      label: passed ? 'Đạt' : 'Chưa đạt',
      color: passed ? 'green' : 'red'
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins} phút ${secs} giây`
  }

  return (
    <AppShell
      back={{ to: '/manager/exam-results', label: 'Quay lại' }}
      breadcrumbs={[
        { label: 'Kết quả thi nhân sự', link: '/manager/exam-results' },
        { label: 'Chi tiết kết quả' }
      ]}
    >
      {loading ? (
        <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
          <LoadingOutlined style={{ fontSize: 24, color: '#6b7280' }} />
          <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải dữ liệu...</p>
        </div>
      ) : (
      <div className="mgr-card mgr-table-wrap" style={{ padding: 0 }}>
        <table className="mgr-table mgr-table--cards">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Điểm cao nhất</th>
              <th>Kết quả</th>
              <th>Thời gian (lượt mới nhất)</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={4} className="ch-empty">
                  Chưa có nhân viên nào làm bài.
                </td>
              </tr>
            ) : (
              results.map((item, idx) => {
                const score = item.bestScore ?? item.latestScore
                const badge = getStatusBadge(item)
                const showLatest = item.latestScore != null
                  && item.bestScore != null
                  && Number(item.latestScore) !== Number(item.bestScore)
                return (
                  <tr key={item.userId ?? item.id ?? idx}>
                    <td data-label="Nhân viên">
                      <div style={{ fontWeight: 500 }}>{item.userName || item.employeeName || item.fullName || '--'}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.employeeCode || item.employeeId || '--'}</div>
                    </td>
                    <td data-label="Điểm cao nhất">
                      <strong style={{
                        color: badge.color === 'green'
                          ? 'var(--mgr-green)'
                          : badge.color === 'red' ? 'var(--mgr-red)' : '#64748b',
                        fontSize: 14
                      }}>
                        {score == null ? '--' : `${formatNumber(score)}/10`}
                      </strong>
                      {showLatest && (
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          Lượt mới nhất: {formatNumber(item.latestScore)}/10
                        </div>
                      )}
                    </td>
                    <td data-label="Kết quả">
                      <span className={`mgr-badge mgr-badge--${badge.color}`}>{badge.label}</span>
                    </td>
                    <td data-label="Thời gian (lượt mới nhất)" style={{ color: '#475569' }}>
                      {formatDuration(item.latestTimeSpentSeconds || item.duration || item.durationSeconds)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      )}
    </AppShell>
  )
}

export default ManagerExamResultDetailPage
