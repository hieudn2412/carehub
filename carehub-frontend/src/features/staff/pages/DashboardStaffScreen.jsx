import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
// logo-mark.png là logo đã cắt sát viền: logo.png gốc có ~35% lề trong suốt nên khi đặt
// width 100% vẫn nhỏ hơn hẳn vòng tròn trắng phía sau.
import logo from '../../../assets/logo-mark.png'
import { myCompetencyApi } from '../../evaluation/api/myCompetencyApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { staffApi } from '../api/staffApi.js'
import './DashboardStaffScreen.css'

void React

const SCORE_FORMATTER = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const DEFAULT_COMPETENCY_TARGET_SCORE = 6

function localDate(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

function yearToDate() {
  return {
    fromDate: `${new Date().getFullYear()}-01-01`,
    toDate: localDate(),
  }
}

function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function formatScore(value) {
  return SCORE_FORMATTER.format(number(value))
}

function formatHours(value) {
  const hours = number(value)
  return Number.isInteger(hours)
    ? String(hours)
    : SCORE_FORMATTER.format(hours)
}

function clampPercentage(value) {
  return Math.min(100, Math.max(0, number(value)))
}

function DashboardMetricCard({
  accent,
  title,
  icon,
  primary,
  secondary,
  description,
  progress,
  onClick,
}) {
  const content = (
    <>
      <div>
        <div className="staff-home-metric__heading">
          <span className="staff-home-metric__icon" aria-hidden="true">{icon}</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>
      <div className="staff-home-metric__values">
        {progress != null && (
          <span
            className="staff-home-metric__mobile-ring"
            style={{ '--metric-progress': `${clampPercentage(progress) * 3.6}deg` }}
            role="img"
            aria-label={`Tiến độ ${Math.round(clampPercentage(progress))}%`}
          >
            <strong>{primary}</strong>
          </span>
        )}
        <strong className="staff-home-metric__primary">{primary}</strong>
        <span>{secondary}</span>
      </div>
      {progress != null && (
        <div className="staff-home-metric__progress" aria-label={`Tiến độ ${Math.round(progress)}%`}>
          <span style={{ width: `${clampPercentage(progress)}%` }} />
        </div>
      )}
    </>
  )

  return onClick ? (
    <button
      type="button"
      className={`staff-home-metric staff-home-metric--${accent}`}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <article className={`staff-home-metric staff-home-metric--${accent}`}>{content}</article>
  )
}

export default function DashboardStaffScreen() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [training, setTraining] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [competency, setCompetency] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const period = yearToDate()

    Promise.allSettled([
      staffApi.getProfile(),
      trainingApi.getMyTrainingStatus(),
      staffApi.getMyDashboardFormSummary(period),
      myCompetencyApi.getSummary(period),
    ]).then(([profileResult, trainingResult, complianceResult, competencyResult]) => {
      if (cancelled) return

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value?.data?.data || null)
      }
      if (trainingResult.status === 'fulfilled') {
        setTraining(trainingResult.value?.data?.data || null)
      }
      if (complianceResult.status === 'fulfilled') {
        setCompliance(complianceResult.value?.data?.data || null)
      }
      if (competencyResult.status === 'fulfilled') {
        setCompetency(competencyResult.value?.data?.data || null)
      }

      const results = [profileResult, trainingResult, complianceResult, competencyResult]
      if (results.every(result => result.status === 'rejected')) {
        setError('Không thể tải dữ liệu dashboard cá nhân. Vui lòng thử lại sau.')
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const metrics = useMemo(() => {
    const submittedHours = number(training?.submittedHours)
    const requiredHours = number(training?.requiredHours)
    const trainingProgress = requiredHours > 0
      ? submittedHours * 100 / requiredHours
      : number(training?.progressPercentage)
    const complianceCount = number(compliance?.submittedCount)
    const compliancePercentage = clampPercentage(number(compliance?.averageConvertedScore) * 10)
    const knowledgeCount = number(competency?.knowledgeAttemptCount)
    const skillCount = number(competency?.skillEvaluationCount)

    return {
      submittedHours,
      requiredHours,
      trainingProgress,
      complianceCount,
      compliancePercentage,
      knowledgeCount,
      knowledgeAverage: number(competency?.knowledgeAverage),
      skillCount,
      skillAverage: number(competency?.skillAverage),
      overallScore: number(competency?.overallScore),
      targetScore: competency?.targetScore == null
        ? DEFAULT_COMPETENCY_TARGET_SCORE
        : number(competency.targetScore),
    }
  }, [compliance, competency, training])

  const competencyPassed = competency?.targetScore == null
    ? metrics.overallScore >= metrics.targetScore
    : Boolean(competency?.isPassed)
  const competencyStatus = competencyPassed ? 'Đạt' : 'Chưa đạt'

  return (
    <AppShell title="Dashboard tổng quan" className="staff-home-shell">
      <div className="staff-home-dashboard" aria-busy={loading}>
        {error && <div className="staff-home-dashboard__error" role="alert">{error}</div>}

        <section className="staff-home-profile" aria-label="Thông tin nhân viên">
          <div className="staff-home-profile__logo">
            <img src={logo} alt="VietDuc Care" />
          </div>
          <div className="staff-home-profile__content">
            <span>Bệnh viện Hữu nghị Việt Đức</span>
            <h1>{loading ? 'Đang tải thông tin...' : profile?.fullName || 'Nhân viên'}</h1>
            <div className="staff-home-profile__meta">
              <span>{profile?.employeeCode || 'Chưa có mã nhân viên'}</span>
              {profile?.departmentName && <span>{profile.departmentName}</span>}
            </div>
          </div>
        </section>

        <section className="staff-home-dashboard__grid" aria-label="Chỉ số năng lực cá nhân">
          <DashboardMetricCard
            accent="training"
            title="Đào tạo liên tục"
            icon={<ClockCircleOutlined />}
            primary={`${Math.round(clampPercentage(metrics.trainingProgress))}%`}
            secondary={`${formatHours(metrics.submittedHours)}/${formatHours(metrics.requiredHours)}h`}
            description={training?.status === 'NOT_CONFIGURED'
              ? 'Chưa cấu hình chuẩn giờ đào tạo'
              : 'Tiến độ giờ đào tạo liên tục'}
            progress={metrics.trainingProgress}
            onClick={() => navigate('/staff/training')}
          />

          <DashboardMetricCard
            accent="compliance"
            title="Giám sát tuân thủ"
            icon={<SafetyCertificateOutlined />}
            primary={metrics.complianceCount}
            secondary={`${formatScore(metrics.compliancePercentage)}%`}
            description="Lượt được chấm · Điểm tuân thủ trung bình"
            onClick={() => navigate('/staff/competency')}
          />

          <DashboardMetricCard
            accent="knowledge"
            title="Kiến thức"
            icon={<BookOutlined />}
            primary={metrics.knowledgeCount}
            secondary={`${formatScore(metrics.knowledgeAverage)}/10`}
            description="Lượt làm bài · Điểm kiến thức trung bình"
            onClick={() => navigate('/staff/professional-competency')}
          />

          <DashboardMetricCard
            accent="skill"
            title="Kỹ năng"
            icon={<CheckCircleFilled />}
            primary={metrics.skillCount}
            secondary={`${formatScore(metrics.skillAverage)}/10`}
            description="Lượt được chấm · Điểm kỹ năng trung bình"
            onClick={() => navigate('/staff/competency')}
          />
        </section>

        <section
          className={`staff-home-overall staff-home-overall--${
            competencyPassed ? 'passed' : 'failed'
          }`}
          aria-label="Kết quả năng lực chuyên môn"
        >
          <span className="staff-home-overall__icon" aria-hidden="true"><TrophyOutlined /></span>
          <div className="staff-home-overall__content">
            <span>Năng lực chuyên môn</span>
            <strong>{formatScore(metrics.overallScore)}<small>/10</small></strong>
            <p>Trung bình điểm Kiến thức và Kỹ năng</p>
          </div>
          <div className="staff-home-overall__status">
            {competencyPassed
              ? <CheckCircleFilled aria-hidden="true" />
              : <CloseCircleFilled aria-hidden="true" />}
            <strong>{competencyStatus}</strong>
            <span>Điểm sàn {formatScore(metrics.targetScore)}/10</span>
          </div>
        </section>

        <footer className="staff-home-footer">
          &copy; {new Date().getFullYear()} Hệ thống quản lý điều dưỡng - VietDuc Care
        </footer>
      </div>
    </AppShell>
  )
}
