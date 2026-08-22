import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import FilterActionButtons from './FilterActionButtons.jsx'

function AppliedFilterToolbar({
  activeCount = 0,
  actions,
  ariaLabel = 'Công cụ tìm kiếm và bộ lọc',
  children,
  className = '',
  filterLabel = 'Bộ lọc',
  header,
  isOpen,
  onApply,
  onReset,
  onSearchChange,
  onToggle,
  panelClassName = '',
  panelId,
  searchAriaLabel = 'Tìm kiếm',
  searchClassName = '',
  searchPlaceholder = 'Tìm kiếm...',
  searchValue,
  showFilter = true,
}) {
  return (
    <section className={`applied-filter-toolbar admin-control-toolbar${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      {header}
      <div className="admin-control-toolbar__main">
        <div className="admin-control-toolbar__controls">
          {onSearchChange && (
            <div className={`applied-filter-toolbar__search admin-control-toolbar__search${searchClassName ? ` ${searchClassName}` : ''}`}>
              <SearchOutlined aria-hidden="true" />
              <input
                aria-label={searchAriaLabel}
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onApply?.()
                }}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {showFilter && <button
            type="button"
            className={`admin-control-toolbar__filter-trigger${isOpen ? ' is-open' : ''}`}
            aria-controls={panelId}
            aria-expanded={isOpen}
            onClick={onToggle}
          >
            <FilterOutlined aria-hidden="true" /> {filterLabel}
            {activeCount > 0 && <span className="admin-control-toolbar__filter-count">{activeCount}</span>}
          </button>}
        </div>
        {actions && <div className="applied-filter-toolbar__page-actions">{actions}</div>}
      </div>

      {showFilter && isOpen && (
        <div id={panelId} className={`applied-filter-toolbar__panel admin-control-toolbar__panel${panelClassName ? ` ${panelClassName}` : ''}`}>
          <div className="applied-filter-toolbar__fields">
            {children}
          </div>
          <FilterActionButtons className="applied-filter-toolbar__actions" onReset={onReset} onApply={onApply} />
        </div>
      )}
    </section>
  )
}

export default AppliedFilterToolbar
