import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { examAssignmentApi } from '../../../../features/evaluation/api/examAssignmentApi'
import '../../styles/ManagerPages.css'

function ManagerExamResultDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

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

  const getStatusBadge = (score, passThreshold = 50) => {
    const passed = score >= passThreshold
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
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Kết quả thi nhân sự', link: '/manager/exam-results' },
          { label: 'Chi tiết kết quả' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/manager/exam-results')}
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                padding: '4px 0',
                marginBottom: 8
              }}
            >
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>
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
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Điểm</th>
                  <th>Kết quả</th>
                  <th>Thời gian</th>
                  <th>Phân loại năng lực</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
                      Chưa có nhân viên nào làm bài.
                    </td>
                  </tr>
                ) : (
                  results.map((item, idx) => {
                    const score = item.latestScore ?? item.bestScore ?? 0
                    const badge = getStatusBadge(score)
                    return (
                      <tr key={item.id || idx}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.userName || item.employeeName || item.fullName || '--'}</div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.employeeCode || item.employeeId || '--'}</div>
                        </td>
                        <td>
                          <strong style={{ 
                            color: badge.color === 'green' ? 'var(--mgr-green)' : 'var(--mgr-red)',
                            fontSize: 14
                          }}>
                            {score}%
                          </strong>
                        </td>
                        <td>
                          <span className={`mgr-badge mgr-badge--${badge.color}`}>{badge.label}</span>
                        </td>
                        <td style={{ color: '#475569' }}>
                          {formatDuration(item.latestTimeSpentSeconds || item.duration || item.durationSeconds)}
                        </td>
                        <td>
                          {item.competencyLevel ? (
                            <span className={`mgr-badge mgr-badge--${item.competencyLevel === 'NOT_COMPETENT' ? 'red' : item.competencyLevel === 'BEGINNER' || item.competencyLevel === 'BASIC' ? 'amber' : 'green'}`}>
                              {item.competencyLevel === 'NOT_COMPETENT' ? 'Chưa đạt' :
                               item.competencyLevel === 'BEGINNER' ? 'Sơ cấp' :
                               item.competencyLevel === 'BASIC' ? 'Cơ bản' :
                               item.competencyLevel === 'PROFICIENT' ? 'Thành thạo' :
                               item.competencyLevel === 'ADVANCED' ? 'Chuyên sâu' : item.competencyLevel}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>--</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManagerExamResultDetailPage
