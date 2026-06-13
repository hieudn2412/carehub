import { passwordResetSteps } from '../constants/passwordResetSteps.js'
import Icon from '../../../shared/components/Icon.jsx'

function StepIndicator({ activeStep, steps = passwordResetSteps }) {
  return (
    <div className="stepper" aria-label="Tiến trình đặt lại mật khẩu">
      {steps.map((label, index) => {
        const stepNumber = index + 1
        const isDone = stepNumber < activeStep
        const isActive = stepNumber === activeStep

        return (
          <div className="stepper__item" key={label}>
            <span
              className={[
                'stepper__circle',
                isDone ? 'is-done' : '',
                isActive ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isDone ? <Icon name="check" /> : stepNumber}
            </span>
            <span className="stepper__label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default StepIndicator
