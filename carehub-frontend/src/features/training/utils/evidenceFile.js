export const MAX_EVIDENCE_FILE_SIZE_BYTES = 20 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg'])

export function getEvidenceFileError(file) {
  if (!file) return 'Vui lòng chọn tệp minh chứng.'
  if (file.size <= 0) return `Tệp "${file.name}" đang trống.`
  if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return `Tệp "${file.name}" vượt quá giới hạn 20 MB.`
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (!ALLOWED_MIME_TYPES.has(file.type)
      || !ALLOWED_EXTENSIONS.has(extension)
      || !extensionMatchesMime(extension, file.type)) {
    return `Tệp "${file.name}" không đúng định dạng PDF, JPG hoặc PNG.`
  }
  return null
}

function extensionMatchesMime(extension, mimeType) {
  if (mimeType === 'image/jpeg') return extension === 'jpg' || extension === 'jpeg'
  if (mimeType === 'image/png') return extension === 'png'
  if (mimeType === 'application/pdf') return extension === 'pdf'
  return false
}

export function formatEvidenceStorageSummary(evidence, formatSize) {
  const storedSize = Number(evidence?.fileSizeBytes || 0)
  const originalSize = Number(evidence?.originalFileSizeBytes || storedSize)
  if (evidence?.optimized && originalSize > storedSize) {
    const savedPercent = Number(evidence.savedPercent || 0).toFixed(1)
    return `Gốc ${formatSize(originalSize)} → lưu ${formatSize(storedSize)} · giảm ${savedPercent}%`
  }
  return `Lưu ${formatSize(storedSize)}`
}
