import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearInflightGetRequestsForTests,
  createInflightDedupeAdapter,
} from './inflightRequestDedupe.js'

function deferred() {
  let resolve
  const promise = new Promise((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

describe('in-flight GET request dedupe', () => {
  afterEach(() => clearInflightGetRequestsForTests())

  it('shares identical concurrent GET requests without caching completed responses', async () => {
    const first = deferred()
    const baseAdapter = vi.fn(() => first.promise)
    const adapter = createInflightDedupeAdapter(baseAdapter)
    const config = { method: 'get', baseURL: '/api/v1', url: '/forms', params: { page: 0 } }

    const requestA = adapter(config)
    const requestB = adapter(config)

    expect(baseAdapter).toHaveBeenCalledTimes(1)
    first.resolve({ status: 200, data: { data: [] } })
    await expect(Promise.all([requestA, requestB])).resolves.toHaveLength(2)

    baseAdapter.mockResolvedValueOnce({ status: 200, data: { data: ['fresh'] } })
    await adapter(config)
    expect(baseAdapter).toHaveBeenCalledTimes(2)
  })

  it('keeps requests with different params or an explicit opt-out independent', async () => {
    const baseAdapter = vi.fn(async (config) => ({ status: 200, data: config.params }))
    const adapter = createInflightDedupeAdapter(baseAdapter)

    await Promise.all([
      adapter({ method: 'get', url: '/forms', params: { page: 0 } }),
      adapter({ method: 'get', url: '/forms', params: { page: 1 } }),
      adapter({ method: 'get', url: '/forms', params: { page: 0 }, dedupe: false }),
    ])

    expect(baseAdapter).toHaveBeenCalledTimes(3)
  })

  it('never deduplicates mutations', async () => {
    const first = deferred()
    const baseAdapter = vi.fn(() => first.promise)
    const adapter = createInflightDedupeAdapter(baseAdapter)
    const config = { method: 'post', url: '/form-submissions', data: { id: 1 } }

    const requests = [adapter(config), adapter(config)]
    expect(baseAdapter).toHaveBeenCalledTimes(2)
    first.resolve({ status: 200, data: {} })
    await Promise.all(requests)
  })

  it('keeps cancellable requests independent', async () => {
    const baseAdapter = vi.fn(async () => ({ status: 200, data: {} }))
    const adapter = createInflightDedupeAdapter(baseAdapter)

    await Promise.all([
      adapter({ method: 'get', url: '/forms', signal: new AbortController().signal }),
      adapter({ method: 'get', url: '/forms', signal: new AbortController().signal }),
    ])

    expect(baseAdapter).toHaveBeenCalledTimes(2)
  })
})
