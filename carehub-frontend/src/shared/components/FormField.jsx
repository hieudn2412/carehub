function FormField({
  error,
  icon,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <span className={`form-field__control ${error ? 'has-error' : ''}`}>
        <span className="form-field__icon">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </span>
      {error && <span className="form-field__error">{error}</span>}
    </label>
  )
}

export default FormField
