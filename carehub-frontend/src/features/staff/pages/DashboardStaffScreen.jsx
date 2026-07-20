import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/sidebar.jsx'
import Header from '../components/Header.jsx'
import OverviewDashboard from '../../dashboard/components/OverviewDashboard.jsx'
import { staffApi } from '../api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { useDashboard } from '../hooks/useDashboard.js'

const TRAINING_TARGET_HOURS = 120

function unavailable(message) {
  return { total: 0, passed: 0, failed: 0, rate: 0, available: false, emptyMessage: message }
}

export default function DashboardStaffScreen() {
  const navigate = useNavigate()
  const { data: examData, loading: examLoading, error: examError } = useDashboard()
  const [profile, setProfile] = useState(null)
  const [training, setTraining] = useState(unavailable('Chưa cấu hình chuẩn giờ đào tạo cho bạn.'))
  const quality = useMemo(
    () => unavailable('Backend chưa có API kết quả chất lượng cá nhân dành cho User.'),
    [],
  )
  const [loadingPersonal, setLoadingPersonal] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      staffApi.getProfile(),
      trainingApi.getMyTrainingStatus(),
    ]).then(([profileResult, trainingResult]) => {
      if (cancelled) return
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value?.data?.data || null)

      if (trainingResult.status === 'fulfilled') {
        const status = trainingResult.value?.data?.data || {}
        if (status.status !== 'NOT_CONFIGURED') {
          const submitted = Number(status.submittedHours) || 0
          const passed = submitted >= TRAINING_TARGET_HOURS ? 1 : 0
          setTraining({
            total: 1,
            passed,
            failed: passed ? 0 : 1,
            rate: Math.min(100, submitted * 100 / TRAINING_TARGET_HOURS),
            available: true,
            note: `${submitted.toFixed(1).replace('.', ',')} / ${TRAINING_TARGET_HOURS} giờ đã hoàn thành.`,
            path: '/staff/training-status',
          })
        }
      }

      if ([profileResult, trainingResult].every((result) => result.status === 'rejected')) {
        setError('Không thể tải dữ liệu cá nhân. Vui lòng thử lại sau.')
      }
      setLoadingPersonal(false)
    })
    return () => { cancelled = true }
  }, [])

  const examSummary = examData?.summary || {}
  const completedExams = Number(examSummary.totalExamsDone) || 0
  const averageScore = Number(examSummary.avgScore) || 0
  const passedExams = Number(examSummary.passedExams) || 0
  const failedExams = Number(examSummary.failedExams) || 0
  const exams = useMemo(() => completedExams
    ? {
        total: completedExams,
        passed: passedExams,
        failed: failedExams,
        rate: Number(examSummary.examPassRate) || 0,
        available: true,
        note: `Điểm trung bình hiện tại ${averageScore.toFixed(1).replace('.', ',')}.`,
        path: '/staff/exam/history',
      }
    : unavailable('Bạn chưa có kết quả bài kiểm tra nào.'), [averageScore, completedExams, examSummary.examPassRate, failedExams, passedExams])

  const domains = { training, exams, quality }
  const summary = useMemo(() => {
    const available = [training, exams, quality].filter((item) => item.available !== false && item.total > 0)
    const passed = available.filter((item) => item.failed === 0).length
    return {
      total: available.length,
      passed,
      failed: Math.max(0, available.length - passed),
      rate: available.length ? passed * 100 / available.length : 0,
      totalDetail: 'Nhóm năng lực có dữ liệu',
      passedDetail: 'Nhóm đang đạt yêu cầu',
      failedDetail: 'Nhóm cần tiếp tục hoàn thiện',
      rateDetail: 'Tổng quan năng lực cá nhân',
    }
  }, [training, exams, quality])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Năng lực của tôi" />
        <div className="dashboard-layout__body">
          <OverviewDashboard
            role="staff"
            profile={profile}
            loading={loadingPersonal || examLoading}
            error={error || examError || ''}
            filters={{}}
            onNavigate={navigate}
            summary={summary}
            domains={domains}
          />
        </div>
      </div>
    </div>
  )
}
