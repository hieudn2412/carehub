import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckOutlined, DownOutlined, SearchOutlined } from '@ant-design/icons'
import './MultiSearchSelect.css'

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .trim()
}

function MultiSearchSelect({
  value = [],
  options = [],
  onChange,
  placeholder = 'Tìm và chọn...',
  emptyMessage = 'Không tìm thấy kết quả phù hợp',
  disabled = false,
  ariaLabel,
  id,
}) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)

  const normalizedValues = useMemo(() => value.map(String), [value])
  const selectedValueSet = useMemo(() => new Set(normalizedValues), [normalizedValues])
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query)
    return options.filter((option) => (
      !normalizedQuery
      || normalizeSearch(`${option.label} ${option.description || ''} ${option.searchText || ''}`).includes(normalizedQuery)
    ))
  }, [options, query])
  const safeActiveIndex = activeIndex >= filteredOptions.length ? filteredOptions.length - 1 : activeIndex

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
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const toggleOption = (option) => {
    const optionValue = String(option.value)
    onChange(
      selectedValueSet.has(optionValue)
        ? normalizedValues.filter((selectedValue) => selectedValue !== optionValue)
        : [...normalizedValues, optionValue],
    )
    setActiveIndex(-1)
    setIsOpen(true)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((current) => (current <= 0 ? filteredOptions.length - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && isOpen && safeActiveIndex >= 0) {
      event.preventDefault()
      toggleOption(filteredOptions[safeActiveIndex])
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
      className={`multi-search-select${isOpen ? ' multi-search-select--open' : ''}${disabled ? ' multi-search-select--disabled' : ''}`}
    >
      <div className="multi-search-select__control" onClick={openDropdown}>
        <div className="multi-search-select__input-wrap">
          <SearchOutlined className="multi-search-select__search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-label={ariaLabel || placeholder}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-activedescendant={safeActiveIndex >= 0 ? `${listboxId}-option-${safeActiveIndex}` : undefined}
            autoComplete="off"
            disabled={disabled}
            value={query}
            placeholder={placeholder}
            onFocus={openDropdown}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
              setActiveIndex(-1)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <DownOutlined className="multi-search-select__arrow" aria-hidden="true" />
      </div>

      {isOpen && (
        <div id={listboxId} className="multi-search-select__menu" role="listbox" aria-multiselectable="true">
          {filteredOptions.length === 0 ? (
            <div className="multi-search-select__empty" role="status">{emptyMessage}</div>
          ) : filteredOptions.map((option, index) => {
            const isSelected = selectedValueSet.has(String(option.value))

            return (
              <button
                id={`${listboxId}-option-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`multi-search-select__option${isSelected ? ' multi-search-select__option--selected' : ''}${index === safeActiveIndex ? ' multi-search-select__option--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => toggleOption(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                <CheckOutlined aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MultiSearchSelect
