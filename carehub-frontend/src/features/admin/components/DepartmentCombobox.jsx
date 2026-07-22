import { useId, useMemo, useRef, useState } from 'react'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'

function normalizeSearch(value = '') {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
    .trim()
}

function DepartmentCombobox({ id, departments, value, onChange, disabled = false, placeholder = 'Chọn phòng ban...' }) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listboxRef = useRef(null)
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedDepartment = useMemo(
    () => departments.find(department => String(department.id) === String(value)),
    [departments, value]
  )

  const filteredDepartments = useMemo(() => {
    const normalizedQuery = normalizeSearch(isSearching ? query : '')
    if (!normalizedQuery) return departments

    return departments.filter(department => {
      const searchableText = `${department.name || ''} ${department.departmentCode || ''}`
      return normalizeSearch(searchableText).includes(normalizedQuery)
    })
  }, [departments, isSearching, query])

  const displayValue = isSearching ? query : (selectedDepartment?.name || '')
  const safeActiveIndex = activeIndex >= 0 && activeIndex < filteredDepartments.length ? activeIndex : -1

  const activateOption = (index) => {
    setActiveIndex(index)
    requestAnimationFrame(() => {
      listboxRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
    })
  }

  const openDropdown = () => {
    if (disabled) return
    setIsOpen(true)
    const selectedIndex = selectedDepartment
      ? filteredDepartments.findIndex(department => String(department.id) === String(selectedDepartment.id))
      : -1
    activateOption(selectedIndex)
  }

  const closeDropdown = () => {
    setIsOpen(false)
    setIsSearching(false)
    setQuery('')
    setActiveIndex(-1)
  }

  const selectDepartment = (department) => {
    onChange(String(department.id))
    setIsSearching(false)
    setQuery('')
    setIsOpen(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const handleInputChange = (event) => {
    setQuery(event.target.value)
    setIsSearching(true)
    setIsOpen(true)
    setActiveIndex(0)
    if (value) onChange('')
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        openDropdown()
        return
      }
      activateOption(Math.min(safeActiveIndex + 1, filteredDepartments.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        openDropdown()
        return
      }
      activateOption(safeActiveIndex <= 0 ? filteredDepartments.length - 1 : safeActiveIndex - 1)
      return
    }

    if (event.key === 'Enter' && isOpen && safeActiveIndex >= 0) {
      event.preventDefault()
      selectDepartment(filteredDepartments[safeActiveIndex])
      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      closeDropdown()
    }
  }

  const handleBlur = (event) => {
    if (!rootRef.current?.contains(event.relatedTarget)) closeDropdown()
  }

  return (
    <div className={`am-department-combobox${isOpen ? ' am-department-combobox--open' : ''}`} ref={rootRef}>
      <SearchOutlined className="am-department-combobox__search-icon" aria-hidden="true" />
      <input
        id={id}
        ref={inputRef}
        type="text"
        className="am-department-combobox__input"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={safeActiveIndex >= 0 ? `${listboxId}-option-${safeActiveIndex}` : undefined}
        aria-required="true"
        autoComplete="off"
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={openDropdown}
        onClick={openDropdown}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <button
        type="button"
        className="am-department-combobox__toggle"
        aria-label={isOpen ? 'Đóng danh sách phòng ban' : 'Mở danh sách phòng ban'}
        aria-expanded={isOpen}
        disabled={disabled}
        tabIndex={-1}
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          if (isOpen) closeDropdown()
          else {
            openDropdown()
            inputRef.current?.focus()
          }
        }}
      >
        <DownOutlined aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          className="am-department-combobox__menu"
          id={listboxId}
          role="listbox"
          aria-label="Danh sách phòng ban"
        >
          {filteredDepartments.length === 0 ? (
            <div className="am-department-combobox__empty" role="status">
              Không tìm thấy phòng ban phù hợp
            </div>
          ) : filteredDepartments.map((department, index) => {
            const isSelected = String(department.id) === String(value)
            const isActive = index === safeActiveIndex
            return (
              <div
                id={`${listboxId}-option-${index}`}
                key={department.id}
                className={`am-department-combobox__option${isActive ? ' am-department-combobox__option--active' : ''}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectDepartment(department)}
              >
                <span>{department.name}</span>
                {department.departmentCode && <small>{department.departmentCode}</small>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DepartmentCombobox
