import { useState, useEffect } from 'react'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import WelcomeBanner from '../components/WelcomeBanner'
import StatCards from '../components/StatCards'
import UpcomingExams from '../components/UpcomingExams'
import RecentActivities from '../components/RecentActivities'
import { staffApi } from '../api/staffApi'
import { trainingApi } from '../../training/api/trainingApi'
import '../styles/StaffDashBoardScreen.css'

// ── Mock data, xoá khi có API ──────────────────────────────
const MOCK = {
  upcomingExams: [
    { id: 1, title: 'Kỹ năng điều dưỡng cơ bản', startDate: '2026-06-25', dueDate: '2026-06-25' },
    { id: 2, title: 'Kiểm soát nhiễm khuẩn',     startDate: '2026-06-25', dueDate: '2026-06-25' },
    { id: 3, title: 'Cấp cứu cơ bản',             startDate: '2026-06-25', dueDate: '2026-06-25' },
    { id: 4, title: 'Năng lực lâm sàng',          startDate: '2026-06-25', dueDate: '2026-06-25' },
  ],
  activities: [
    { id: 1, type: 'EXAM_COMPLETED',  description: 'Hoàn thành bài thi "Hồi sức tích cực"', timeAgo: '1 phút' },
    { id: 2, type: 'LOGIN',           description: 'Đăng nhập',    timeAgo: '9 phút' },
    { id: 3, type: 'PASSWORD_CHANGE', description: 'Đổi mật khẩu', timeAgo: '1 giờ'  },
    { id: 4, type: 'UPLOAD',          description: 'Upload minh chứng', timeAgo: '5 giờ' },
  ],
}
// ───────────────────────────────────────────────────────────

function DashboardStaffScreen() {
  const { upcomingExams, activities } = MOCK
  const [summary, setSummary] = useState({
    fullName: '',
    pendingExams: 0,
    missingCmeHours: 0,
    cmeHours: 0,
    requiredCmeHours: 0,
    cmeCycleYears: null,
    cmeConfigured: false,
    cmeStatusLoaded: false,
    avgScore: 0,
    totalExamsDone: 0,
  })

  useEffect(() => {
    // 1. Fetch user profile
    staffApi.getProfile()
      .then(res => {
        const profile = res.data?.data
        if (profile) {
          setSummary(prev => ({
            ...prev,
            fullName: profile.fullName,
          }))
        }
      })
      .catch(err => console.error("Error loading dashboard profile", err))

    // 2. Fetch CME compliance status so department scope is respected
    trainingApi.getMyTrainingStatus()
      .then(res => {
        const status = res.data?.data
        if (!status) return
        const configured = status.status !== 'NOT_CONFIGURED'
        setSummary(prev => ({
          ...prev,
          cmeConfigured: configured,
          cmeStatusLoaded: true,
          cmeHours: configured ? (status.submittedHours ?? 0) : 0,
          requiredCmeHours: configured ? (status.requiredHours ?? 0) : 0,
          missingCmeHours: configured ? (status.remainingHours ?? 0) : 0,
          cmeCycleYears: configured ? status.cycleYears : null,
        }))
      })
      .catch(err => {
        console.error("Error loading dashboard CME status", err)
        setSummary(prev => ({ ...prev, cmeStatusLoaded: true }))
      })
  }, [])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Trang chủ" />
        <div className="dashboard-layout__body">
          <div className="dashboard">
            <WelcomeBanner summary={summary} />
            <StatCards summary={summary} />
            <div className="dashboard__bottom">
              <UpcomingExams exams={upcomingExams} />
              <RecentActivities activities={activities} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardStaffScreen
