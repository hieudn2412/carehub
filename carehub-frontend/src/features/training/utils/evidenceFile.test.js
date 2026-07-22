import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  formatEvidenceStorageSummary,
  getEvidenceFileError,
} from './evidenceFile.js'

test('accepts a supported evidence file at the 20 MB boundary', () => {
  const error = getEvidenceFileError({
    name: 'certificate.jpg',
    type: 'image/jpeg',
    size: MAX_EVIDENCE_FILE_SIZE_BYTES,
  })

  assert.equal(error, null)
})

test('rejects evidence above 20 MB and mismatched extensions', () => {
  assert.match(getEvidenceFileError({
    name: 'certificate.jpg',
    type: 'image/jpeg',
    size: MAX_EVIDENCE_FILE_SIZE_BYTES + 1,
  }), /20 MB/)
  assert.match(getEvidenceFileError({
    name: 'certificate.pdf',
    type: 'image/jpeg',
    size: 1024,
  }), /không đúng định dạng/)
})

test('formats optimization savings returned by the API', () => {
  const summary = formatEvidenceStorageSummary({
    originalFileSizeBytes: 10_000,
    fileSizeBytes: 4_000,
    optimized: true,
    savedPercent: 60,
  }, (value) => `${value} B`)

  assert.equal(summary, 'Gốc 10000 B → lưu 4000 B · giảm 60.0%')
})
