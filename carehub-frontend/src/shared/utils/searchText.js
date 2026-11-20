export function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesSearch(value, keyword) {
  return normalizeSearchText(value).includes(normalizeSearchText(keyword))
}
