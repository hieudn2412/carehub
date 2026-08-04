import { SearchOutlined } from '@ant-design/icons'
import { createEmptyTrainingFilters, countActiveFilterGroups } from '../utils/trainingRecordQuery.js'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

function TrainingSearchFilters({
  searchValue = '',
  onSearchChange,
  onSearchKeyDown,
  filters = createEmptyTrainingFilters(),
  onFilterChange,
  filterOptions = { activityTypes: [], professionalFields: [] },
  filterOptionsLoading = false,
  filterOptionsError = '',
  onRetryOptions,
  dateError = '',
  onClear,
  onApply,
}) {
  const updateFilter = (key, value) => onFilterChange?.(current => ({ ...current, [key]: value }))

  return (
    <div className="th-mobile-search-form">
      <div className="th-mobile-search-form__search">
        <SearchOutlined aria-hidden="true" />
        <input
          data-mobile-search-autofocus
          value={searchValue}
          onChange={event => onSearchChange?.(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Tìm theo nội dung đào tạo..."
          aria-label="Tìm theo nội dung đào tạo"
        />
      </div>

      <div className="th-mobile-search-form__summary">
        {countActiveFilterGroups(filters)} điều kiện lọc đang chọn
      </div>

      {filterOptionsLoading ? (
        <div className="th-mobile-search-form__state" role="status">Đang tải tùy chọn lọc...</div>
      ) : filterOptionsError ? (
        <div className="th-mobile-search-form__state" role="alert">
          <p className="th-mobile-search-form__error">{filterOptionsError}</p>
          <button type="button" className="th-retry-btn" onClick={onRetryOptions}>Thử lại</button>
        </div>
      ) : (
        <div className="th-mobile-search-form__grid">
          <label className="th-mobile-search-form__field">
            <span>Trạng thái hồ sơ</span>
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)} aria-label="Bộ lọc trạng thái">
              {STATUS_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="th-mobile-search-form__field">
            <span>Từ ngày</span>
            <input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} aria-label="Bộ lọc từ ngày" />
          </label>
          <label className="th-mobile-search-form__field">
            <span>Đến ngày</span>
            <input type="date" value={filters.dateTo} onChange={event => updateFilter('dateTo', event.target.value)} aria-label="Bộ lọc đến ngày" />
          </label>
          <label className="th-mobile-search-form__field">
            <span>Lĩnh vực chuyên môn</span>
            <select value={filters.professionalFieldId} onChange={event => updateFilter('professionalFieldId', event.target.value)} aria-label="Bộ lọc lĩnh vực chuyên môn">
              <option value="">Tất cả lĩnh vực</option>
              {filterOptions.professionalFields.map(option => <option key={option.id} value={option.id}>{option.name || option.label}</option>)}
            </select>
          </label>
          <label className="th-mobile-search-form__field">
            <span>Hình thức đào tạo</span>
            <select value={filters.activityTypeId} onChange={event => updateFilter('activityTypeId', event.target.value)} aria-label="Bộ lọc hình thức đào tạo">
              <option value="">Tất cả hình thức</option>
              {filterOptions.activityTypes.map(option => <option key={option.id} value={option.id}>{option.name || option.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {dateError && <p className="th-mobile-search-form__error" role="alert">{dateError}</p>}
      <div className="th-mobile-search-form__actions">
        <button type="button" className="th-mobile-search-form__clear" onClick={onClear}>Xóa bộ lọc</button>
        <button type="button" className="th-mobile-search-form__apply" onClick={onApply}>Áp dụng</button>
      </div>
    </div>
  )
}

export default TrainingSearchFilters
