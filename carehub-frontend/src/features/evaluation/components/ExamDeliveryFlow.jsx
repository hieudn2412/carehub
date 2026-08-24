const STEPS = [
  {
    key: 'matrix',
    number: '01',
    title: 'Tạo ma trận',
    description: 'Chọn đối tượng, số câu và tỷ lệ',
  },
  {
    key: 'papers',
    number: '02',
    title: 'Sinh mã đề',
    description: 'Kiểm tra nguồn và phát hành',
  },
  {
    key: 'assignments',
    number: '03',
    title: 'Giao đề',
    description: 'Chọn nhóm nhận và lịch làm',
  },
]

function ExamDeliveryFlow({ activeStep, title, description, onStepChange }) {
  return (
    <section className="exp-flow-header" aria-labelledby="exam-delivery-flow-title">
      <div className="exp-flow-header__copy">
        <span className="exp-flow-header__eyebrow">QUẢN LÝ BÀI KIỂM TRA</span>
        <h1 id="exam-delivery-flow-title">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="exp-flow-steps" aria-label="Quy trình giao đề kiểm tra">
        {STEPS.map((step) => (
          <button
            key={step.key}
            type="button"
            className={`exp-flow-step${activeStep === step.key ? ' is-active' : ''}${STEPS.findIndex((item) => item.key === activeStep) > STEPS.findIndex((item) => item.key === step.key) ? ' is-complete' : ''}`}
            aria-current={activeStep === step.key ? 'step' : undefined}
            onClick={() => onStepChange?.(step.key)}
          >
            <span className="exp-flow-step__number">{step.number}</span>
            <span className="exp-flow-step__copy">
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default ExamDeliveryFlow
