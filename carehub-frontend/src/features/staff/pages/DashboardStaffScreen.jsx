import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import OverviewDashboard from '../../dashboard/components/OverviewDashboard.jsx'
import { staffApi } from '../api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { useDashboard } from '../hooks/useDashboard.js'

function unavailable(message) {
  return { total: 0, passed: 0, failed: 0, rate: 0, available: false, emptyMessage: message }
}

export default function DashboardStaffScreen() {
  const navigate = useNavigate()
  const { data: examData, loading: examLoading, error: examError } = useDashboard()
  const [profile, setProfile] = useState(null)
  const [training, setTraining] = useState(unavailable('Chưa cấu hình chuẩn giờ đào tạo cho bạn.'))
  const [quality, setQuality] = useState(unavailable('Bạn chưa có kết quả đánh giá checklist nào trong 30 ngày gần đây.'))
  const [loadingPersonal, setLoadingPersonal] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      staffApi.getProfile(),
      trainingApi.getMyTrainingStatus(),
      staffApi.getMyDashboardFormSummary(),
    ]).then(([profileResult, trainingResult, qualityResult]) => {
      if (cancelled) return
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value?.data?.data || null)

      if (trainingResult.status === 'fulfilled') {
        const status = trainingResult.value?.data?.data || {}
        if (status.status !== 'NOT_CONFIGURED') {
          const submitted = Number(status.submittedHours) || 0
          const required = Number(status.requiredHours) || 0
          const passed = status.status === 'COMPLIANT' ? 1 : 0
          setTraining({
            total: 1,
            passed,
            failed: passed ? 0 : 1,
            rate: Number(status.progressPercentage) || 0,
            available: true,
            note: `${submitted.toFixed(1).replace('.', ',')} / ${required.toFixed(1).replace('.', ',')} giờ đã hoàn thành.`,
            path: '/staff/training-status',
          })
        }
      }

      if (qualityResult.status === 'fulfilled') {
        const summary = qualityResult.value?.data?.data || {}
        const total = Number(summary.submittedCount) || 0
        const passed = Number(summary.passedCount) || 0
        const failed = (Number(summary.failedScoreCount) || 0)
          + (Number(summary.failedCriticalCount) || 0)
        if (total > 0) {
          setQuality({
            total,
            passed,
            failed,
            rate: Number(summary.passRate) || 0,
            available: true,
            note: `${Number(summary.formCount) || 0} quy trình · Điểm trung bình ${Number(summary.averageConvertedScore || 0).toFixed(2).replace('.', ',')}.`,
          })
        }
      }

      if ([profileResult, trainingResult, qualityResult].every((result) => result.status === 'rejected')) {
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
        note: `Điểm trung bình hiện tại ${averageScore.toFixed(1).replace('.', ',')}/10.`,
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
    <AppShell title="Năng lực của tôi">
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
    </AppShell>
  )
}
