import { CheckOutlined } from '@ant-design/icons'
import { passwordResetSteps } from '../constants/passwordResetSteps.js'

function StepIndicator({ activeStep }) {
  return (
    <div className="stepper" aria-label="Tiến trình đặt lại mật khẩu">
      {passwordResetSteps.map((label, index) => {
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
              {isDone ? <CheckOutlined /> : stepNumber}
            </span>
            <span className="stepper__label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default StepIndicator
