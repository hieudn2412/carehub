import { describe, expect, it } from 'vitest'
import { shouldShowCandidateLabelBadge } from './documentQuestionUi.js'

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
