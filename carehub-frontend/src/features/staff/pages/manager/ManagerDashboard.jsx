import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  LineChartOutlined,
  BellOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { staffApi } from '../../api/staffApi.js'
import { trainingApi } from '../../../training/api/trainingApi'
import '../../styles/ManagerPages.css'

function ManagerDashboard() {
  const navigate = useNavigate()
  
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nonCompliantCount, setNonCompliantCount] = useState(0)
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    pendingEvidences: 0,
    examPassRate: 74,
    qualityCompliance: 81
  })

  useEffect(() => {
    Promise.all([
      staffApi.getProfile(),
      trainingApi.getEmployeeTrainingStatuses({ size: 1 }),
      trainingApi.getEmployeeTrainingStatuses({ size: 1, complianceStatus: 'NON_COMPLIANT' }),
      trainingApi.getPendingRecords({ size: 1 })
    ])
      .then(([profileRes, statusRes, nonCompliantRes, pendingRes]) => {
        setProfile(profileRes.data?.data)
        const totalEmp = statusRes.data?.data?.totalElements || 0
        const nonComp = nonCompliantRes.data?.data?.totalElements || 0
        const pendingEv = pendingRes.data?.data?.totalElements || 0

        setMetrics(current => ({
          ...current,
          totalEmployees: totalEmp,
          pendingEvidences: pendingEv
        }))
        setNonCompliantCount(nonComp)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading manager dashboard metrics", err)
        setLoading(false)
      })
  }, [])

  const actions = [
    { title: 'Minh chứng chờ duyệt', route: '/manager/evidence-review', desc: `${metrics.pendingEvidences} minh chứng đang chờ phê duyệt`, status: 'Cần duyệt', color: 'amber' },
    { title: 'Nhân sự chưa đạt chuẩn giờ đào tạo', route: '/training/employees', desc: `${nonCompliantCount} nhân sự chưa đạt chuẩn giờ`, status: 'Xem', color: 'red' },
    { title: 'Kết quả thi chưa đạt', route: '/manager/exam-results', desc: '3 nhân sự cần thi lại', status: 'Xem', color: 'red' },
    { title: 'Chất lượng chăm sóc dưới mục tiêu', route: '/manager/quality/checklists', desc: 'Tiêm truyền TM đạt 88% (mục tiêu 90%)', status: 'Cần chấm', color: 'amber' },
  ]

  const activities = [
    { icon: '✅', text: 'Hệ thống đã đồng bộ danh sách nhân sự thực tế', time: 'Vừa xong' },
    { icon: '📝', text: 'Bài thi KSNK Q2/2026 có 12 lượt làm mới', time: '19/06/2026 08:35' },
    { icon: '⚠️', text: 'Hệ thống tự động theo dõi tiến độ hoàn thành CME', time: 'Hôm nay' },
    { icon: '✔', text: 'Lịch sử chấm điểm chất lượng tự động cập nhật', time: 'Hôm nay' },
  ]

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Dashboard Trưởng khoa" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Dashboard Tổng quan</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Xin chào, Trưởng khoa {profile?.fullName || 'Nguyễn Thị Mai'} · {profile?.departmentName || 'Khoa Nội tổng hợp'}
            </p>
          </div>

          {/* Metric Grid */}
          <div className="mgr-dashboard-grid">
            <div className="mgr-metric-card" onClick={() => navigate('/manager/employees')}>
              <div className="mgr-metric-label">
                <span>Nhân sự trong khoa</span>
                <UserOutlined style={{ color: '#64748b' }} />
              </div>
              <div className="mgr-metric-val">{metrics.totalEmployees}</div>
              <div className="mgr-metric-sub">
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{nonCompliantCount}</span> chưa đạt chuẩn giờ
              </div>
            </div>

            <div className="mgr-metric-card" onClick={() => navigate('/manager/evidence-review')}>
              <div className="mgr-metric-label">
                <span>Minh chứng chờ duyệt</span>
                <ClockCircleOutlined style={{ color: '#f59e0b' }} />
              </div>
              <div className="mgr-metric-val" style={{ color: '#d97706' }}>{metrics.pendingEvidences}</div>
              <div className="mgr-metric-sub">cần xem xét phê duyệt</div>
            </div>

            <div className="mgr-metric-card" onClick={() => navigate('/manager/exam-results')}>
              <div className="mgr-metric-label">
                <span>Kết quả thi tháng 6</span>
                <CheckCircleOutlined style={{ color: '#10b981' }} />
              </div>
              <div className="mgr-metric-val" style={{ color: '#10b981' }}>{metrics.examPassRate}%</div>
              <div className="mgr-metric-sub">đạt / 28 lượt thi</div>
            </div>

            <div className="mgr-metric-card" onClick={() => navigate('/manager/quality/checklists')}>
              <div className="mgr-metric-label">
                <span>Chất lượng chăm sóc</span>
                <DashboardOutlined style={{ color: '#f59e0b' }} />
              </div>
              <div className="mgr-metric-val" style={{ color: '#d97706' }}>{metrics.qualityCompliance}%</div>
              <div className="mgr-metric-sub">Mục tiêu: 85%</div>
            </div>
          </div>

          {/* Navigation Dashboards Grid */}
          <div className="mgr-dashboard-grid" style={{ marginBottom: 24 }}>
            <div className="mgr-metric-card" style={{ padding: 16 }} onClick={() => navigate('/manager/reports/training')}>
              <div className="mgr-metric-label" style={{ margin: 0 }}>
                <span style={{ fontSize: 13.5 }}><BarChartOutlined style={{ marginRight: 8, color: '#3b82f6' }} /> Dashboard Đào tạo</span>
                <span className="mgr-badge mgr-badge--blue" style={{ fontSize: 11 }}>78% đạt</span>
              </div>
            </div>

            <div className="mgr-metric-card" style={{ padding: 16 }} onClick={() => navigate('/manager/reports/exam')}>
              <div className="mgr-metric-label" style={{ margin: 0 }}>
                <span style={{ fontSize: 13.5 }}><LineChartOutlined style={{ marginRight: 8, color: '#10b981' }} /> Dashboard Năng lực</span>
                <span className="mgr-badge mgr-badge--green" style={{ fontSize: 11 }}>72% TB</span>
              </div>
            </div>

            <div className="mgr-metric-card" style={{ padding: 16 }} onClick={() => navigate('/manager/reports/quality')}>
              <div className="mgr-metric-label" style={{ margin: 0 }}>
                <span style={{ fontSize: 13.5 }}><DashboardOutlined style={{ marginRight: 8, color: '#f59e0b' }} /> Dashboard Chất lượng</span>
                <span className="mgr-badge mgr-badge--amber" style={{ fontSize: 11 }}>3 cảnh báo</span>
              </div>
            </div>

            <div className="mgr-metric-card" style={{ padding: 16 }} onClick={() => navigate('/staff/notifications')}>
              <div className="mgr-metric-label" style={{ margin: 0 }}>
                <span style={{ fontSize: 13.5 }}><BellOutlined style={{ marginRight: 8, color: '#ef4444' }} /> Thông báo hệ thống</span>
                <span className="mgr-badge mgr-badge--red" style={{ fontSize: 11 }}>4 mới</span>
              </div>
            </div>
          </div>

          {/* Action Row split */}
          <div className="mgr-section-row">
            {/* Needs Action */}
            <div className="mgr-card" style={{ margin: 0 }}>
              <div className="mgr-card-title">
                <ExclamationCircleOutlined style={{ color: '#ef4444' }} /> Cần xử lý gấp
              </div>
              <div>
                {actions.map((act, index) => (
                  <div key={index} className="mgr-action-item" onClick={() => navigate(act.route)}>
                    <div>
                      <div className="mgr-action-title">{act.title}</div>
                      <div className="mgr-action-desc">{act.desc}</div>
                    </div>
                    <span className={`mgr-badge mgr-badge--${act.color}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {act.status} <ArrowRightOutlined style={{ fontSize: 10 }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mgr-card" style={{ margin: 0 }}>
              <div className="mgr-card-title">
                <ClockCircleOutlined style={{ color: '#3b82f6' }} /> Hoạt động gần đây
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {activities.map((act, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                      <span>{act.icon}</span>
                      <span style={{ color: '#334155', lineHeight: 1.4 }}>{act.text}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 12 }}>{act.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerDashboard
