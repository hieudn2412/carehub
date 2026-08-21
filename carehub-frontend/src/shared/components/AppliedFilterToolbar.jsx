import { FilterOutlined, SearchOutlined } from '@ant-design/icons'

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
                  if (event.key === 'Enter') onApply()
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
          {children}
          <div className="applied-filter-toolbar__actions">
            <button type="button" className="applied-filter-toolbar__reset" onClick={onReset}>Xóa bộ lọc</button>
            <button type="button" className="applied-filter-toolbar__apply" onClick={onApply}>Áp dụng</button>
          </div>
        </div>
      )}
    </section>
  )
}

export default AppliedFilterToolbar
