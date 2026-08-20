import { authApi } from '../api/authApi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { AUTH_BROADCAST_CHANNEL, AUTH_EVENTS, dispatchAuthEvent } from '../../../shared/auth/authEvents.js'

export async function logoutUser() {
  try {
    await authApi.logout()
  } catch {
    throw new Error('Không thể đăng xuất do máy chủ không phản hồi. Vui lòng thử lại.')
  }

  tokenStorage.clear()
  dispatchAuthEvent(AUTH_EVENTS.signedOut)

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
    channel.postMessage({ type: 'SIGNED_OUT' })
    channel.close()
  }
}
