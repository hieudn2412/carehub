import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { useState } from 'react'

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
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
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
            {isPasswordVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>
        )}
      </span>
      {error && <span className="form-field__error">{error}</span>}
    </label>
  )
}

export default FormField
