const STATS_CONFIG = [
  { key: 'cmeHours',      label: 'Giờ CME',                         mod: 'blue'  },
  { key: 'avgScore',      label: 'Điểm TB (năm nay)',  unit: '%',     mod: 'green' },
  { key: 'totalExamsDone',label: 'Số bài thi đã làm',               mod: 'amber' },
]

function StatCards({ summary }) {
  return (
    <div className="stat-cards">
      {STATS_CONFIG.map(({ key, label, sub, unit, mod }) => {
        const isCme = key === 'cmeHours'
        const cmeConfigured = !isCme || summary.cmeConfigured
        const cmeLoading = isCme && !summary.cmeStatusLoaded
        const displayLabel = isCme && summary.cmeCycleYears
          ? `Giờ CME (${summary.cmeCycleYears} năm)`
          : label
        const displayValue = cmeLoading ? '…' : (cmeConfigured ? summary[key] : '—')
        const displaySub = isCme
          ? (cmeLoading ? 'Đang tải' : (cmeConfigured ? `/ ${summary.requiredCmeHours}h` : 'Không áp dụng'))
          : sub
        return (
          <div key={key} className="stat-card">
            <div className={`stat-card__icon stat-card__icon--${mod}`} />
            <div>
              <p className="stat-card__label">{displayLabel}</p>
              <p className="stat-card__value">
                {displayValue}{cmeConfigured && !cmeLoading ? (unit ?? '') : ''}
                {displaySub && <span className="stat-card__sub"> {displaySub}</span>}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatCards
