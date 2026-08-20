import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authApi } from '../api/authApi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { AUTH_BROADCAST_CHANNEL, AUTH_EVENTS } from '../../../shared/auth/authEvents.js'

const AuthContext = createContext(null)

const AUTH_STATUS = {
  checking: 'checking',
  authenticated: 'authenticated',
  unauthenticated: 'unauthenticated',
  unavailable: 'unavailable',
}

function isInvalidSessionError(error) {
  return error?.response?.status === 401 || error?.response?.status === 403
}

function authStateFromResponse(authData) {
  const accessToken = authData?.accessToken
  if (!accessToken) {
    throw new Error('Phản hồi đăng nhập không hợp lệ')
  }

  tokenStorage.setAccessToken(accessToken)
  tokenStorage.setRequiresFirstLoginSetup(Boolean(authData?.requiresFirstLoginSetup))

  return {
    status: AUTH_STATUS.authenticated,
    accessToken,
    requiresFirstLoginSetup: Boolean(authData?.requiresFirstLoginSetup),
  }
}

function clearMemorySession() {
  tokenStorage.clear()
  return {
    status: AUTH_STATUS.unauthenticated,
    accessToken: null,
    requiresFirstLoginSetup: false,
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: AUTH_STATUS.checking,
    accessToken: null,
    requiresFirstLoginSetup: false,
  })
  const broadcastRef = useRef(null)

  const acceptAuthResponse = useCallback((authData) => {
    const nextState = authStateFromResponse(authData)
    setState(nextState)
    return nextState
  }, [])

  const clearAuthState = useCallback(() => {
    setState(clearMemorySession())
  }, [])

  const refreshSession = useCallback(async () => {
    setState((current) => ({
      ...current,
      status: current.status === AUTH_STATUS.authenticated
        ? AUTH_STATUS.authenticated
        : AUTH_STATUS.checking,
    }))

    try {
      const response = await authApi.refreshToken()
      acceptAuthResponse(response.data?.data)
      return true
    } catch (error) {
      if (isInvalidSessionError(error)) {
        setState(clearMemorySession())
        return false
      }

      setState((current) => ({
        ...current,
        status: AUTH_STATUS.unavailable,
      }))
      return false
    }
  }, [acceptAuthResponse])

  const broadcastSignedOut = useCallback(() => {
    broadcastRef.current?.postMessage({ type: 'SIGNED_OUT' })
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastRef.current = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
      broadcastRef.current.onmessage = (event) => {
        if (event.data?.type === 'SIGNED_OUT') {
          setState(clearMemorySession())
        }
      }
    }

    const handleLocalSignOut = () => setState(clearMemorySession())
    const handleSessionInvalid = () => setState(clearMemorySession())
    window.addEventListener(AUTH_EVENTS.signedOut, handleLocalSignOut)
    window.addEventListener(AUTH_EVENTS.sessionInvalid, handleSessionInvalid)

    return () => {
      window.removeEventListener(AUTH_EVENTS.signedOut, handleLocalSignOut)
      window.removeEventListener(AUTH_EVENTS.sessionInvalid, handleSessionInvalid)
      broadcastRef.current?.close()
      broadcastRef.current = null
    }
  }, [])

  const value = useMemo(() => ({
    ...state,
    isChecking: state.status === AUTH_STATUS.checking,
    isAuthenticated: state.status === AUTH_STATUS.authenticated,
    isUnavailable: state.status === AUTH_STATUS.unavailable,
    acceptAuthResponse,
    clearAuthState,
    refreshSession,
    broadcastSignedOut,
  }), [acceptAuthResponse, broadcastSignedOut, clearAuthState, refreshSession, state])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export { AUTH_STATUS }
