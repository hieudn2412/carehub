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
  placeholder = 'Chọn một giá trị',
  searchPlaceholder = 'Nhập để tìm kiếm...',
  emptyMessage = 'Không tìm thấy kết quả phù hợp',
  disabled = false,
  ariaLabel,
  id,
}) {
  const rootRef = useRef(null)
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    if (!normalizedQuery) return options

    return options.filter((option) => (
      normalizeSearch(`${option.label} ${option.searchText || ''}`).includes(normalizedQuery)
    ))
  }, [options, query])

  useEffect(() => {
    const closeWhenClickingOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
        setQuery('')
        setActiveIndex(-1)
      }
    }

    document.addEventListener('mousedown', closeWhenClickingOutside)
    return () => document.removeEventListener('mousedown', closeWhenClickingOutside)
  }, [])

  const openDropdown = () => {
    if (disabled) return
    setIsOpen(true)
    setQuery('')
    setActiveIndex(-1)
  }

  const selectOption = (option) => {
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
        openDropdown()
        return
      }
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        openDropdown()
        return
      }
      setActiveIndex((current) => (current <= 0 ? filteredOptions.length - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
      setActiveIndex(-1)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`searchable-select${isOpen ? ' searchable-select--open' : ''}${disabled ? ' searchable-select--disabled' : ''}`}
    >
      <SearchOutlined className="searchable-select__search-icon" aria-hidden="true" />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel || placeholder}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        value={isOpen ? query : (selectedOption?.label || '')}
        placeholder={isOpen ? searchPlaceholder : placeholder}
        onClick={openDropdown}
        onFocus={openDropdown}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
      />
      <DownOutlined className="searchable-select__arrow" aria-hidden="true" />

      {isOpen && (
        <div id={listboxId} className="searchable-select__menu" role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="searchable-select__empty" role="status">{emptyMessage}</div>
          ) : filteredOptions.map((option, index) => {
            const isSelected = String(option.value) === String(value)
            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={`${option.value}-${option.label}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`searchable-select__option${index === activeIndex ? ' searchable-select__option--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                {isSelected && <CheckOutlined aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
