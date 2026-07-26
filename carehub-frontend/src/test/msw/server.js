import { setupServer } from 'msw/node'

// Shared MSW server. Handlers are registered per test with server.use(...);
// there are no default handlers so an unhandled request is always a test bug.
export const server = setupServer()

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'
