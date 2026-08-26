import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const appMocks = vi.hoisted(() => ({
  configureHttpClientAuth: vi.fn(),
  tokenStorage: { getAccessToken: vi.fn() },
}))

vi.mock('../shared/api/httpClient.js', () => ({
  configureHttpClientAuth: appMocks.configureHttpClientAuth,
}))

vi.mock('../shared/auth/tokenStorage.js', () => ({
  tokenStorage: appMocks.tokenStorage,
}))

vi.mock('./providers.jsx', () => ({
  default: ({ children }) => <div data-testid="app-providers">{children}</div>,
}))

vi.mock('./router.jsx', () => ({
  default: () => <div>app-router</div>,
}))

vi.mock('./PageMetadata.jsx', () => ({
  default: () => <div>page-metadata</div>,
}))

import App from './App.jsx'

describe('App', () => {
  it('configures HTTP authentication and composes metadata with the router', () => {
    render(<App />)

    expect(appMocks.configureHttpClientAuth).toHaveBeenCalledWith(appMocks.tokenStorage)
    expect(screen.getByTestId('app-providers')).toContainElement(screen.getByText('page-metadata'))
    expect(screen.getByTestId('app-providers')).toContainElement(screen.getByText('app-router'))
  })
})
