import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, BookOutlined, FileDoneOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../training/api/trainingApi.js'
import { competencyApi } from '../../../evaluation/api/examAssignmentApi.js'
import '../../styles/ManagerPages.css'

function ManagerEmployeeDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [training, setTraining] = useState(null)
  const [competency, setCompetency] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const [trainingResult, competencyResult] = await Promise.allSettled([
        trainingApi.getEmployeeTrainingStatus(id),
        competencyApi.getEmployeeClassification(id),
      ])

      if (trainingResult.status === 'fulfilled') {
        setTraining(trainingResult.value.data?.data || null)
      }
      if (competencyResult.status === 'fulfilled') {
        setCompetency(competencyResult.value.data?.data || null)
      }
      if (trainingResult.status === 'rejected' && competencyResult.status === 'rejected') {
        setError('Không thể tải thông tin nhân viên hoặc nhân viên không thuộc khoa của bạn.')
      } else {
        setError('')
      }
      setLoading(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [id])

  const employee = useMemo(() => {
    const status = training?.status
    const statusMap = {
      COMPLIANT: { label: 'Đạt yêu cầu', color: 'green' },
      AT_RISK: { label: 'Đang theo dõi', color: 'amber' },
      NON_COMPLIANT: { label: 'Chưa đạt', color: 'red' },
      NOT_CONFIGURED: { label: 'Chưa thiết lập', color: 'gray' },
    }
    return {
      id,
      code: training?.employeeCode || competency?.employeeCode || `#${id}`,
      name: training?.employeeName || competency?.employeeName || 'Nhân viên',
      dept: competency?.departmentName || '---',
      status: statusMap[status] || { label: 'Chưa có dữ liệu', color: 'gray' },
      hours: training?.submittedHours ?? 0,
      requiredHours: training?.requiredHours ?? 0,
      remainingHours: training?.remainingHours ?? 0,
      progress: training?.progressPercentage ?? 0,
      windowStart: training?.windowStart,
      windowEnd: training?.windowEnd,
      examScore: competency?.overallScore,
      totalAttempts: competency?.totalAttempts ?? 0,
      lastAttemptAt: competency?.lastAttemptAt,
      performance: competency?.overallLevelText || 'Chưa xếp loại',
    }
  }, [id, training, competency])

  const avatar = employee.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN') : '---'

  if (loading || error) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-layout__content">
          <Header title="Chi tiết nhân sự" />
          <div className="dashboard-layout__body" style={{ textAlign: 'center', padding: 80 }}>
            {loading ? (
              <>
                <LoadingOutlined style={{ fontSize: 28, color: '#2563eb' }} />
                <p style={{ color: '#6b7280' }}>Đang tải thông tin nhân viên...</p>
              </>
            ) : (
              <>
                <p style={{ color: '#dc2626', fontWeight: 600 }}>{error}</p>
                <button className="training-button" onClick={() => navigate('/manager/employees')}>
                  <ArrowLeftOutlined /> Quay lại danh sách
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Nhân sự trong khoa', link: '/manager/employees' },
          { label: 'Chi tiết nhân sự' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/manager/employees')}
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết nhân sự</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Thông tin hồ sơ và hoạt động kiểm tra chuyên môn
            </p>
          </div>

          <div className="mgr-card">
            {/* Detail Head */}
            <div className="mgr-detail-header">
              <div className="mgr-avatar">{avatar || 'NV'}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{employee.name}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  {employee.code} · {employee.dept}
                </div>
              </div>
              <span className={`mgr-badge mgr-badge--${employee.status.color}`} style={{ marginLeft: 'auto' }}>
                {employee.status.label}
              </span>
            </div>

            {/* Information Grid */}
            <div className="mgr-kv-grid" style={{ marginBottom: 24 }}>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Mã nhân viên</span>
                <div className="mgr-kv-val">{employee.code}</div>
              </div>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Khoa / Phòng</span>
                <div className="mgr-kv-val">{employee.dept}</div>
              </div>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Chu kỳ đào tạo</span>
                <div className="mgr-kv-val">{formatDate(employee.windowStart)} - {formatDate(employee.windowEnd)}</div>
              </div>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Lần thi gần nhất</span>
                <div className="mgr-kv-val">{formatDate(employee.lastAttemptAt)}</div>
              </div>
            </div>

            {/* Metrics cards inside Detail */}
            <div className="mgr-card-title" style={{ border: 'none', margin: '24px 0 12px', padding: 0 }}>
              Tổng hợp hoạt động
            </div>
            <div className="mgr-dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
              <div className="mgr-metric-card" style={{ cursor: 'default' }}>
                <div className="mgr-metric-label">Giờ đào tạo tích lũy</div>
                <div className="mgr-metric-val" style={{ color: '#d97706' }}>{employee.hours}h</div>
                <div className="mgr-metric-sub">
                  yêu cầu: {employee.requiredHours}h · còn {employee.remainingHours}h
                </div>
              </div>

              <div className="mgr-metric-card" style={{ cursor: 'default' }}>
                <div className="mgr-metric-label">Điểm thi trung bình</div>
                <div className="mgr-metric-val" style={{ color: '#10b981' }}>
                  {employee.examScore == null ? '---' : `${employee.examScore}%`}
                </div>
                <div className="mgr-metric-sub">{employee.totalAttempts} lượt thi đã có điểm</div>
              </div>

              <div className="mgr-metric-card" style={{ cursor: 'default' }}>
                <div className="mgr-metric-label">Xếp loại năng lực</div>
                <div className="mgr-metric-val" style={{ color: '#2563eb', fontSize: 26 }}>{employee.performance}</div>
                <div className="mgr-metric-sub">Đánh giá chu kỳ hiện tại</div>
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <button 
                onClick={() => navigate(`/training/employees/${employee.id}`)}
                className="training-button"
                style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <BookOutlined /> Hồ sơ đào tạo
              </button>
              <button 
                onClick={() => navigate('/manager/exam-results')}
                className="training-button training-button--primary"
                style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <FileDoneOutlined /> Danh sách kết quả thi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEmployeeDetailPage
