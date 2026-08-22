function FilterActionButtons({
  className = '',
  applyLabel = 'Áp dụng',
  resetLabel = 'Xóa bộ lọc',
  applyClassName = '',
  resetClassName = '',
  onApply,
  onReset,
  applyDisabled = false,
  resetDisabled = false,
}) {
  return (
    <div className={`filter-action-buttons${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`filter-action-buttons__reset${resetClassName ? ` ${resetClassName}` : ''}`}
        onClick={onReset}
        disabled={resetDisabled}
      >
        {resetLabel}
      </button>
      <button
        type="button"
        className={`filter-action-buttons__apply${applyClassName ? ` ${applyClassName}` : ''}`}
        onClick={onApply}
        disabled={applyDisabled}
      >
        {applyLabel}
      </button>
    </div>
  )
}

export default FilterActionButtons
