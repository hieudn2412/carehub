import { describe, expect, it } from 'vitest'
import nginxConfig from '../../nginx.conf?raw'

describe('frontend static hosting', () => {
  it('buộc HTML revalidate để nhận bundle mới sau deploy', () => {
    expect(nginxConfig).toMatch(
      /location = \/index\.html\s*\{[\s\S]*?Cache-Control "no-cache, max-age=0, must-revalidate"/,
    )
  })

  it('cache asset có hash và trả 404 cho asset không tồn tại', () => {
    expect(nginxConfig).toMatch(/location \/assets\/\s*\{[\s\S]*?try_files \$uri =404;/)
    expect(nginxConfig).toMatch(
      /location \/assets\/\s*\{[\s\S]*?Cache-Control "public, max-age=31536000, immutable"/,
    )
  })
})
