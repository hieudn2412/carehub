import { FilterOutlined } from '@ant-design/icons'

function AdminFilterDisclosure({
  children,
  activeCount = 0,
  className = '',
  label = 'Bộ lọc',
}) {
  return (
    <details className={`admin-filter-disclosure${className ? ` ${className}` : ''}`}>
      <summary>
        <FilterOutlined aria-hidden="true" />
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="admin-filter-disclosure__count" aria-label={`${activeCount} bộ lọc đang áp dụng`}>
            {activeCount}
          </span>
        )}
      </summary>
      <div className="admin-filter-disclosure__panel">{children}</div>
    </details>
  )
}

export default AdminFilterDisclosure
