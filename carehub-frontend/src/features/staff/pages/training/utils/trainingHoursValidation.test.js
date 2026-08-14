import { describe, expect, it } from 'vitest'
import { getTrainingHoursValidationError } from './trainingHoursValidation.js'

describe('getTrainingHoursValidationError', () => {
  it('shows the correct message for negative hours', () => {
    expect(getTrainingHoursValidationError('-2')).toBe('Số giờ đào tạo không được là số âm.')
  })

  it('distinguishes missing, malformed, minimum and maximum errors', () => {
    expect(getTrainingHoursValidationError('')).toBe('Bắt buộc nhập số giờ')
    expect(getTrainingHoursValidationError('hai giờ')).toContain('không đúng định dạng')
    expect(getTrainingHoursValidationError('0')).toBe('Số giờ đào tạo phải từ 0.5 giờ trở lên.')
    expect(getTrainingHoursValidationError('1000')).toBe('Số giờ đào tạo không được vượt quá 999 giờ.')
  })

  it('accepts valid decimal hours', () => {
    expect(getTrainingHoursValidationError('0.5')).toBe('')
    expect(getTrainingHoursValidationError('12.5')).toBe('')
    expect(getTrainingHoursValidationError('999')).toBe('')
  })
})
