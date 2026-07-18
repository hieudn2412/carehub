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
  ArrowRightOutlined,
  PieChartOutlined
} from '@ant-design/icons'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
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
    examPassRate: 74,
    qualityCompliance: 81
  })
  const [cmeData, setCmeData] = useState([
    { name: 'Đạt', value: 0, color: '#10b981' },
    { name: 'Đang theo dõi', value: 0, color: '#f59e0b' },
    { name: 'Chưa đạt', value: 0, color: '#ef4444' }
  ])

  const qualityTrendData = [
    { month: 'T1/2026', score: 75 },
    { month: 'T2/2026', score: 78 },
    { month: 'T3/2026', score: 82 },
    { month: 'T4/2026', score: 80 },
    { month: 'T5/2026', score: 85 },
    { month: 'T6/2026', score: 81 }
  ]

  useEffect(() => {
    Promise.all([
      staffApi.getProfile(),
      trainingApi.getEmployeeTrainingStatuses({ size: 1 }),
      trainingApi.getEmployeeTrainingStatuses({ size: 1, complianceStatus: 'NON_COMPLIANT' }),
      trainingApi.getEmployeeTrainingStatuses({ size: 1, complianceStatus: 'AT_RISK' }),
      trainingApi.getEmployeeTrainingStatuses({ size: 1, complianceStatus: 'COMPLIANT' })
    ])
      .then(([profileRes, statusRes, nonCompliantRes, atRiskRes, compliantRes]) => {
        setProfile(profileRes.data?.data)
        const totalEmp = statusRes.data?.data?.totalElements || 0
        const nonComp = nonCompliantRes.data?.data?.totalElements || 0
        const atRisk = atRiskRes.data?.data?.totalElements || 0
        const compliant = compliantRes.data?.data?.totalElements || 0

        setMetrics(current => ({
          ...current,
          totalEmployees: totalEmp
        }))
        setNonCompliantCount(nonComp)

        setCmeData([
          { name: 'Đạt', value: compliant, color: '#10b981' },
          { name: 'Đang theo dõi', value: atRisk, color: '#f59e0b' },
          { name: 'Chưa đạt', value: nonComp, color: '#ef4444' }
        ])
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading manager dashboard metrics", err)
        setLoading(false)
      })
  }, [])

  const actions = [
    { title: 'Nhân sự chưa đạt chuẩn giờ đào tạo', route: '/manager/employees', desc: `${nonCompliantCount} nhân sự chưa đạt chuẩn giờ`, status: 'Xem', color: 'red' },
    { title: 'Kết quả thi chưa đạt', route: '/manager/exam-results', desc: '3 nhân sự cần thi lại', status: 'Xem', color: 'red' },
    { title: 'Chất lượng chăm sóc dưới mục tiêu', route: '/manager/quality/checklists', desc: 'Tiêm truyền TM đạt 88% (mục tiêu 90%)', status: 'Cần chấm', color: 'amber' },
  ]

  const activities = [
    { icon: '✅', text: 'Hệ thống đã đồng bộ danh sách nhân sự thực tế', time: 'Vừa xong' },
    { icon: '📝', text: 'Bài thi KSNK Q2/2026 có 12 lượt làm mới', time: '19/06/2026 08:35' },
    { icon: '⚠️', text: 'Hệ thống tự động theo dõi tiến độ hoàn thành giờ đào tạo', time: 'Hôm nay' },
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
            <div className="mgr-metric-card" style={{ padding: 16 }} onClick={() => navigate('/manager/employees')}>
              <div className="mgr-metric-label" style={{ margin: 0 }}>
                <span style={{ fontSize: 13.5 }}><BarChartOutlined style={{ marginRight: 8, color: '#3b82f6' }} /> Nhân sự & Giờ đào tạo</span>
                <span className="mgr-badge mgr-badge--blue" style={{ fontSize: 11 }}>78% đạt</span>
              </div>
            </div>

            <div className="mgr-metric-card" style={{ padding: 16 }} onClick={() => navigate('/staff/training')}>
              <div className="mgr-metric-label" style={{ margin: 0 }}>
                <span style={{ fontSize: 13.5 }}><ClockCircleOutlined style={{ marginRight: 8, color: '#10b981' }} /> Giờ đào tạo của tôi</span>
                <span className="mgr-badge mgr-badge--green" style={{ fontSize: 11 }}>Cá nhân</span>
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

          {/* Charts Section */}
          <div className="mgr-section-row">
            {/* CME Donut Chart */}
            <div className="mgr-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="mgr-card-title">
                <PieChartOutlined style={{ color: '#10b981' }} /> Phân bổ trạng thái CME nhân sự
              </div>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 220, position: 'relative' }}>
                <ResponsiveContainer height={220} width="100%">
                  <PieChart>
                    <Pie
                      data={cmeData.filter(d => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      cornerRadius={6}
                      stroke="none"
                    >
                      {cmeData.filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} nhân sự`, 'Số lượng']} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quality Trend Bar Chart */}
            <div className="mgr-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="mgr-card-title">
                <LineChartOutlined style={{ color: '#3b82f6' }} /> Tỉ lệ tuân thủ chất lượng (6 tháng gần đây)
              </div>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
                <ResponsiveContainer height={220} width="100%">
                  <BarChart data={qualityTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `${val}%`} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Tỉ lệ tuân thủ']} />
                    <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24}>
                      {qualityTrendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.score >= 85 ? '#10b981' : entry.score >= 80 ? '#3b82f6' : '#f59e0b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Action Row split */}
          <div className="mgr-section-row" style={{ marginTop: 24 }}>
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
