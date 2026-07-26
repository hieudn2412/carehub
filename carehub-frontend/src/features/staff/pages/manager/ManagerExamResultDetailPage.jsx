import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { LoadingOutlined } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { examAssignmentApi } from '../../../../features/evaluation/api/examAssignmentApi'
import { formatNumber } from '../../../../features/evaluation/utils/documentQuestionUi.js'
import '../../styles/ManagerPages.css'

function ManagerExamResultDetailPage() {
  const { id } = useParams()

  const [assignment, setAssignment] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      Promise.all([
        examAssignmentApi.getManagerAssignment(id),
        examAssignmentApi.getManagerAssignmentResults(id)
      ])
        .then(([assignmentRes, resultsRes]) => {
          setAssignment(assignmentRes.data?.data || null)
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

  const getStatusBadge = (item) => {
    const passed = item.latestPassed ?? item.bestPassed
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết kết quả kỳ thi</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          {assignment?.name || `Kỳ thi #${id}`}
          {assignment?.professionalFieldName ? ` · ${assignment.professionalFieldName}` : ''}
        </p>
      </div>

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
              <th>Điểm</th>
              <th>Kết quả</th>
              <th>Thời gian</th>
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
                const score = item.latestScore ?? item.bestScore
                const badge = getStatusBadge(item)
                return (
                  <tr key={item.id || idx}>
                    <td data-label="Nhân viên">
                      <div style={{ fontWeight: 500 }}>{item.userName || item.employeeName || item.fullName || '--'}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.employeeCode || item.employeeId || '--'}</div>
                    </td>
                    <td data-label="Điểm">
                      <strong style={{
                        color: badge.color === 'green' ? 'var(--mgr-green)' : 'var(--mgr-red)',
                        fontSize: 14
                      }}>
                        {score == null ? '--' : `${formatNumber(score)}/10`}
                      </strong>
                    </td>
                    <td data-label="Kết quả">
                      <span className={`mgr-badge mgr-badge--${badge.color}`}>{badge.label}</span>
                    </td>
                    <td data-label="Thời gian" style={{ color: '#475569' }}>
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
