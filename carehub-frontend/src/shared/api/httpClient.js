import axios from 'axios'
import { AUTH_EVENTS, dispatchAuthEvent } from '../auth/authEvents.js'
import { createInflightDedupeAdapter } from './inflightRequestDedupe.js'

const emptyTokenStorage = {
  clear() {},
  getAccessToken: () => null,
  setAccessToken() {},
  setRequiresFirstLoginSetup() {},
}

let tokenStorage = emptyTokenStorage

export function configureHttpClientAuth(storage) {
  tokenStorage = storage || emptyTokenStorage
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
let refreshTokenRequest = null

const REFRESH_IGNORED_PATHS = [
  '/auth/login',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/verify-reset-otp',
  '/auth/reset-password',
]

function shouldIgnoreRefresh(url = '') {
  return REFRESH_IGNORED_PATHS.some((path) => url.endsWith(path) || url.includes(path))
}

function clearSessionAndRedirectToLogin() {
  tokenStorage.clear()
  dispatchAuthEvent(AUTH_EVENTS.sessionInvalid)

  if (
    typeof window !== 'undefined'
    && window.location.pathname !== '/auth/login'
  ) {
    window.location.replace('/auth/login')
  }
}

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// React StrictMode remounts effects in development. Share identical GETs while
// they are still in flight so the remount does not hit the API twice. Completed
// responses are not cached and manual reload continues to request fresh data.
httpClient.defaults.adapter = createInflightDedupeAdapter(
  axios.getAdapter(httpClient.defaults.adapter),
)

function isSessionInvalidRefreshError(error) {
  return error?.response?.status === 401 || error?.response?.status === 403
}

httpClient.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken()
  config.headers ??= {}

  if (accessToken && !config.headers.Authorization && !shouldIgnoreRefresh(config.url)) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      shouldIgnoreRefresh(originalRequest?.url)
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      refreshTokenRequest ??= axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const refreshResponse = await refreshTokenRequest
      const authData = refreshResponse.data?.data

      if (!authData?.accessToken) {
        clearSessionAndRedirectToLogin()
        throw new Error('Refresh token response is invalid')
      }

      tokenStorage.setAccessToken(authData.accessToken)
      tokenStorage.setRequiresFirstLoginSetup(Boolean(authData.requiresFirstLoginSetup))

      originalRequest.headers ??= {}
      originalRequest.headers.Authorization = `Bearer ${authData.accessToken}`
      return httpClient(originalRequest)
    } catch (refreshError) {
      if (isSessionInvalidRefreshError(refreshError)) {
        clearSessionAndRedirectToLogin()
      }
      return Promise.reject(refreshError)
    } finally {
      refreshTokenRequest = null
    }
  },
)
