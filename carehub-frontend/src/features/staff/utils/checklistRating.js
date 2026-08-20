/**
 * Ánh xạ điểm thô của một bước trong bảng kiểm sang mức đánh giá hiển thị cho nhân viên.
 *
 * Backend trả về `scoreBreakdown[].baseScore` là điểm của phương án mà người chấm đã chọn
 * (xem FormScoreCalculator). Thang điểm chuẩn của bảng kiểm CareHub:
 *
 *   -1   Không thực hiện
 *    0   Thực hiện nhưng không đạt
 *    1   Đạt
 *    1.2 Tốt
 *    1.5 Rất tốt
 *
 * Nhãn thật của phương án nằm trong `answers[].value.label`, nên khi có nhãn đó thì ưu tiên
 * dùng, vì mỗi bảng kiểm có thể tự đặt tên phương án khác thang chuẩn. Bảng dưới đây chỉ là
 * phương án dự phòng khi câu hỏi không phải dạng chọn một phương án.
 *
 * Lưu ý: câu hỏi chưa được trả lời cũng cho baseScore = 0, giống hệt "Thực hiện nhưng không
 * đạt". Chỉ có thể phân biệt bằng cách kiểm tra `answers[]` có chứa questionKey đó hay không.
 */

export const RATING_LEVELS = [
  { score: -1, label: 'Không thực hiện', tone: 'critical' },
  { score: 0, label: 'Thực hiện nhưng không đạt', tone: 'failed' },
  { score: 1, label: 'Đạt', tone: 'passed' },
  { score: 1.2, label: 'Tốt', tone: 'good' },
  { score: 1.5, label: 'Rất tốt', tone: 'excellent' },
]

export const UNANSWERED_RATING = { label: 'Chưa trả lời', tone: 'unanswered' }

const TONE_BY_LABEL = new Map(
  RATING_LEVELS.map(level => [level.label.toLowerCase(), level.tone]),
)

/** Sai số cho phép khi so khớp điểm thập phân (backend serialize dạng "1.2000"). */
const SCORE_EPSILON = 0.0001

/**
 * Tìm mức đánh giá theo điểm thô. Trả về `null` khi điểm không khớp thang chuẩn
 * (bảng kiểm tự cấu hình thang điểm riêng).
 */
export function ratingByScore(baseScore) {
  // Number(null) và Number('') đều ra 0, sẽ bị hiểu nhầm thành "Thực hiện nhưng không đạt".
  if (baseScore === null || baseScore === undefined || baseScore === '') return null
  const score = Number(baseScore)
  if (!Number.isFinite(score)) return null
  return RATING_LEVELS.find(level => Math.abs(level.score - score) < SCORE_EPSILON) || null
}

/**
 * Lấy nhãn phương án mà người chấm đã chọn từ một phần tử `answers[]`.
 * Trả về chuỗi rỗng khi câu trả lời không phải dạng chọn phương án.
 */
export function answerLabel(answer) {
  const value = answer?.value
  if (!value || typeof value !== 'object') return ''
  if (typeof value.label === 'string' && value.label.trim()) return value.label.trim()
  if (Array.isArray(value.labels)) {
    const labels = value.labels.filter(label => typeof label === 'string' && label.trim())
    if (labels.length) return labels.join(', ')
  }
  return ''
}

/** Gom `answers[]` thành map theo questionKey để tra cứu khi render breakdown. */
export function indexAnswersByQuestion(answers) {
  const index = new Map()
  for (const answer of answers || []) {
    if (answer?.questionKey != null) index.set(String(answer.questionKey), answer)
  }
  return index
}

/**
 * Mức đánh giá hiển thị cho một bước của bảng kiểm.
 *
 * @param {object} step một phần tử của `scoreBreakdown`
 * @param {object|undefined} answer phần tử `answers[]` cùng questionKey, nếu có
 * @returns {{ label: string, tone: string, answered: boolean }}
 */
export function resolveStepRating(step, answer) {
  if (!answer) return { ...UNANSWERED_RATING, answered: false }

  const label = answerLabel(answer)
  if (label) {
    return {
      label,
      tone: TONE_BY_LABEL.get(label.toLowerCase())
        || ratingByScore(step?.baseScore)?.tone
        || 'neutral',
      answered: true,
    }
  }

  const rating = ratingByScore(step?.baseScore)
  return rating
    ? { label: rating.label, tone: rating.tone, answered: true }
    : { label: 'Đã ghi nhận', tone: 'neutral', answered: true }
}
