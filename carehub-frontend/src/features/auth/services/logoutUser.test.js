import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_EVENTS } from '../../../shared/auth/authEvents.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { logoutUser } from './logoutUser.js'

const logout = vi.hoisted(() => vi.fn())
vi.mock('../api/authApi.js', () => ({ authApi: { logout } }))

describe('logoutUser', () => {
  beforeEach(() => {
    logout.mockReset()
    delete globalThis.BroadcastChannel
  })

  it('clears session, emits local/cross-tab events after server logout', async () => {
    const listener = vi.fn()
    const channel = { postMessage: vi.fn(), close: vi.fn() }
    globalThis.BroadcastChannel = vi.fn(() => channel)
    window.addEventListener(AUTH_EVENTS.signedOut, listener)
    tokenStorage.setAccessToken('token')
    logout.mockResolvedValue({})

    await logoutUser()

    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'SIGNED_OUT' })
    expect(channel.close).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EVENTS.signedOut, listener)
  })

  it('keeps the local session and returns a user-safe error when server logout fails', async () => {
    tokenStorage.setAccessToken('token')
    logout.mockRejectedValue(new Error('offline'))

    await expect(logoutUser()).rejects.toThrow('Không thể đăng xuất do máy chủ không phản hồi')
    expect(tokenStorage.getAccessToken()).toBe('token')
  })
})
