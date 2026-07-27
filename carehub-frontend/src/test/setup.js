import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './msw/server.js'

// jsdom throws "Not implemented: navigation" on window.location.replace, which
// httpClient calls in clearSessionAndRedirectToLogin(). Swap in a minimal stub so
// tests can assert the redirect instead of crashing on it.
const locationStub = {
  pathname: '/',
  href: 'http://localhost/',
  origin: 'http://localhost',
  replace: vi.fn(),
  assign: vi.fn(),
  reload: vi.fn(),
}

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: locationStub,
  })
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  window.sessionStorage.clear()
  window.localStorage.clear()
  locationStub.pathname = '/'
  vi.clearAllMocks()
})

afterAll(() => {
  server.close()
})
