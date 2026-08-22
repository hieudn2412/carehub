import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, server } from '../../test/msw/server.js'
import { configureHttpClientAuth, httpClient } from './httpClient.js'

const session = {
  accessToken: null,
  requiresFirstLoginSetup: false,
}

const tokenStorage = {
  clear() {
    session.accessToken = null
    session.requiresFirstLoginSetup = false
  },
  getAccessToken: () => session.accessToken,
  setAccessToken: value => { session.accessToken = value || null },
  setRequiresFirstLoginSetup: value => { session.requiresFirstLoginSetup = Boolean(value) },
}

configureHttpClientAuth(tokenStorage)

/**
 * L1 unit tests — sheet Frontend, Test ID prefix L1-FE (IDs 01–12 live here).
 *
 * Traces AC-01-01, NAC-01-01, BR-30 and TDS Part 2.2 (silent refresh). The response interceptor
 * guard is `!originalRequest || status !== 401 || _retry || shouldIgnoreRefresh(url)`, so each
 * sub-condition is driven independently.
 */
describe('httpClient request interceptor', () => {
  beforeEach(() => {
    tokenStorage.clear()
  })

  it('L1-FE-01 | BC-TRUE: an access token in session storage is sent as a Bearer header', async () => {
    tokenStorage.setAccessToken('access-1')
    let seenAuthorization = null
    server.use(http.get(`${API_BASE_URL}/orders`, ({ request }) => {
      seenAuthorization = request.headers.get('Authorization')
      return HttpResponse.json({ data: [] })
    }))

    await httpClient.get('/orders')

    expect(seenAuthorization).toBe('Bearer access-1')
  })

  it('L1-FE-02 | BC-FALSE: no access token → no Authorization header is added', async () => {
    let seenAuthorization = 'unset'
    server.use(http.get(`${API_BASE_URL}/orders`, ({ request }) => {
      seenAuthorization = request.headers.get('Authorization')
      return HttpResponse.json({ data: [] })
    }))

    await httpClient.get('/orders')

    expect(seenAuthorization).toBeNull()
  })

  it('L1-FE-03 | CC-FALSE: an explicit Authorization header is not overwritten', async () => {
    tokenStorage.setAccessToken('access-1')
    let seenAuthorization = null
    server.use(http.get(`${API_BASE_URL}/orders`, ({ request }) => {
      seenAuthorization = request.headers.get('Authorization')
      return HttpResponse.json({ data: [] })
    }))

    await httpClient.get('/orders', { headers: { Authorization: 'Bearer explicit' } })

    expect(seenAuthorization).toBe('Bearer explicit')
  })

  it('does not send a stale access token to the public login endpoint', async () => {
    tokenStorage.setAccessToken('expired-access-token')
    let seenAuthorization = 'unset'
    server.use(http.post(`${API_BASE_URL}/auth/login`, ({ request }) => {
      seenAuthorization = request.headers.get('Authorization')
      return HttpResponse.json({
        data: {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
        },
      })
    }))

    await httpClient.post('/auth/login', {
      employeeCode: 'ADMIN',
      password: 'secret',
    })

    expect(seenAuthorization).toBeNull()
  })
})

