import { useMemo } from 'react'
import './DateTimePicker24h.css'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

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
    const h = e.target.value
    const d = date || new Date().toISOString().slice(0, 10)
    onChange(`${d}T${h}:${minute || '00'}`)
  }

  const handleMinuteChange = (e) => {
    const m = e.target.value
    const d = date || new Date().toISOString().slice(0, 10)
    onChange(`${d}T${hour || '08'}:${m}`)
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
        <span className="dt24-time-icon" title="Chọn giờ & phút (24h)">🕒</span>
        <select
          className="dt24-time-select"
          value={hour}
          onChange={handleHourChange}
          disabled={disabled}
          title="Chọn giờ (00-23)"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="dt24-sep">:</span>
        <select
          className="dt24-time-select"
          value={minute}
          onChange={handleMinuteChange}
          disabled={disabled}
          title="Chọn phút (00-59)"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
