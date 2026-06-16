const ICON_MAP = {
  EXAM_COMPLETED:  { icon: '✅', mod: 'green'  },
  LOGIN:           { icon: '🔑', mod: 'blue'   },
  PASSWORD_CHANGE: { icon: '🔒', mod: 'amber'  },
  UPLOAD:          { icon: '⬆️', mod: 'purple' },
}

function RecentActivities({ activities }) {
  return (
    <div className="dashboard-panel">
      <h3 className="dashboard-panel__title">⚡ Hoạt động gần đây</h3>
      <ul className="activity-list">
        {activities.map((act) => {
          const { icon, mod } = ICON_MAP[act.type] ?? { icon: '📌', mod: '' }
          return (
            <li key={act.id} className="activity-item">
              <div className={`activity-item__icon activity-item__icon--${mod}`}>
                {icon}
              </div>
              <span className="activity-item__text">{act.description}</span>
              <span className="activity-item__time">{act.timeAgo}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default RecentActivities