describe('httpClient response interceptor — silent refresh', () => {
  beforeEach(() => {
    tokenStorage.clear()
  })

  it('L1-FE-04 | BC-TRUE: 401 → refresh succeeds → original request is retried with the new token', async () => {
    tokenStorage.setAccessToken('stale')
    let ordersCalls = 0
    let refreshCalls = 0
    let retryAuthorization = null
    let refreshBody = null

    server.use(
      http.get(`${API_BASE_URL}/orders`, ({ request }) => {
        ordersCalls += 1
        if (ordersCalls === 1) {
          return new HttpResponse(null, { status: 401 })
        }
        retryAuthorization = request.headers.get('Authorization')
        return HttpResponse.json({ data: ['ok'] })
      }),
      http.post(`${API_BASE_URL}/auth/refresh-token`, async ({ request }) => {
        refreshCalls += 1
        refreshBody = await request.json()
        return HttpResponse.json({
          data: { accessToken: 'fresh', refreshToken: 'deprecated-refresh-2', requiresFirstLoginSetup: false },
        })
      }),
    )

    const response = await httpClient.get('/orders')

    expect(refreshCalls).toBe(1)
    expect(refreshBody).toEqual({})
    expect(ordersCalls).toBe(2)
    expect(retryAuthorization).toBe('Bearer fresh')
    expect(response.data.data).toEqual(['ok'])
    expect(tokenStorage.getAccessToken()).toBe('fresh')
  })

  it('L1-FE-05 | BC-FALSE + Negative: 401 → refresh fails → session cleared and redirected to login', async () => {
    tokenStorage.setAccessToken('stale')
    server.use(
      http.get(`${API_BASE_URL}/orders`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => new HttpResponse(null, { status: 401 })),
    )

    await expect(httpClient.get('/orders')).rejects.toBeDefined()

    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(window.location.replace).toHaveBeenCalledWith('/auth/login')
  })

  it('L1-FE-06 | Cookie session: 401 with no refresh token in storage still attempts refresh', async () => {
    tokenStorage.setAccessToken('stale')
    let refreshCalls = 0
    let retryAuthorization = null
    server.use(
      http.get(`${API_BASE_URL}/orders`, ({ request }) => {
        if (refreshCalls > 0) {
          retryAuthorization = request.headers.get('Authorization')
          return HttpResponse.json({ data: 'ok' })
        }
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => {
        refreshCalls += 1
        return HttpResponse.json({ data: { accessToken: 'fresh' } })
      }),
    )

    await expect(httpClient.get('/orders')).resolves.toMatchObject({ data: { data: 'ok' } })

    expect(refreshCalls).toBe(1)
    expect(retryAuthorization).toBe('Bearer fresh')
    expect(window.location.replace).not.toHaveBeenCalled()
  })

  it('L1-FE-07 | EP-Invalid + Negative: refresh response without accessToken → treated as a failure', async () => {
    tokenStorage.setAccessToken('stale')
    server.use(
      http.get(`${API_BASE_URL}/orders`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => HttpResponse.json({ data: {} })),
    )

    await expect(httpClient.get('/orders')).rejects.toThrow(/Refresh token response is invalid/)

    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(window.location.replace).toHaveBeenCalledWith('/auth/login')
  })

  // /auth/refresh-token is deliberately NOT in this list: registering a counting handler for it
  // while the request under test also targets it means the 401 handler shadows the counter, so the
  // assertion could never fail. That path gets its own falsifiable case in L1-FE-53.
  it.each([
    '/auth/login',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
  ])('L1-FE-08 | CC-TRUE: a 401 on %s never triggers a refresh', async (path) => {
    let refreshCalls = 0
    server.use(
      http.post(`${API_BASE_URL}${path}`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => {
        refreshCalls += 1
        return HttpResponse.json({ data: { accessToken: 'fresh' } })
      }),
    )

    await expect(httpClient.post(path, {})).rejects.toBeDefined()

    expect(refreshCalls).toBe(0)
  })

  it('L1-FE-53 | CC-TRUE: a 401 from /auth/refresh-token itself is not retried', async () => {
    let refreshCalls = 0
    server.use(http.post(`${API_BASE_URL}/auth/refresh-token`, () => {
      refreshCalls += 1
      return new HttpResponse(null, { status: 401 })
    }))

    await expect(httpClient.post('/auth/refresh-token', {}))
      .rejects.toBeDefined()

    // Exactly one call: the ignore-list keeps the interceptor from refreshing the refresh call.
    // A single counting handler makes this falsifiable - drop the guard and this becomes 2.
    expect(refreshCalls).toBe(1)
  })

  it('L1-FE-09 | CC-TRUE: a retried request that 401s again is rejected instead of looping', async () => {
    tokenStorage.setAccessToken('stale')
    let ordersCalls = 0
    let refreshCalls = 0
    server.use(
      http.get(`${API_BASE_URL}/orders`, () => {
        ordersCalls += 1
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => {
        refreshCalls += 1
        return HttpResponse.json({ data: { accessToken: `fresh-${refreshCalls}` } })
      }),
    )

    await expect(httpClient.get('/orders')).rejects.toBeDefined()

    // One refresh, one retry — the _retry flag stops a second refresh cycle.
    expect(refreshCalls).toBe(1)
    expect(ordersCalls).toBe(2)
  })

  it('L1-FE-10 | CC-FALSE: a non-401 error is passed through untouched', async () => {
    tokenStorage.setAccessToken('access-1')
    let refreshCalls = 0
    server.use(
      http.get(`${API_BASE_URL}/orders`, () => new HttpResponse(null, { status: 500 })),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => {
        refreshCalls += 1
        return HttpResponse.json({ data: { accessToken: 'fresh' } })
      }),
    )

    await expect(httpClient.get('/orders')).rejects.toMatchObject({
      response: { status: 500 },
    })
    expect(refreshCalls).toBe(0)
    expect(tokenStorage.getAccessToken()).toBe('access-1')
  })

  it('L1-FE-11 | State: two concurrent 401s share a single refresh call (dedup)', async () => {
    tokenStorage.setAccessToken('stale')
    const callCounts = { orders: 0, exams: 0 }
    let refreshCalls = 0

    server.use(
      http.get(`${API_BASE_URL}/orders`, () => {
        callCounts.orders += 1
        return callCounts.orders === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ data: 'orders' })
      }),
      http.get(`${API_BASE_URL}/exams`, () => {
        callCounts.exams += 1
        return callCounts.exams === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ data: 'exams' })
      }),
      http.post(`${API_BASE_URL}/auth/refresh-token`, async () => {
        refreshCalls += 1
        return HttpResponse.json({ data: { accessToken: 'fresh', refreshToken: 'deprecated-refresh-2' } })
      }),
    )

    const [orders, exams] = await Promise.all([
      httpClient.get('/orders'),
      httpClient.get('/exams'),
    ])

    expect(orders.data.data).toBe('orders')
    expect(exams.data.data).toBe('exams')
    expect(refreshCalls).toBe(1)
  })

  it('L1-FE-12 | BC-FALSE: already on /auth/login → session cleared without a redundant redirect', async () => {
    window.location.pathname = '/auth/login'
    tokenStorage.setAccessToken('stale')
    server.use(
      http.get(`${API_BASE_URL}/orders`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => new HttpResponse(null, { status: 401 })),
    )

    await expect(httpClient.get('/orders')).rejects.toBeDefined()

    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(window.location.replace).not.toHaveBeenCalled()
  })

  it('Network/5xx refresh failures keep the in-memory session so the app can show retry UI', async () => {
    tokenStorage.setAccessToken('stale')
    server.use(
      http.get(`${API_BASE_URL}/orders`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_BASE_URL}/auth/refresh-token`, () => new HttpResponse(null, { status: 503 })),
    )

    await expect(httpClient.get('/orders')).rejects.toMatchObject({
      response: { status: 503 },
    })

    expect(tokenStorage.getAccessToken()).toBe('stale')
    expect(window.location.replace).not.toHaveBeenCalled()
  })
})

// Guard against the suite silently losing its jsdom location stub.
it('L1-FE-23 | State: window.location.replace is stubbed so redirects are observable', () => {
  expect(vi.isMockFunction(window.location.replace)).toBe(true)
})

// Without this, every assertion above would stay green under any VITE_API_BASE_URL, because the MSW
// handlers derive their URLs from the same expression the client does. This pins the resolved base
// so a config change cannot silently move the whole harness.
it('L1-FE-54 | State: the client baseURL matches the configured API base', () => {
  expect(httpClient.defaults.baseURL).toBe(API_BASE_URL)
  expect(API_BASE_URL).toBe(import.meta.env.VITE_API_BASE_URL || '/api/v1')
})
