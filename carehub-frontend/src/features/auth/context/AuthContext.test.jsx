import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_EVENTS } from '../../../shared/auth/authEvents.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { AuthProvider, useAuth } from './AuthContext.jsx'

const refreshToken = vi.hoisted(() => vi.fn())

vi.mock('../api/authApi.js', () => ({
  authApi: { refreshToken },
}))

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <output data-testid="status">
        {auth.isChecking ? 'checking' : auth.isUnavailable ? 'unavailable' : auth.isAuthenticated ? 'authenticated' : 'unauthenticated'}
      </output>
      <output data-testid="token">{auth.accessToken || 'none'}</output>
      <output data-testid="first-login">{String(auth.requiresFirstLoginSetup)}</output>
      <button type="button" onClick={() => auth.acceptAuthResponse({ accessToken: 'manual-token', requiresFirstLoginSetup: true })}>
        accept
      </button>
      <button type="button" onClick={auth.clearAuthState}>clear</button>
      <button type="button" onClick={auth.broadcastSignedOut}>broadcast</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    refreshToken.mockReset()
    delete globalThis.BroadcastChannel
  })

  it('restores an authenticated session and stores first-login state', async () => {
    refreshToken.mockResolvedValue({
      data: { data: { accessToken: 'restored-token', requiresFirstLoginSetup: true } },
    })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('token')).toHaveTextContent('restored-token')
    expect(screen.getByTestId('first-login')).toHaveTextContent('true')
    expect(tokenStorage.getAccessToken()).toBe('restored-token')
  })

  it.each([401, 403])('clears an invalid session after a %s response', async (status) => {
    tokenStorage.setAccessToken('stale-token')
    refreshToken.mockRejectedValue({ response: { status } })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(tokenStorage.getAccessToken()).toBeNull()
  })

  it('keeps a recoverable unavailable state for non-auth refresh failures', async () => {
    refreshToken.mockRejectedValue(new Error('network down'))
    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'))
  })

  it('accepts and clears an auth response through its public context actions', async () => {
    refreshToken.mockRejectedValue({ response: { status: 401 } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    act(() => screen.getByRole('button', { name: 'accept' }).click())
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(tokenStorage.getAccessToken()).toBe('manual-token')

    act(() => screen.getByRole('button', { name: 'clear' }).click())
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(tokenStorage.getAccessToken()).toBeNull()
  })

  it.each([AUTH_EVENTS.signedOut, AUTH_EVENTS.sessionInvalid])(
    'clears auth state when the %s event is received',
    async (eventName) => {
      refreshToken.mockResolvedValue({ data: { data: { accessToken: 'active-token' } } })
      render(<AuthProvider><Probe /></AuthProvider>)
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

      act(() => window.dispatchEvent(new CustomEvent(eventName)))
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    },
  )

  it('uses BroadcastChannel for cross-tab sign-out and cleans it up', async () => {
    const channel = { postMessage: vi.fn(), close: vi.fn(), onmessage: null }
    globalThis.BroadcastChannel = vi.fn(() => channel)
    refreshToken.mockResolvedValue({ data: { data: { accessToken: 'active-token' } } })

    const { unmount } = render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    act(() => screen.getByRole('button', { name: 'broadcast' }).click())
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'SIGNED_OUT' })

    act(() => channel.onmessage({ data: { type: 'SIGNED_OUT' } }))
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')

    unmount()
    expect(channel.close).toHaveBeenCalledTimes(1)
  })

  it('rejects an authentication response without an access token', async () => {
    refreshToken.mockResolvedValue({ data: { data: {} } })
    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'))
  })

  it('requires consumers to be rendered inside AuthProvider', () => {
    expect(() => render(<Probe />)).toThrow('useAuth must be used within AuthProvider')
  })
})
