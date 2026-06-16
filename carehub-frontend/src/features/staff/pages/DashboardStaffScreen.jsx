import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import WelcomeBanner from '../components/WelcomeBanner'
import StatCards from '../components/StatCards'
import UpcomingExams from '../components/UpcomingExams'
import RecentActivities from '../components/RecentActivities'
import '../styles/StaffDashBoardScreen.css'

// ── Mock data, xoá khi có API ──────────────────────────────
const MOCK = {
  summary: {
    fullName: 'Phạm Quốc Bảo',
    pendingExams: 1,
    missingCmeHours: 22,
    cmeHours: 98,
    avgScore: 99,
    totalExamsDone: 5,
  },
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
  const { summary, upcomingExams, activities } = MOCK

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Trang chủ" userName={summary.fullName} roleName="Nhân viên" />
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