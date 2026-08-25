/* global process */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildCreateQuestionJobPayload, COGNITIVE_MIX_FIELDS, DEFAULT_COGNITIVE_MIX } from './groundedQuestionUi.js'

const PAGES_DIR = join(process.cwd(), 'src', 'features', 'evaluation', 'pages')

/**
 * Có hai màn hình cùng tạo câu hỏi từ tài liệu (trang danh sách và trang
 * chi tiết). Đã từng thêm trường mới vào một trang mà quên trang kia, nên người dùng
 * không thấy ô nhập ở đúng chỗ họ hay dùng. Buộc mọi nơi đi qua một hàm dựng payload.
 */
describe('payload tạo câu hỏi từ tài liệu', () => {
  it('hiển thị đúng ba mức độ nhận thức', () => {
    expect(COGNITIVE_MIX_FIELDS.map(({ label }) => label)).toEqual([
      'Kiến thức nền tảng',
      'Áp dụng lâm sàng',
      'Tư duy phân tích',
    ])
  })

  it('mọi màn hình gọi createQuestionJob đều phải dùng buildCreateQuestionJobPayload', () => {
    const offenders = readdirSync(PAGES_DIR)
      .filter((name) => name.endsWith('.jsx') && !name.endsWith('.test.jsx'))
      .filter((name) => {
        const source = readFileSync(join(PAGES_DIR, name), 'utf8')
        return source.includes('createQuestionJob(') && !source.includes('buildCreateQuestionJobPayload')
      })

    expect(offenders, `Các trang tự dựng payload thay vì dùng hàm chung: ${offenders.join(', ')}`)
      .toEqual([])
  })

  it('payload luôn mang đủ ba tỷ lệ mức nhận thức', () => {
    const payload = buildCreateQuestionJobPayload({
      questionsPerChunk: 2,
      categoryId: '7',
      targetCognitiveLevel: 'AUTO',
      cognitiveMix: DEFAULT_COGNITIVE_MIX,
    })

    expect(payload).toMatchObject({
      questionsPerChunk: 2,
      categoryId: 7,
      pipelineVersion: 'GROUNDED_V4',
      cognitiveMixFoundation: DEFAULT_COGNITIVE_MIX.foundation,
      cognitiveMixApplication: DEFAULT_COGNITIVE_MIX.application,
      cognitiveMixReasoning: DEFAULT_COGNITIVE_MIX.reasoning,
    })
  })
})
