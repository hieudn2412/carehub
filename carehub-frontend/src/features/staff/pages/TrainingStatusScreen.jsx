import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/sidebar'
import { trainingApi } from '../../training/api/trainingApi'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import '../styles/TrainingStatusScreen.css'

function TrainingStatusScreen() {
  const [summary, setSummary] = useState({
    totalHours: 0,
    requiredHours: 120,
    remainingHours: 120,
    completionPercent: 0,
  })

  const [yearsData, setYearsData] = useState([
    { year: 2022, hours: 0, target: 24, passed: false },
    { year: 2023, hours: 0, target: 24, passed: false },
    { year: 2024, hours: 0, target: 24, passed: false },
    { year: 2025, hours: 0, target: 24, passed: false },
    { year: 2026, hours: 0, target: 24, passed: false },
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trainingApi.listRecords({ size: 1000, workflowStatus: 'APPROVED', keyword: '%' })
      .then(res => {
        const content = res.data?.data?.content || []
        const total = content.reduce((sum, r) => sum + (r.approvedHours || 0), 0)
        const missing = Math.max(0, 120 - total)
        const pct = Math.min(Math.round((total / 120) * 100), 100)

        setSummary({
          totalHours: total,
          requiredHours: 120,
          remainingHours: missing,
          completionPercent: pct,
        })

        // Group by year (2022 to 2026)
        const yearMap = { 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 }
        content.forEach(r => {
          if (r.startDate) {
            const y = r.startDate.substring(0, 4)
            if (yearMap[y] !== undefined) {
              yearMap[y] += (r.approvedHours || 0)
            }
          }
        })

        // Target hours mapped to match mock goals for visual authenticity:
        // 2022: 28h, 2023: 30h, 2024: 30h, 2025: 30h, 2026: 30h
        const yearlyTargets = { 2022: 28, 2023: 30, 2024: 30, 2025: 30, 2026: 30 }

        const updatedYears = Object.keys(yearMap).map(y => {
          const yr = parseInt(y)
          const hrs = yearMap[y]
          const target = yearlyTargets[yr] || 30
          return {
            year: yr,
            hours: hrs,
            target: target,
            passed: hrs >= target,
          }
        }).sort((a, b) => a.year - b.year)

        setYearsData(updatedYears)
      })
      .catch(err => {
        console.error("Lỗi khi tải trạng thái đào tạo:", err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Trạng thái đào tạo" />
        <div className="ts-page">
          <p className="ts-page__title">Trạng thái đào tạo</p>
          <p className="ts-page__sub">Tổng quan về việc tuân thủ CME · Chu kỳ 5 năm</p>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
              Đang tải thông tin...
            </div>
          ) : (
            <>
              <div className="ts-stat-cards">
                {/* Thẻ 1: Đỏ */}
                <div className="ts-stat-card ts-stat-card--red">
                  <span className="ts-stat-card__icon ts-stat-card__icon--red">
                    <ClockCircleOutlined />
                  </span>
                  <div>
                    <p className="ts-stat-card__label ts-stat-card__label--red">Tổng số giờ</p>
                    <p className="ts-stat-card__value">
                      {summary.totalHours} <span>/ {summary.requiredHours}h</span>
                    </p>
                    <p className="ts-stat-card__note ts-stat-card__note--red">
                      {summary.remainingHours > 0 ? 'Chưa đạt yêu cầu' : 'Đã đạt yêu cầu'}
                    </p>
                  </div>
                </div>

                {/* Thẻ 2: Vàng */}
                <div className="ts-stat-card ts-stat-card--amber">
                  <span className="ts-stat-card__icon ts-stat-card__icon--amber">
                    <ClockCircleOutlined />
                  </span>
                  <div>
                    <p className="ts-stat-card__label ts-stat-card__label--amber">Số giờ còn lại</p>
                    <p className="ts-stat-card__value">{summary.remainingHours}h</p>
                    <p className="ts-stat-card__note ts-stat-card__note--amber">
                      {summary.remainingHours > 0 ? 'Để đạt yêu cầu' : 'Đã đủ số giờ'}
                    </p>
                  </div>
                </div>

                {/* Thẻ 3: Xanh lá */}
                <div className="ts-stat-card ts-stat-card--green">
                  <span className="ts-stat-card__icon ts-stat-card__icon--green">
                    <CheckCircleOutlined />
                  </span>
                  <div>
                    <p className="ts-stat-card__label ts-stat-card__label--green">Hoàn thành</p>
                    <p className="ts-stat-card__value">{summary.completionPercent}%</p>
                  </div>
                </div>
              </div>

              <p className="ts-section-title">Giờ theo năm</p>

              <div className="ts-year-list">
                {yearsData.map(({ year, hours, target, passed }) => {
                  const pct = Math.min((hours / target) * 100, 100)
                  
                  // Custom bar color & status badge
                  let barColor = '#2563eb' // Xanh lam
                  let badgeClass = 'ts-badge--fail-amber'
                  let badgeLabel = 'Chưa đạt'

                  if (passed) {
                    barColor = '#1aaa84' // Xanh lá
                    badgeClass = 'ts-badge--pass'
                    badgeLabel = 'Đạt'
                  } else if (hours < 10) {
                    barColor = '#e53935' // Đỏ
                    badgeClass = 'ts-badge--fail-red'
                    badgeLabel = 'Chưa đạt'
                  }

                  return (
                    <div key={year} className="ts-year-row">
                      <span className="ts-year-row__label">{year}</span>
                      <div className="ts-year-row__track">
                        <div
                          className="ts-year-row__bar"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                      <span className="ts-year-row__hours">{hours}h</span>
                      <span className={`ts-badge ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TrainingStatusScreen