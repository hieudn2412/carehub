import '@testing-library/jest-dom/vitest'
import React from 'react'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './msw/server.js'
import { tokenStorage } from '../shared/auth/tokenStorage.js'

// Vitest transforms the project's JSX with the classic runtime. Production
// modules intentionally use JSX without importing the React default, so expose
// it once before test modules are evaluated instead of doing async imports in
// individual beforeAll hooks.
globalThis.React = React

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
  tokenStorage.clear()
  window.sessionStorage.clear()
  window.localStorage.clear()
  locationStub.pathname = '/'
  vi.clearAllMocks()
})

afterAll(() => {
  server.close()
})
