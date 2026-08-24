import { useMemo, useState, useEffect } from 'react'
import './DateTimePicker24h.css'

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

  const [timeInput, setTimeInput] = useState(`${hour}:${minute}`)

  useEffect(() => {
    setTimeInput(`${hour}:${minute}`)
  }, [hour, minute])

  const handleDateChange = (newDate) => {
    if (!newDate) {
      onChange('')
      return
    }
    onChange(`${newDate}T${hour}:${minute}`)
  }

  const handleTimeChange = (e) => {
    let raw = e.target.value;

    // Only allow numbers and colons
    raw = raw.replace(/[^\d:]/g, '');

    // Auto-insert colons
    if (raw.length > timeInput.length) {
      if (raw.length === 2 && !raw.includes(':')) {
        raw = raw + ':';
      }
    }

    if (raw.length > 5) {
      raw = raw.slice(0, 5);
    }

    setTimeInput(raw);

    // Validate
    const match = raw.match(/^(\d{2}):(\d{2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const d = date || new Date().toISOString().slice(0, 10);
        onChange(`${d}T${match[1]}:${match[2]}`);
      }
    }
  };

  const handleTimeBlur = () => {
    const match = timeInput.match(/^(\d{2}):(\d{2})$/);
    let isValid = false;
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        isValid = true;
      }
    }
    if (!isValid) {
      setTimeInput(`${hour}:${minute}`);
    }
  };

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={`dt24-picker ${disabled ? 'dt24-picker--disabled' : ''} ${className}`}>
      {/* input type=date: go tay duoc va bam vao bieu tuong lich chon duoc, khong can thu vien */}
      <input
        id={id}
        type="date"
        className="dt24-input dt24-input--date"
        value={date}
        onChange={(e) => handleDateChange(e.target.value)}
        disabled={disabled}
      />
      <div className="dt24-time-group">
        <span className="dt24-time-icon" title="Nhập giờ & phút (24h)">🕒</span>
        <input
          type="text"
          className="dt24-time-input"
          value={timeInput}
          onChange={handleTimeChange}
          onBlur={handleTimeBlur}
          disabled={disabled}
          placeholder="hh:mm"
          maxLength={5}
          title="Nhập giờ & phút (hh:mm)"
        />
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
