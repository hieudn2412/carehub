import { useState } from 'react'
import Icon from './Icon.jsx'

function FormField({
  error,
  icon,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const isPasswordField = type === 'password'
  const inputType = isPasswordField && isPasswordVisible ? 'text' : type

  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <span className={`form-field__control ${error ? 'has-error' : ''}`}>
        <span className="form-field__icon">{icon}</span>
        <input
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
      {error && <span className="form-field__error">{error}</span>}
    </label>
  )
}

export default FormField
