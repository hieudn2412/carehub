import { useId, useState } from 'react'
import Icon from './Icon.jsx'

function FormField({
  autoComplete,
  error,
  icon,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
}) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isPasswordField = type === 'password'
  const inputType = isPasswordField && isPasswordVisible ? 'text' : type

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={inputId}>
        {label}
      </label>
      <span className={`form-field__control ${error ? 'has-error' : ''}`}>
        <span className="form-field__icon">{icon}</span>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          id={inputId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={inputType}
          value={value}
        />
        {isPasswordField && (
          <button
            aria-label={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="form-field__password-toggle"
            onClick={(event) => {
              event.preventDefault()
              setIsPasswordVisible((current) => !current)
            }}
            type="button"
          >
            <Icon name={isPasswordVisible ? 'eyeOff' : 'eye'} />
          </button>
        )}
      </span>
      {error && (
        <span className="form-field__error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  )
}

export default FormField
