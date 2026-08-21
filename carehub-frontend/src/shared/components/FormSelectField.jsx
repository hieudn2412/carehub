import { useId } from 'react'
import SearchableSelect from './SearchableSelect.jsx'

function FormSelectField({
  label,
  ariaLabel,
  value,
  options = [],
  onChange,
  placeholder,
  searchable = true,
  searchPlaceholder,
  onSearch,
  selectedOption,
  disabled = false,
  loading = false,
  loadingMessage,
  emptyMessage,
  showDescriptions = true,
  errorMessage = '',
  helpText = '',
  className = '',
  id,
  required = false,
}) {
  const generatedId = useId()
  const controlId = id || `form-select-${generatedId.replace(/:/g, '')}`
  const message = errorMessage || helpText
  const messageId = message ? `${controlId}-message` : undefined

  return (
    <div className={`am-form-group${errorMessage ? ' am-form-group--error' : ''}${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="am-form-label" htmlFor={controlId}>
          {label}
          {required && <span className="am-form-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <SearchableSelect
        ariaDescribedBy={messageId}
        ariaInvalid={Boolean(errorMessage)}
        ariaLabel={ariaLabel || label}
        className="am-form-select-searchable"
        disabled={disabled}
        emptyMessage={emptyMessage}
        id={controlId}
        loading={loading}
        loadingMessage={loadingMessage}
        onChange={onChange}
        onSearch={onSearch}
        options={options}
        placeholder={placeholder}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        selectedOption={selectedOption}
        showDescriptions={showDescriptions}
        value={value}
      />
      {message && <small className={`am-form-help${errorMessage ? ' am-form-help--error' : ''}`} id={messageId}>{message}</small>}
    </div>
  )
}

export default FormSelectField
