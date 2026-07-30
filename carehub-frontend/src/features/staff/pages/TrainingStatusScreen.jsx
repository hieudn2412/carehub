import { useEffect, useState } from 'react'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import { trainingApi } from '../../training/api/trainingApi.js'
import '../styles/TrainingStatusScreen.css'

export default function TrainingStatusScreen() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    trainingApi.getMyTrainingStatus()
      .then((response) => {
        if (!cancelled) setStatus(response?.data?.data || null)
      })
      .catch(() => {
        if (!cancelled) setError('Không thể tải tiến độ giờ đào tạo cá nhân từ máy chủ.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const configured = status && status.status !== 'NOT_CONFIGURED'
  const requiredHours = configured ? Number(status.requiredHours) || 0 : 0
  const completedHours = configured ? Number(status.submittedHours) || 0 : 0
  const missingHours = configured
    ? Number(status.remainingHours) || Math.max(0, requiredHours - completedHours)
    : 0
  const completed = configured && status.status === 'COMPLIANT'
  const progress = configured
    ? Math.max(0, Math.min(100, Number(status.progressPercentage) || 0))
    : 0
  const tone = completed ? 'success' : 'danger'
  const formattedRequiredHours = requiredHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

  return (
    <AppShell title="Tiến độ giờ đào tạo">
      <div className="ts-page">
        {loading ? (
          <LoadingState label="Đang tải tiến độ đào tạo..." />
        ) : error ? (
          <div className="ts-error"><ExclamationCircleOutlined /> {error}</div>
        ) : !configured ? (
          <div className="ts-not-configured" role="status">
            <strong>Chưa có chuẩn giờ đào tạo áp dụng cho bạn.</strong>
            <span>Vui lòng liên hệ quản trị viên để kiểm tra cấu hình yêu cầu đào tạo.</span>
          </div>
        ) : (
          <>
            <section className="ts-stat-cards">
              <article className={`ts-stat-card ts-stat-card--${tone}`}>
                <span className="ts-stat-card__icon"><ClockCircleOutlined /></span>
                <div><p>Đã hoàn thành</p><strong>{completedHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ</strong><small>Thời lượng đã được hệ thống ghi nhận</small></div>
              </article>
              <article className="ts-stat-card ts-stat-card--neutral">
                <span className="ts-stat-card__icon"><CheckCircleOutlined /></span>
                <div><p>Mục tiêu</p><strong>{formattedRequiredHours} giờ</strong><small>Chuẩn đào tạo đang áp dụng</small></div>
              </article>
              <article className={`ts-stat-card ts-stat-card--${tone}`}>
                <span className="ts-stat-card__icon"><ExclamationCircleOutlined /></span>
                <div><p>Còn thiếu</p><strong>{missingHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ</strong><small>{completed ? 'Bạn đã hoàn thành mục tiêu' : 'Cần tiếp tục bổ sung giờ đào tạo'}</small></div>
              </article>
            </section>

            <section className={`ts-progress-card ts-progress-card--${tone}`}>
              <header>
                <div><span>Tiến độ tổng thể</span><strong>{completedHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/{formattedRequiredHours} giờ</strong></div>
                <div className="ts-progress-card__status">
                  <strong className={`ts-status ts-status--${tone}`}>
                    {completed ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                    {completed ? 'Đã hoàn thành' : 'Chưa đủ giờ'}
                  </strong>
                  <b>{progress.toFixed(1).replace('.', ',')}%</b>
                </div>
              </header>
              <div className="ts-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>{completed ? `Đã đạt yêu cầu ${formattedRequiredHours} giờ đào tạo.` : `Chưa đủ yêu cầu. Bạn còn thiếu ${missingHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ.`}</p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
