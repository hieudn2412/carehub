import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons'
import './SearchableSelect.css'

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim()
}

function SearchableSelect({
  value,
  options = [],
  onChange,
  onSearch,
  selectedOption: selectedOptionProp,
  placeholder,
  searchPlaceholder = 'Nhập để tìm kiếm...',
  emptyMessage = 'Không tìm thấy kết quả phù hợp',
  loading = false,
  loadingMessage = 'Đang tải dữ liệu...',
  disabled = false,
  multiple = false,
  ariaLabel,
  id,
}) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const effectivePlaceholder = placeholder ?? (multiple ? 'Tìm và chọn...' : 'Chọn một giá trị')

  const normalizedValues = useMemo(
    () => (multiple && Array.isArray(value) ? value.map(String) : []),
    [multiple, value],
  )
  const selectedValueSet = useMemo(() => new Set(normalizedValues), [normalizedValues])

  const selectedOption = useMemo(
    () => (multiple
      ? null
      : selectedOptionProp
        || options.find((option) => String(option.value) === String(value))),
    [multiple, options, selectedOptionProp, value],
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    if (!normalizedQuery) return options

    return options.filter((option) => {
      const haystack = multiple
        ? `${option.label} ${option.description || ''} ${option.searchText || ''}`
        : `${option.label} ${option.searchText || ''}`
      return normalizeSearch(haystack).includes(normalizedQuery)
    })
  }, [multiple, options, query])

  const safeActiveIndex = multiple && activeIndex >= filteredOptions.length
    ? filteredOptions.length - 1
    : activeIndex

  useEffect(() => {
    const closeWhenClickingOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
        setQuery('')
        setActiveIndex(-1)
      }
    }

    document.addEventListener('mousedown', closeWhenClickingOutside, true)
    return () => document.removeEventListener('mousedown', closeWhenClickingOutside, true)
  }, [])

  const openDropdown = () => {
    if (disabled) return
    if (!isOpen) onSearch?.('')
    setIsOpen(true)
    if (multiple) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    setQuery('')
    setActiveIndex(-1)
  }

  const selectOption = (option) => {
    if (multiple) {
      const optionValue = String(option.value)
      onChange(
        selectedValueSet.has(optionValue)
          ? normalizedValues.filter((selectedValue) => selectedValue !== optionValue)
          : [...normalizedValues, optionValue],
      )
      setActiveIndex(-1)
      setIsOpen(true)
      window.setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    onChange(String(option.value))
    setIsOpen(false)
    setQuery('')
    setActiveIndex(-1)
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        if (!multiple) {
          openDropdown()
          return
        }
        setIsOpen(true)
      }
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        if (!multiple) {
          openDropdown()
          return
        }
        setIsOpen(true)
      }
      setActiveIndex((current) => (current <= 0 ? filteredOptions.length - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && isOpen && safeActiveIndex >= 0) {
      event.preventDefault()
      selectOption(filteredOptions[safeActiveIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
      setActiveIndex(-1)
    }
  }

  const inputElement = (
    <input
      ref={inputRef}
      id={id}
      type="text"
      role="combobox"
      aria-label={ariaLabel || effectivePlaceholder}
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-expanded={isOpen}
      aria-activedescendant={safeActiveIndex >= 0 ? `${listboxId}-option-${safeActiveIndex}` : undefined}
      autoComplete="off"
      disabled={disabled}
      value={multiple || isOpen ? query : (selectedOption?.label || '')}
      placeholder={!multiple && isOpen ? searchPlaceholder : effectivePlaceholder}
      onClick={multiple ? undefined : openDropdown}
      onFocus={openDropdown}
      onChange={(event) => {
        const nextQuery = event.target.value
        setQuery(nextQuery)
        onSearch?.(nextQuery)
        setIsOpen(true)
        setActiveIndex(-1)
      }}
      onKeyDown={handleKeyDown}
    />
  )

  return (
    <div
      ref={rootRef}
      className={`searchable-select${multiple ? ' searchable-select--multi' : ''}${isOpen ? ' searchable-select--open' : ''}${disabled ? ' searchable-select--disabled' : ''}`}
    >
      {multiple ? (
        <div className="searchable-select__control" onClick={openDropdown}>
          <div className="searchable-select__input-wrap">
            <SearchOutlined className="searchable-select__search-icon" aria-hidden="true" />
            {inputElement}
          </div>
          <DownOutlined className="searchable-select__arrow" aria-hidden="true" />
        </div>
      ) : (
        <>
          <SearchOutlined className="searchable-select__search-icon" aria-hidden="true" />
          {inputElement}
          <DownOutlined className="searchable-select__arrow" aria-hidden="true" />
        </>
      )}

      {isOpen && (
        <div
          id={listboxId}
          className="searchable-select__menu"
          role="listbox"
          aria-multiselectable={multiple || undefined}
        >
          {loading ? (
            <div className="searchable-select__empty" role="status">{loadingMessage}</div>
          ) : filteredOptions.length === 0 ? (
            <div className="searchable-select__empty" role="status">{emptyMessage}</div>
          ) : filteredOptions.map((option, index) => {
            const isSelected = multiple
              ? selectedValueSet.has(String(option.value))
              : String(option.value) === String(value)
            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`searchable-select__option${multiple && isSelected ? ' searchable-select__option--selected' : ''}${index === safeActiveIndex ? ' searchable-select__option--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                {(multiple || isSelected) && <CheckOutlined aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
