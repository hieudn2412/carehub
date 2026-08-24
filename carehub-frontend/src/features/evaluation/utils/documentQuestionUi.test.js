import { describe, expect, it } from 'vitest'
import { formatCognitiveWarningText } from './documentQuestionUi.js'

describe('formatCognitiveWarningText', () => {
  it('dịch mã mức nhận thức tiếng Anh sang tiếng Việt', () => {
    expect(formatCognitiveWarningText('Phục hồi chức năng / FOUNDATION thiếu 5 câu'))
      .toBe('Phục hồi chức năng / Kiến thức nền tảng thiếu 5 câu')
    expect(formatCognitiveWarningText('Phục hồi chức năng / CLINICAL_APPLICATION thiếu 3 câu'))
      .toBe('Phục hồi chức năng / Áp dụng lâm sàng thiếu 3 câu')
    expect(formatCognitiveWarningText('Phục hồi chức năng / CLINICAL_REASONING_ANALYSIS thiếu 3 câu'))
      .toBe('Phục hồi chức năng / Tư duy phân tích thiếu 3 câu')
  })
})
