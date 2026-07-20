import { useEffect, useState } from 'react'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import Header from '../components/Header.jsx'
import Sidebar from '../components/sidebar.jsx'
import { trainingApi } from '../../training/api/trainingApi.js'
import '../styles/TrainingStatusScreen.css'

const TARGET_HOURS = 120

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
  const completedHours = configured ? Number(status.submittedHours) || 0 : 0
  const missingHours = Math.max(0, TARGET_HOURS - completedHours)
  const completed = configured && completedHours >= TARGET_HOURS
  const progress = Math.max(0, Math.min(100, completedHours * 100 / TARGET_HOURS))
  const tone = completed ? 'success' : 'danger'

  return (
    <div className="dashboard-layout training-status-page">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Tiến độ giờ đào tạo" />
        <div className="dashboard-layout__body">
          <main className="ts-page">
            <header className="ts-heading">
              <div>
                <span>ĐÀO TẠO CỦA TÔI</span>
                <h1>Tiến độ hoàn thành 120 giờ</h1>
                <p>Dashboard chỉ hiển thị số liệu tổng quan. Hồ sơ chi tiết được quản lý tại màn Giờ đào tạo.</p>
              </div>
              {configured && (
                <strong className={`ts-status ts-status--${tone}`}>
                  {completed ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                  {completed ? 'Đã hoàn thành' : 'Chưa đủ giờ'}
                </strong>
              )}
            </header>

            {loading ? (
              <div className="ts-loading"><LoadingOutlined spin /> Đang tải tiến độ đào tạo...</div>
            ) : error ? (
              <div className="ts-error"><ExclamationCircleOutlined /> {error}</div>
            ) : !configured ? (
              <div className="ts-not-configured" role="status">
                <strong>Backend chưa trả cấu hình giờ đào tạo áp dụng cho tài khoản này.</strong>
                <span>Cần cấu hình yêu cầu đào tạo trước khi hệ thống có thể tính tiến độ 120 giờ.</span>
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
                    <div><p>Mục tiêu</p><strong>{TARGET_HOURS} giờ</strong><small>Chuẩn đào tạo cần hoàn thành</small></div>
                  </article>
                  <article className={`ts-stat-card ts-stat-card--${tone}`}>
                    <span className="ts-stat-card__icon"><ExclamationCircleOutlined /></span>
                    <div><p>Còn thiếu</p><strong>{missingHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ</strong><small>{completed ? 'Bạn đã hoàn thành mục tiêu' : 'Cần tiếp tục bổ sung giờ đào tạo'}</small></div>
                  </article>
                </section>

                <section className={`ts-progress-card ts-progress-card--${tone}`}>
                  <header><div><span>Tiến độ tổng thể</span><strong>{completedHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/{TARGET_HOURS} giờ</strong></div><b>{progress.toFixed(1).replace('.', ',')}%</b></header>
                  <div className="ts-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="120" aria-valuenow={Math.min(TARGET_HOURS, completedHours)}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <p>{completed ? 'Đã đạt yêu cầu 120 giờ đào tạo.' : `Chưa đủ yêu cầu. Bạn còn thiếu ${missingHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ.`}</p>
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
