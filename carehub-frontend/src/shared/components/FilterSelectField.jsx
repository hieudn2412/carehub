import { useId } from 'react'
import SearchableSelect from './SearchableSelect.jsx'

function FilterSelectField({
  label,
  ariaLabel,
  icon,
  value,
  options = [],
  onChange,
  placeholder,
  searchable = false,
  searchPlaceholder,
  onSearch,
  selectedOption,
  disabled = false,
  loading = false,
  loadingMessage,
  emptyMessage,
  showDescriptions = false,
  errorMessage = '',
  helpText = '',
  className = '',
  id,
  variant = 'wrapped',
}) {
  const generatedId = useId()
  const controlId = id || `filter-select-${generatedId.replace(/:/g, '')}`
  const message = errorMessage || helpText
  const messageId = message ? `${controlId}-message` : undefined
  const isStandalone = variant === 'standalone'

  return (
    <div className={`filter-select-field${isStandalone ? ' filter-select-field--standalone' : ''}${icon ? ' filter-select-field--with-icon' : ''}${errorMessage ? ' filter-select-field--error' : ''}${className ? ` ${className}` : ''}`}>
      <label className="filter-select-field__label" htmlFor={controlId}>{label}</label>
      <div className="filter-select-field__control">
        {icon && <span className="filter-select-field__icon" aria-hidden="true">{icon}</span>}
        <SearchableSelect
          ariaDescribedBy={messageId}
          ariaInvalid={Boolean(errorMessage)}
          ariaLabel={ariaLabel || label}
          className="filter-select-field__select"
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
      </div>
      {message && <small className="filter-select-field__message" id={messageId}>{message}</small>}
    </div>
  )
}

export default FilterSelectField
