import { describe, expect, it } from 'vitest'
import {
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  formatEvidenceStorageSummary,
  getEvidenceFileError,
} from './evidenceFile.js'

// Backend enforces 5 MB (TrainingDomainValidator.MAX_EVIDENCE_BYTES) and SRS BR-04 / FR-017
// also say 5 MB, but this module allows 20 MB. See D4 in SRS-CODE-DIVERGENCE.md — the
// L1-BV-05 case below asserts the SRS limit and is expected to FAIL until D4 is resolved.
const FIVE_MB = 5 * 1024 * 1024

function evidence(name, type, size) {
  return { name, type, size }
}

describe('getEvidenceFileError', () => {
  it('L1-FE-13 | EP-Invalid: no file selected → prompt to choose a file', () => {
    expect(getEvidenceFileError(null)).toBe('Vui lòng chọn tệp minh chứng.')
  })

  it('L1-FE-14 | BVA-Min: size = 0 → rejected as empty', () => {
    expect(getEvidenceFileError(evidence('cert.pdf', 'application/pdf', 0)))
      .toBe('Tệp "cert.pdf" đang trống.')
  })

  it('L1-FE-15 | BVA-Max: size = 20 MB exactly → accepted (last valid byte count)', () => {
    expect(getEvidenceFileError(
      evidence('certificate.jpg', 'image/jpeg', MAX_EVIDENCE_FILE_SIZE_BYTES),
    )).toBeNull()
  })

  it('L1-FE-16 | BVA-Max+1: size = 20 MB + 1 → rejected with the 20 MB message', () => {
    expect(getEvidenceFileError(
      evidence('certificate.jpg', 'image/jpeg', MAX_EVIDENCE_FILE_SIZE_BYTES + 1),
    )).toMatch(/20 MB/)
  })

  it('L1-FE-17 | EP-Invalid: extension does not match MIME type → rejected', () => {
    expect(getEvidenceFileError(evidence('certificate.pdf', 'image/jpeg', 1024)))
      .toMatch(/không đúng định dạng/)
  })

  it.each([
    ['certificate.pdf', 'application/pdf'],
    ['certificate.png', 'image/png'],
    ['certificate.jpg', 'image/jpeg'],
    ['certificate.jpeg', 'image/jpeg'],
  ])('L1-FE-18 | EP-Valid: %s with %s → accepted', (name, type) => {
    expect(getEvidenceFileError(evidence(name, type, 1024))).toBeNull()
  })

  it('L1-FE-22 | BVA-Max+1: size = 5 MB + 1 must be rejected per SRS BR-04 / FR-017 / BV-02 (D4)', () => {
    // EXPECTED TO FAIL until D4 is resolved: this module caps at 20 MB, so a 5 MB + 1 file is
    // accepted here and then rejected by the backend (TrainingDomainValidator, 5 MB).
    const error = getEvidenceFileError(evidence('certificate.jpg', 'image/jpeg', FIVE_MB + 1))

    expect(
      error,
      'SRS BR-04/FR-017 cap evidence at 5 MB, so this file must be rejected client-side',
    ).not.toBeNull()
  })
})

describe('formatEvidenceStorageSummary', () => {
  it('L1-FE-19 | BC-TRUE: optimized and original > stored → shows the saving', () => {
    expect(formatEvidenceStorageSummary({
      originalFileSizeBytes: 10_000,
      fileSizeBytes: 4_000,
      optimized: true,
      savedPercent: 60,
    }, (value) => `${value} B`)).toBe('Gốc 10000 B → lưu 4000 B · giảm 60.0%')
  })

  it('L1-FE-20 | BC-FALSE: not optimized → shows the stored size only', () => {
    expect(formatEvidenceStorageSummary({
      fileSizeBytes: 4_000,
      optimized: false,
    }, (value) => `${value} B`)).toBe('Lưu 4000 B')
  })

  it('L1-FE-21 | BC-FALSE: optimized but original == stored → no saving shown', () => {
    expect(formatEvidenceStorageSummary({
      originalFileSizeBytes: 4_000,
      fileSizeBytes: 4_000,
      optimized: true,
      savedPercent: 0,
    }, (value) => `${value} B`)).toBe('Lưu 4000 B')
  })
})
