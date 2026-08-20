import { describe, expect, it, vi } from 'vitest'
import { prepareCriticalStyles } from './criticalStyles.js'

describe('prepareCriticalStyles', () => {
  it('đợi CSS xác thực tải xong trước khi cho phép render', async () => {
    let finishLoading
    const loader = vi.fn(() => new Promise((resolve) => {
      finishLoading = resolve
    }))

    const result = prepareCriticalStyles(loader)

    expect(loader).toHaveBeenCalledOnce()
    finishLoading()
    await expect(result).resolves.toBe(true)
  })

  it('không chặn ứng dụng khi asset CSS tạm thời tải thất bại', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('CSS unavailable'))

    await expect(prepareCriticalStyles(loader)).resolves.toBe(false)
  })
})
