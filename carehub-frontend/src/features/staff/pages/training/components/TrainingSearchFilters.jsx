import { SearchOutlined } from '@ant-design/icons'
import KeyboardDatePicker from '../../../../../shared/components/KeyboardDatePicker.jsx'
import FilterActionButtons from '../../../../../shared/components/FilterActionButtons.jsx'
import FilterSelectField from '../../../../../shared/components/FilterSelectField.jsx'
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
          <FilterSelectField
            className="th-mobile-search-form__field"
            label="Trạng thái hồ sơ"
            value={filters.status}
            onChange={value => updateFilter('status', value)}
            options={STATUS_OPTIONS}
          />
          <label className="th-mobile-search-form__field">
            <span>Từ ngày</span>
            <KeyboardDatePicker value={filters.dateFrom} onChange={val => updateFilter('dateFrom', val)} aria-label="Bộ lọc từ ngày" />
          </label>
          <label className="th-mobile-search-form__field">
            <span>Đến ngày</span>
            <KeyboardDatePicker value={filters.dateTo} onChange={val => updateFilter('dateTo', val)} aria-label="Bộ lọc đến ngày" />
          </label>
          <FilterSelectField
            className="th-mobile-search-form__field"
            label="Lĩnh vực chuyên môn"
            value={filters.professionalFieldId}
            onChange={value => updateFilter('professionalFieldId', value)}
            searchable
            options={[
              { value: '', label: 'Tất cả lĩnh vực' },
              ...filterOptions.professionalFields.map(option => ({ value: option.id, label: option.name || option.label })),
            ]}
          />
          <FilterSelectField
            className="th-mobile-search-form__field"
            label="Hình thức đào tạo"
            value={filters.activityTypeId}
            onChange={value => updateFilter('activityTypeId', value)}
            searchable
            options={[
              { value: '', label: 'Tất cả hình thức' },
              ...filterOptions.activityTypes.map(option => ({ value: option.id, label: option.name || option.label })),
            ]}
          />
        </div>
      )}

      {dateError && <p className="th-mobile-search-form__error" role="alert">{dateError}</p>}
      <FilterActionButtons className="th-mobile-search-form__actions" onReset={onClear} onApply={onApply} />
    </div>
  )
}

export default TrainingSearchFilters
