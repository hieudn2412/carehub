import './ProgressRing.css'

export default function ProgressRing({
  progress = 0,
  size = 52,
  strokeWidth = 3,
  color = '#16a34a',
  trackColor = '#e5e7eb',
  textColor = '#374151',
  className = '',
}) {
  const radius = 15.9155
  const clampedProgress = Math.round(Math.min(Math.max(Number(progress) || 0, 0), 100))

  return (
    <div
      className={`progress-ring ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Tiến độ ${clampedProgress}%`}
    >
      <svg viewBox="0 0 36 36" className="progress-ring__svg" aria-hidden="true">
        <path
          className="progress-ring__bg"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          d={`M18 2.0845 a ${radius} ${radius} 0 0 1 0 31.831 a ${radius} ${radius} 0 0 1 0 -31.831`}
        />
        <path
          className="progress-ring__fill"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${clampedProgress}, 100`}
          d={`M18 2.0845 a ${radius} ${radius} 0 0 1 0 31.831 a ${radius} ${radius} 0 0 1 0 -31.831`}
        />
      </svg>
      <span className="progress-ring__value" style={{ color: textColor }}>
        {clampedProgress}%
      </span>
    </div>
  )
}
