import { describe, expect, it } from 'vitest'
import { formatCognitiveWarningText, shouldShowCandidateLabelBadge } from './documentQuestionUi.js'

describe('shouldShowCandidateLabelBadge', () => {
  it('ẩn tag nhãn khi trùng nội dung với tag trạng thái', () => {
    expect(shouldShowCandidateLabelBadge({
      status: 'NEED_REVIEW',
      label: 'NEED_REVIEW',
    })).toBe(false)
  })

  it('giữ tag nhãn khi mang thông tin khác trạng thái', () => {
    expect(shouldShowCandidateLabelBadge({
      status: 'VALIDATED',
      label: 'GOOD',
    })).toBe(true)
  })
})

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
