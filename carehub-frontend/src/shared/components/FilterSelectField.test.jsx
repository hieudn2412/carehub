import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilterSelectField from './FilterSelectField.jsx'

const options = [
  { value: '', label: 'Tất cả quy trình' },
  { value: '19', label: 'Tiêm truyền tĩnh mạch', description: 'TIEM_TRUYEN', searchText: 'TIEM_TRUYEN' },
]

describe('FilterSelectField', () => {
  it('renders options without descriptions by default', () => {
    render(<FilterSelectField label="Quy trình" onChange={() => {}} options={options} value="" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Quy trình' }))
    expect(screen.getByRole('option', { name: /Tiêm truyền tĩnh mạch/ })).toBeInTheDocument()
    expect(screen.queryByText('TIEM_TRUYEN')).not.toBeInTheDocument()
  })

  it('keeps hidden search text searchable and returns the selected value', () => {
    const onChange = vi.fn()
    render(<FilterSelectField label="Quy trình" onChange={onChange} options={options} searchable searchPlaceholder="Tìm quy trình" value="" />)

    const input = screen.getByRole('combobox', { name: 'Quy trình' })
    fireEvent.change(input, { target: { value: 'TIEM_TRUYEN' } })
    fireEvent.click(screen.getByRole('option', { name: /Tiêm truyền tĩnh mạch/ }))
    expect(onChange).toHaveBeenCalledWith('19')
  })

  it('supports keyboard selection for a static dropdown', () => {
    const onChange = vi.fn()
    render(<FilterSelectField label="Quy trình" onChange={onChange} options={options} value="" />)

    const input = screen.getByRole('combobox', { name: 'Quy trình' })
    fireEvent.click(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('19')
  })

  it('shows descriptions only when explicitly requested', () => {
    render(
      <FilterSelectField
        label="Quy trình"
        onChange={() => {}}
        options={options}
        showDescriptions
        value=""
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Quy trình' }))
    expect(screen.getByText('TIEM_TRUYEN')).toBeInTheDocument()
  })

  it('exposes consistent loading, empty and disabled states', () => {
    const { rerender } = render(
      <FilterSelectField
        label="Khoa/phòng"
        loading
        loadingMessage="Đang tải khoa/phòng..."
        onChange={() => {}}
        options={[]}
        value=""
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Khoa/phòng' }))
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải khoa/phòng...')

    rerender(
      <FilterSelectField
        label="Khoa/phòng"
        emptyMessage="Không có khoa/phòng"
        onChange={() => {}}
        options={[]}
        searchable
        value=""
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Không có khoa/phòng')

    rerender(
      <FilterSelectField
        disabled
        label="Khoa/phòng"
        onChange={() => {}}
        options={options}
        value=""
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Khoa/phòng' })).toBeDisabled()
  })

  it('supports standalone variant with visible search icon', () => {
    render(
      <FilterSelectField
        label="Khoa/phòng"
        onChange={() => {}}
        options={options}
        searchable
        searchPlaceholder="Gõ tên khoa/phòng..."
        value=""
        variant="standalone"
      />,
    )

    expect(document.querySelector('.filter-select-field--standalone')).toBeTruthy()
    expect(document.querySelector('.filter-select-field--standalone .searchable-select__search-icon')).toBeTruthy()
  })
})
