import { CheckCircleFilled, WarningFilled, MinusCircleFilled } from '@ant-design/icons'

// Kết luận Đạt/Chưa đạt so với điểm sàn do admin cấu hình.
// passed === null/undefined nghĩa là chưa đủ dữ liệu để kết luận.
const TONES = {
  passed: { color: '#10b981', background: '#ecfdf5', label: 'Đạt', Icon: CheckCircleFilled },
  failed: { color: '#ef4444', background: '#fef2f2', label: 'Chưa đạt', Icon: WarningFilled },
  unknown: { color: '#6b7280', background: '#f3f4f6', label: 'Chưa có dữ liệu', Icon: MinusCircleFilled },
}

function PassFailBadge({ passed, className = 'evd-badge', passedLabel, failedLabel, unknownLabel }) {
  const tone = passed == null ? TONES.unknown : (passed ? TONES.passed : TONES.failed)
  const override = passed == null ? unknownLabel : (passed ? passedLabel : failedLabel)
  const { Icon } = tone

  return (
    <span className={className} style={{ backgroundColor: tone.background, color: tone.color }}>
      <Icon style={{ marginRight: 4 }} />
      {override || tone.label}
    </span>
  )
}

export default PassFailBadge
