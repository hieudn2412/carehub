import axios from 'axios'
import { tokenStorage } from '../../features/auth/services/tokenStorage.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'
let refreshTokenRequest = null

const REFRESH_IGNORED_PATHS = [
  '/auth/login',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]

function shouldIgnoreRefresh(url = '') {
  return REFRESH_IGNORED_PATHS.some((path) => url.endsWith(path) || url.includes(path))
}

function clearSessionAndRedirectToLogin() {
  tokenStorage.clear()

  if (
    typeof window !== 'undefined'
    && window.location.pathname !== '/auth/login'
  ) {
    window.location.replace('/auth/login')
  }
}

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken()
  config.headers ??= {}

  if (accessToken && !config.headers.Authorization) {
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

    const refreshToken = tokenStorage.getRefreshToken()

    if (!refreshToken) {
      clearSessionAndRedirectToLogin()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      refreshTokenRequest ??= axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const refreshResponse = await refreshTokenRequest
      const authData = refreshResponse.data?.data

      if (!authData?.accessToken) {
        throw new Error('Refresh token response is invalid')
      }

      tokenStorage.setAccessToken(authData.accessToken)
      tokenStorage.setRefreshToken(authData.refreshToken)
      tokenStorage.setRequiresFirstLoginSetup(Boolean(authData.requiresFirstLoginSetup))

      originalRequest.headers ??= {}
      originalRequest.headers.Authorization = `Bearer ${authData.accessToken}`
      return httpClient(originalRequest)
    } catch (refreshError) {
      clearSessionAndRedirectToLogin()
      return Promise.reject(refreshError)
    } finally {
      refreshTokenRequest = null
    }
  },
)
