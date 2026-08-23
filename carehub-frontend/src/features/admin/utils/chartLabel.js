/**
 * Ngắt nhãn trục hoành của biểu đồ cột thành tối đa vài dòng ngắn.
 *
 * Tên khoa, lĩnh vực chuyên môn và hình thức đào tạo đều là chuỗi tiếng Việt dài
 * ("Chăm sóc người bệnh truyền nhiễm", "Ứng dụng CNTT & Quản lý dữ liệu điều dưỡng").
 * Để nguyên một dòng thì 12 nhãn nghiêng sẽ chồng lên nhau, nên nhãn được ngắt theo từ và
 * cắt bằng dấu … khi vẫn còn quá dài; tên đầy đủ vẫn xem được qua tooltip của tick.
 */

export const CHART_LABEL_MAX_CHARS = 10
export const CHART_LABEL_MAX_LINES = 2

/** Cắt nhỏ một từ dài hơn cả dòng, nếu không nhãn sẽ phình ra và đè sang cột bên cạnh. */
function splitLongWord(word, maxCharsPerLine) {
  const chunks = []
  for (let index = 0; index < word.length; index += maxCharsPerLine) {
    chunks.push(word.slice(index, index + maxCharsPerLine))
  }
  return chunks
}

export function wrapChartLabel(
  value,
  maxCharsPerLine = CHART_LABEL_MAX_CHARS,
  maxLines = CHART_LABEL_MAX_LINES,
) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean)
    .flatMap((word) => (word.length > maxCharsPerLine ? splitLongWord(word, maxCharsPerLine) : word))
  if (!words.length) return ['Chưa xác định']

  const lines = []
  for (const word of words) {
    const current = lines.at(-1)
    if (current && `${current} ${word}`.length <= maxCharsPerLine) {
      lines[lines.length - 1] = `${current} ${word}`
    } else {
      lines.push(word)
    }
  }

  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxCharsPerLine - 1).trimEnd()}…`
  return kept
}
