import { useMemo } from 'react'
import './DateTimePicker24h.css'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export default function DateTimePicker24h({
  value,
  onChange,
  disabled = false,
  className = '',
  id,
}) {
  const { date, hour, minute } = useMemo(() => {
    if (!value) return { date: '', hour: '08', minute: '00' }
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:T|\s+)(\d{2}):(\d{2})/)
    if (!match) return { date: '', hour: '08', minute: '00' }
    return {
      date: match[1],
      hour: match[2],
      minute: match[3],
    }
  }, [value])

  const handleDateChange = (e) => {
    const newDate = e.target.value
    if (!newDate) {
      onChange('')
      return
    }
    const h = hour || '08'
    const m = minute || '00'
    onChange(`${newDate}T${h}:${m}`)
  }

  const handleHourChange = (e) => {
    const raw = e.target.value
    if (!date) return
    if (raw === '') {
      onChange(`${date}T00:${minute || '00'}`)
      return
    }
    const num = parseInt(raw, 10)
    if (isNaN(num)) return
    const clamped = Math.max(0, Math.min(23, num))
    const formatted = String(clamped).padStart(2, '0')
    onChange(`${date}T${formatted}:${minute || '00'}`)
  }

  const handleMinuteChange = (e) => {
    const raw = e.target.value
    if (!date) return
    if (raw === '') {
      onChange(`${date}T${hour || '08'}:00`)
      return
    }
    const num = parseInt(raw, 10)
    if (isNaN(num)) return
    const clamped = Math.max(0, Math.min(59, num))
    const formatted = String(clamped).padStart(2, '0')
    onChange(`${date}T${hour || '08'}:${formatted}`)
  }

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={`dt24-picker ${disabled ? 'dt24-picker--disabled' : ''} ${className}`}>
      <input
        id={id}
        type="date"
        className="dt24-input dt24-input--date"
        value={date}
        onChange={handleDateChange}
        disabled={disabled}
      />
      <div className="dt24-time-group">
        <span className="dt24-time-icon" title="Nhập hoặc chọn giờ (00 - 23)">🕒</span>
        <input
          type="number"
          min={0}
          max={23}
          list="dt24-hours-list"
          className="dt24-num-input dt24-num-input--hour"
          value={hour}
          onChange={handleHourChange}
          disabled={disabled || !date}
          placeholder="HH"
          title="Nhập giờ 24h (00-23)"
        />
        <datalist id="dt24-hours-list">
          {HOURS.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <span className="dt24-sep">:</span>
        <input
          type="number"
          min={0}
          max={59}
          list="dt24-minutes-list"
          className="dt24-num-input dt24-num-input--minute"
          value={minute}
          onChange={handleMinuteChange}
          disabled={disabled || !date}
          placeholder="MM"
          title="Nhập phút (00-59)"
        />
        <datalist id="dt24-minutes-list">
          {MINUTES.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      {date && !disabled && (
        <button
          type="button"
          className="dt24-clear-btn"
          onClick={handleClear}
          title="Xóa thời gian"
        >
          ✕
        </button>
      )}
    </div>
  )
}
