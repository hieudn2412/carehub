import React, { useState, useEffect } from 'react';

export default function KeyboardDatePicker({ value, onChange, min, max, className, id, ...props }) {
  const toDisplay = (val) => {
    if (!val) return '';
    // val is expected in yyyy-MM-dd
    const parts = val.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  };

  const toIso = (displayVal) => {
    if (!displayVal) return '';
    const parts = displayVal.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (d && m && y && y.length === 4) {
        return `${y}-${m}-${d}`;
      }
    }
    return '';
  };

  const [inputValue, setInputValue] = useState(toDisplay(value));

  useEffect(() => {
    setInputValue(toDisplay(value));
  }, [value]);

  const handleInputChange = (e) => {
    let raw = e.target.value;
    
    // Support setting value via ISO date string (yyyy-MM-dd) commonly used in tests
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const parts = raw.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      setInputValue(formatted);
      onChange(raw);
      return;
    }

    // Only allow numbers and slashes
    raw = raw.replace(/[^\d/]/g, '');

    // Auto-insert slashes
    if (raw.length > inputValue.length) {
      if (raw.length === 2 && !raw.includes('/')) {
        raw = raw + '/';
      } else if (raw.length === 5 && raw.split('/').length === 2) {
        raw = raw + '/';
      }
    }
    
    // Prevent typing more than 10 characters
    if (raw.length > 10) {
      raw = raw.slice(0, 10);
    }
    
    setInputValue(raw);

    // Validate and notify parent
    const iso = toIso(raw);
    if (iso) {
      const parts = raw.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        if ((!min || iso >= min) && (!max || iso <= max)) {
          onChange(iso);
          return;
        }
      }
    }
    if (raw === '') {
      onChange('');
    }
  };

  const handleBlur = () => {
    const iso = toIso(inputValue);
    let isValid = false;
    if (iso) {
      const parts = inputValue.split('/');
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        if ((!min || iso >= min) && (!max || iso <= max)) {
          isValid = true;
        }
      }
    }
    if (!isValid && inputValue !== '') {
      setInputValue(toDisplay(value));
    }
  };

  return (
    <input
      type="text"
      id={id}
      className={className}
      value={inputValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder="dd/mm/yyyy"
      maxLength={10}
      {...props}
    />
  );
}
