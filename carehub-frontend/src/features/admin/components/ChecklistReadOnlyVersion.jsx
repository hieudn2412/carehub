function sortByDisplayOrder(items = []) {
  return [...items].sort(
    (left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0),
  )
}

const SUBJECT_FIELD_LABELS = {
  employeeCode: 'Mã nhân viên',
  fullName: 'Họ và tên',
  position: 'Chức danh nghề nghiệp',
  department: 'Khoa phòng',
}

function SubjectSelector({ selector }) {
  const displayFields = Array.isArray(selector?.displayFields)
    ? selector.displayFields
    : []

  if (displayFields.length === 0) {
    return null
  }

  return (
    <article className="ccp-subject-selector">
      <header>
        <h2>Thông tin đối tượng đánh giá</h2>
        <p>
          Các trường này được tự động lấy từ hồ sơ nhân viên khi thực hiện checklist.
        </p>
      </header>
      <div className="ccp-subject-selector__grid">
        {displayFields.map((field) => (
          <label key={field}>
            <span>{SUBJECT_FIELD_LABELS[field] || field}</span>
            <input
              disabled
              placeholder={field === selector.lookupBy
                ? 'Trường dùng để tra cứu'
                : 'Tự động điền từ hồ sơ'}
              type="text"
            />
          </label>
        ))}
      </div>
    </article>
  )
}

function ReadOnlyQuestionField({ question }) {
  const options = sortByDisplayOrder(question.options)

  if (question.fieldType === 'LONG_TEXT') {
    return <textarea disabled placeholder="Câu trả lời dạng đoạn văn" rows="3" />
  }

  if (question.fieldType === 'DROPDOWN') {
    return (
      <select disabled value="">
        <option value="">Chọn một tùy chọn</option>
        {options.map((option, optionIndex) => (
          <option
            key={option.optionKey || option.id || `${option.value}-${optionIndex}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (question.fieldType === 'SINGLE_CHOICE') {
    return (
      <div className="ccp-readonly-options">
        {options.map((option, optionIndex) => (
          <label key={option.optionKey || option.id || `${option.value}-${optionIndex}`}>
            <input disabled name={question.questionKey} type="radio" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  }

  if (question.fieldType === 'MULTIPLE_CHOICE') {
    return (
      <div className="ccp-readonly-options">
        {options.map((option, optionIndex) => (
          <label key={option.optionKey || option.id || `${option.value}-${optionIndex}`}>
            <input disabled type="checkbox" />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  }

  if (question.fieldType === 'BOOLEAN') {
    return (
      <div className="ccp-readonly-options">
        <label>
          <input disabled name={question.questionKey} type="radio" />
          <span>Có</span>
        </label>
        <label>
          <input disabled name={question.questionKey} type="radio" />
          <span>Không</span>
        </label>
      </div>
    )
  }

  if (question.fieldType === 'LINEAR_SCALE') {
    const configuredMin = Number(question.validationConfig?.min)
    const configuredMax = Number(question.validationConfig?.max)
    const min = Number.isFinite(configuredMin) ? configuredMin : 1
    const max = Number.isFinite(configuredMax) && configuredMax >= min
      ? configuredMax
      : 5
    const scaleSize = Math.min(max - min + 1, 20)
    const scaleValues = Array.from({ length: scaleSize }, (_, index) => min + index)

    return (
      <div className="ccp-readonly-scale">
        {scaleValues.map((value) => (
          <label key={value}>
            <span>{value}</span>
            <input disabled name={question.questionKey} type="radio" />
          </label>
        ))}
      </div>
    )
  }

  if (question.fieldType === 'FILE_UPLOAD') {
    return (
      <div className="ccp-readonly-upload">
        <input disabled type="file" />
        <span>Chức năng tải tệp chưa được hỗ trợ trong module biểu mẫu.</span>
      </div>
    )
  }

  const inputType = {
    DATE: 'date',
    DATETIME: 'datetime-local',
    NUMBER: 'number',
    TIME: 'time',
  }[question.fieldType] || 'text'

  return (
    <input
      disabled
      placeholder={question.fieldType === 'SHORT_TEXT'
        ? 'Câu trả lời ngắn'
        : `Trường ${question.fieldType}`}
      type={inputType}
    />
  )
}

function ChecklistReadOnlyVersion({ version }) {
  const sections = sortByDisplayOrder(version?.sections)
  const subjectSelector = version?.settings?.subjectSelector

  return (
    <section className="ccp-readonly-version">
      <SubjectSelector selector={subjectSelector} />
      {sections.map((section, sectionIndex) => (
        <article
          className="ccp-readonly-section"
          key={section.sectionKey || section.id || sectionIndex}
        >
          {(section.title || section.description) && (
            <header className="ccp-readonly-section__header">
              {section.title && <h2>{section.title}</h2>}
              {section.description && <p>{section.description}</p>}
            </header>
          )}

          <div className="ccp-readonly-items">
            {sortByDisplayOrder(section.items).map((item, itemIndex) => {
              const itemKey = item.itemKey || item.id || itemIndex

              if (item.itemType === 'INSTRUCTION') {
                return (
                  <div className="ccp-readonly-instruction" key={itemKey}>
                    {item.title && <strong>{item.title}</strong>}
                    {item.description && <p>{item.description}</p>}
                  </div>
                )
              }

              if (item.itemType === 'TITLE_DESCRIPTION') {
                return (
                  <div className="ccp-readonly-text-block" key={itemKey}>
                    {item.title && <h3>{item.title}</h3>}
                    {item.description && <p>{item.description}</p>}
                  </div>
                )
              }

              if (item.itemType === 'IMAGE') {
                return (
                  <figure className="ccp-readonly-image" key={itemKey}>
                    {item.mediaUrl && (
                      <img alt={item.title || 'Hình minh họa checklist'} src={item.mediaUrl} />
                    )}
                    {(item.title || item.description) && (
                      <figcaption>{item.title || item.description}</figcaption>
                    )}
                  </figure>
                )
              }

              if (item.itemType !== 'QUESTION' || !item.question) {
                return null
              }

              const question = item.question
              return (
                <div className="ccp-readonly-question" key={itemKey}>
                  <div className="ccp-readonly-question__heading">
                    <strong>
                      {question.title}
                      {question.required && <span aria-label="Bắt buộc"> *</span>}
                    </strong>
                    <div className="ccp-readonly-badges">
                      {question.critical && <span>Trọng yếu</span>}
                      {question.excludeFromScore && <span>Không tính điểm</span>}
                    </div>
                  </div>
                  {question.helpText && (
                    <p className="ccp-readonly-question__help">{question.helpText}</p>
                  )}
                  <div className="ccp-readonly-field">
                    <ReadOnlyQuestionField question={question} />
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      ))}
    </section>
  )
}

export default ChecklistReadOnlyVersion
