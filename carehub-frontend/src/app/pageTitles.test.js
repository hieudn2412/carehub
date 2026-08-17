import { describe, expect, it } from 'vitest'
import { getDocumentTitle } from './pageTitles.js'

describe('getDocumentTitle', () => {
  it('returns the login title', () => {
    expect(getDocumentTitle('/auth/login')).toBe(
      'Đăng nhập | Quản lý điều dưỡng Việt Đức',
    )
  })

  it('matches dynamic detail routes before their list routes', () => {
    expect(getDocumentTitle('/training/records/42')).toBe(
      'Chi tiết hồ sơ đào tạo | Quản lý điều dưỡng Việt Đức',
    )
  })

  it('uses the selected exam-management view in the title', () => {
    expect(getDocumentTitle('/admin/evaluation/exam-management', '?view=assignments')).toBe(
      'Phân công bài kiểm tra | Quản lý điều dưỡng Việt Đức',
    )
  })

  it('falls back to a section title for an unmapped route', () => {
    expect(getDocumentTitle('/staff/future-page')).toBe(
      'Không gian nhân viên | Quản lý điều dưỡng Việt Đức',
    )
  })
})
