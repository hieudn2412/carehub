import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChecklistReadOnlyVersion from './ChecklistReadOnlyVersion.jsx'

const question = (overrides = {}) => ({
  questionKey: 'q1',
  title: 'Câu hỏi mẫu',
  fieldType: 'SHORT_TEXT',
  ...overrides,
})

const questionItem = (questionOverrides = {}, itemOverrides = {}) => ({
  itemKey: 'i1', itemType: 'QUESTION', displayOrder: 1,
  question: question(questionOverrides),
  ...itemOverrides,
})

const versionWith = (items, versionOverrides = {}) => ({
  sections: [{ sectionKey: 's1', title: 'Phần 1', displayOrder: 1, items }],
  ...versionOverrides,
})

const renderField = (questionOverrides) => {
  render(<ChecklistReadOnlyVersion version={versionWith([questionItem(questionOverrides)])} />)
  return document.querySelector('.ccp-readonly-field')
}

describe('ChecklistReadOnlyVersion - khung phiên bản', () => {
  it('chịu được phiên bản rỗng', () => {
    const { container } = render(<ChecklistReadOnlyVersion version={null} />)
    expect(container.querySelector('.ccp-readonly-version')).not.toBeNull()
    expect(container.querySelectorAll('.ccp-readonly-section')).toHaveLength(0)
  })

  it('sắp xếp các phần và các mục theo thứ tự hiển thị', () => {
    render(<ChecklistReadOnlyVersion version={{
      sections: [
        { sectionKey: 's2', title: 'Phần sau', displayOrder: 2, items: [] },
        { sectionKey: 's1', title: 'Phần trước', displayOrder: 1, items: [] },
      ],
    }} />)

    const titles = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)
    expect(titles).toEqual(['Phần trước', 'Phần sau'])
  })

  it('coi thứ tự thiếu là 0 khi sắp xếp', () => {
    render(<ChecklistReadOnlyVersion version={{
      sections: [
        { sectionKey: 's2', title: 'Phần có thứ tự', displayOrder: 1, items: [] },
        { sectionKey: 's1', title: 'Phần thiếu thứ tự', items: [] },
      ],
    }} />)

    const titles = screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)
    expect(titles).toEqual(['Phần thiếu thứ tự', 'Phần có thứ tự'])
  })

  it('ẩn phần đầu đề khi phần không có tiêu đề lẫn mô tả', () => {
    render(<ChecklistReadOnlyVersion version={{ sections: [{ sectionKey: 's1', items: [] }] }} />)
    expect(document.querySelector('.ccp-readonly-section__header')).toBeNull()
  })

  it('hiển thị mô tả của phần', () => {
    render(<ChecklistReadOnlyVersion version={{ sections: [{ sectionKey: 's1', description: 'Mô tả phần', items: [] }] }} />)
    expect(screen.getByText('Mô tả phần')).toBeInTheDocument()
  })

  it('chịu được phần không có mảng mục', () => {
    render(<ChecklistReadOnlyVersion version={{ sections: [{ sectionKey: 's1', title: 'Phần rỗng' }] }} />)
    expect(screen.getByText('Phần rỗng')).toBeInTheDocument()
  })
})

describe('ChecklistReadOnlyVersion - khối thông tin đối tượng', () => {
  it('không hiển thị khi chưa cấu hình đối tượng', () => {
    render(<ChecklistReadOnlyVersion version={{ sections: [] }} />)
    expect(document.querySelector('.ccp-subject-selector')).toBeNull()
  })

  it('không hiển thị khi danh sách trường rỗng', () => {
    render(<ChecklistReadOnlyVersion version={{ sections: [], settings: { subjectSelector: { displayFields: [] } } }} />)
    expect(document.querySelector('.ccp-subject-selector')).toBeNull()
  })

  it('hiển thị nhãn tiếng Việt và gợi ý trường tra cứu', () => {
    render(<ChecklistReadOnlyVersion version={{
      sections: [],
      settings: { subjectSelector: { displayFields: ['employeeCode', 'fullName', 'position', 'department', 'customField'], lookupBy: 'employeeCode' } },
    }} />)

    expect(screen.getByText('Thông tin đối tượng đánh giá')).toBeInTheDocument()
    expect(screen.getByText('Mã nhân viên')).toBeInTheDocument()
    expect(screen.getByText('Họ và tên')).toBeInTheDocument()
    expect(screen.getByText('Chức danh nghề nghiệp')).toBeInTheDocument()
    expect(screen.getByText('Khoa phòng')).toBeInTheDocument()
    expect(screen.getByText('customField')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Trường dùng để tra cứu')).toBeDisabled()
    expect(screen.getAllByPlaceholderText('Tự động điền từ hồ sơ')).toHaveLength(4)
  })
})

describe('ChecklistReadOnlyVersion - các loại mục nội dung', () => {
  it('hiển thị mục hướng dẫn', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([
      { itemKey: 'i1', itemType: 'INSTRUCTION', title: 'Hướng dẫn', description: 'Nội dung hướng dẫn' },
    ])} />)

    expect(screen.getByText('Hướng dẫn')).toBeInTheDocument()
    expect(screen.getByText('Nội dung hướng dẫn')).toBeInTheDocument()
  })

  it('hiển thị mục tiêu đề - mô tả', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([
      { itemKey: 'i1', itemType: 'TITLE_DESCRIPTION', title: 'Tiêu đề khối', description: 'Mô tả khối' },
    ])} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Tiêu đề khối' })).toBeInTheDocument()
    expect(screen.getByText('Mô tả khối')).toBeInTheDocument()
  })

  it('bỏ trống nội dung khi mục không có tiêu đề và mô tả', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([
      { itemKey: 'i1', itemType: 'INSTRUCTION' },
      { itemKey: 'i2', itemType: 'TITLE_DESCRIPTION' },
    ])} />)

    expect(document.querySelector('.ccp-readonly-instruction').textContent).toBe('')
    expect(document.querySelector('.ccp-readonly-text-block').textContent).toBe('')
  })

  it('hiển thị hình minh hoạ kèm chú thích', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([
      { itemKey: 'i1', itemType: 'IMAGE', title: 'Ảnh quy trình', mediaUrl: 'https://example.test/a.png' },
    ])} />)

    expect(screen.getByRole('img', { name: 'Ảnh quy trình' })).toHaveAttribute('src', 'https://example.test/a.png')
    expect(screen.getByText('Ảnh quy trình')).toBeInTheDocument()
  })

  it('dùng mô tả làm chú thích và nhãn ảnh mặc định', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([
      { itemKey: 'i1', itemType: 'IMAGE', description: 'Chú thích ảnh', mediaUrl: 'https://example.test/b.png' },
    ])} />)

    expect(screen.getByRole('img', { name: 'Hình minh họa checklist' })).toBeInTheDocument()
    expect(screen.getByText('Chú thích ảnh')).toBeInTheDocument()
  })

  it('bỏ qua ảnh không có đường dẫn và chú thích', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([{ itemKey: 'i1', itemType: 'IMAGE' }])} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('figcaption')).toBeNull()
  })

  it('bỏ qua mục lạ và câu hỏi thiếu dữ liệu', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([
      { itemKey: 'i1', itemType: 'UNKNOWN', title: 'Không hiển thị' },
      { itemKey: 'i2', itemType: 'QUESTION' },
    ])} />)

    expect(screen.queryByText('Không hiển thị')).not.toBeInTheDocument()
    expect(document.querySelector('.ccp-readonly-question')).toBeNull()
  })
})

describe('ChecklistReadOnlyVersion - phần đầu câu hỏi', () => {
  it('hiển thị dấu bắt buộc và các nhãn phụ', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([questionItem({
      required: true, critical: true, excludeFromScore: true, helpText: 'Gợi ý trả lời',
    })])} />)

    expect(screen.getByLabelText('Bắt buộc')).toBeInTheDocument()
    expect(screen.getByText('Trọng yếu')).toBeInTheDocument()
    expect(screen.getByText('Không tính điểm')).toBeInTheDocument()
    expect(screen.getByText('Gợi ý trả lời')).toBeInTheDocument()
  })

  it('ẩn các nhãn phụ khi câu hỏi thường', () => {
    render(<ChecklistReadOnlyVersion version={versionWith([questionItem()])} />)

    expect(screen.queryByLabelText('Bắt buộc')).not.toBeInTheDocument()
    expect(document.querySelector('.ccp-readonly-badges').textContent).toBe('')
    expect(document.querySelector('.ccp-readonly-question__help')).toBeNull()
  })
})

describe('ChecklistReadOnlyVersion - các kiểu trường câu trả lời', () => {
  it('hiển thị ô nhập văn bản ngắn', () => {
    expect(within(renderField({ fieldType: 'SHORT_TEXT' })).getByPlaceholderText('Câu trả lời ngắn')).toBeDisabled()
  })

  it('hiển thị ô nhập đoạn văn', () => {
    expect(within(renderField({ fieldType: 'LONG_TEXT' })).getByPlaceholderText('Câu trả lời dạng đoạn văn')).toBeDisabled()
  })

  it.each([
    ['DATE', 'date'],
    ['DATETIME', 'datetime-local'],
    ['NUMBER', 'number'],
    ['TIME', 'time'],
  ])('hiển thị ô nhập %s', (fieldType, inputType) => {
    const field = renderField({ fieldType })
    expect(field.querySelector('input')).toHaveAttribute('type', inputType)
    expect(screen.getByPlaceholderText(`Trường ${fieldType}`)).toBeInTheDocument()
  })

  it('hiển thị danh sách chọn dạng dropdown', () => {
    renderField({ fieldType: 'DROPDOWN', options: [{ value: 'a', label: 'Tùy chọn A', displayOrder: 1 }] })
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('hiển thị các lựa chọn đơn theo thứ tự', () => {
    const field = renderField({
      fieldType: 'SINGLE_CHOICE',
      options: [
        { optionKey: 'o2', value: 'b', label: 'Không', displayOrder: 2 },
        { optionKey: 'o1', value: 'a', label: 'Có', displayOrder: 1 },
      ],
    })

    const labels = within(field).getAllByText(/Có|Không/).map((node) => node.textContent)
    expect(labels).toEqual(['Có', 'Không'])
    expect(within(field).getAllByRole('radio')).toHaveLength(2)
  })

  it('hiển thị các lựa chọn nhiều đáp án', () => {
    const field = renderField({
      fieldType: 'MULTIPLE_CHOICE',
      options: [{ id: 1, value: 'a', label: 'Lựa chọn A' }, { value: 'b', label: 'Lựa chọn B' }],
    })

    expect(within(field).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(field).getByText('Lựa chọn B')).toBeInTheDocument()
  })

  it('hiển thị hai lựa chọn Có / Không cho câu hỏi nhị phân', () => {
    const field = renderField({ fieldType: 'BOOLEAN' })

    expect(within(field).getByText('Có')).toBeInTheDocument()
    expect(within(field).getByText('Không')).toBeInTheDocument()
    expect(within(field).getAllByRole('radio')).toHaveLength(2)
  })

  it('hiển thị thang điểm theo cấu hình', () => {
    const field = renderField({ fieldType: 'LINEAR_SCALE', validationConfig: { min: 0, max: 3 } })

    expect(within(field).getAllByRole('radio')).toHaveLength(4)
    expect(within(field).getByText('0')).toBeInTheDocument()
    expect(within(field).getByText('3')).toBeInTheDocument()
  })

  it('dùng thang 1-5 khi thiếu cấu hình', () => {
    const field = renderField({ fieldType: 'LINEAR_SCALE' })

    expect(within(field).getAllByRole('radio')).toHaveLength(5)
    expect(within(field).getByText('1')).toBeInTheDocument()
    expect(within(field).getByText('5')).toBeInTheDocument()
  })

  it('bỏ qua giá trị lớn nhất nhỏ hơn giá trị nhỏ nhất', () => {
    const field = renderField({ fieldType: 'LINEAR_SCALE', validationConfig: { min: 2, max: 1 } })

    expect(within(field).getAllByRole('radio')).toHaveLength(4)
    expect(within(field).getByText('2')).toBeInTheDocument()
  })

  it('giới hạn thang điểm tối đa 20 mức', () => {
    const field = renderField({ fieldType: 'LINEAR_SCALE', validationConfig: { min: 1, max: 100 } })
    expect(within(field).getAllByRole('radio')).toHaveLength(20)
  })

  it('hiển thị thông báo chưa hỗ trợ tải tệp', () => {
    const field = renderField({ fieldType: 'FILE_UPLOAD' })

    expect(within(field).getByText('Chức năng tải tệp chưa được hỗ trợ trong module biểu mẫu.')).toBeInTheDocument()
    expect(field.querySelector('input[type="file"]')).toBeDisabled()
  })

  it('chịu được câu hỏi lựa chọn không có phương án nào', () => {
    const field = renderField({ fieldType: 'SINGLE_CHOICE' })
    expect(within(field).queryAllByRole('radio')).toHaveLength(0)
  })
})
