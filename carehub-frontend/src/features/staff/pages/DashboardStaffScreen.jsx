import { useState, useEffect } from 'react'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import WelcomeBanner from '../components/WelcomeBanner'
import StatCards from '../components/StatCards'
import UpcomingExams from '../components/UpcomingExams'
import RecentActivities from '../components/RecentActivities'
import { staffApi } from '../api/staffApi'
import { trainingApi } from '../../training/api/trainingApi'
import { useDashboard } from '../hooks/useDashboard'
import '../styles/StaffDashBoardScreen.css'

function DashboardStaffScreen() {
  const { data: dashboardData, loading: dashboardLoading } = useDashboard()
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

  // Merge dashboard hook data into summary
  useEffect(() => {
    if (dashboardData?.summary) {
      setSummary(prev => ({
        ...prev,
        pendingExams: dashboardData.summary.pendingExams ?? 0,
        avgScore: dashboardData.summary.avgScore ?? 0,
        totalExamsDone: dashboardData.summary.totalExamsDone ?? 0,
      }))
    }
  }, [dashboardData])

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

    // 2. Fetch training compliance status so department scope is respected
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
        console.error("Error loading dashboard training status", err)
        setSummary(prev => ({ ...prev, cmeStatusLoaded: true }))
      })
  }, [])

  const upcomingExams = dashboardData?.upcomingExams || []
  const activities = dashboardData?.activities || []

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
              {dashboardLoading ? (
                <>
                  <div className="dashboard-panel"><h3>Đang tải...</h3></div>
                  <div className="dashboard-panel"><h3>Đang tải...</h3></div>
                </>
              ) : (
                <>
                  <UpcomingExams exams={upcomingExams} />
                  <RecentActivities activities={activities} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardStaffScreen
