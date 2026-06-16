const STATS_CONFIG = [
  { key: 'cmeHours',      label: 'Giờ CME (5 năm)',    sub: '/ 120h', mod: 'blue'  },
  { key: 'avgScore',      label: 'Điểm TB (năm nay)',  unit: '%',     mod: 'green' },
  { key: 'totalExamsDone',label: 'Số bài thi đã làm',               mod: 'amber' },
]

function StatCards({ summary }) {
  return (
    <div className="stat-cards">
      {STATS_CONFIG.map(({ key, label, sub, unit, mod }) => (
        <div key={key} className="stat-card">
          <div className={`stat-card__icon stat-card__icon--${mod}`} />
          <div>
            <p className="stat-card__label">{label}</p>
            <p className="stat-card__value">
              {summary[key]}{unit ?? ''}
              {sub && <span className="stat-card__sub"> {sub}</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default StatCards