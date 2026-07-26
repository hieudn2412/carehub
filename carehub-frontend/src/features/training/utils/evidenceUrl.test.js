import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveEvidenceUrl } from './evidenceUrl.js'

test('giữ nguyên URL minh chứng tuyệt đối', () => {
  assert.equal(resolveEvidenceUrl('https://cdn.example.com/file.png'), 'https://cdn.example.com/file.png')
})

test('ghép URL tương đối với origin API', () => {
  assert.equal(resolveEvidenceUrl('/api/v1/files/1'), 'http://localhost:8081/api/v1/files/1')
})

test('trả chuỗi rỗng khi URL rỗng', () => {
  assert.equal(resolveEvidenceUrl(''), '')
  assert.equal(resolveEvidenceUrl(null), '')
})
