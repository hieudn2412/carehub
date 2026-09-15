import axios from 'axios'

const inFlightGetRequests = new Map()

function headerValue(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) || ''
  return headers?.[name] || headers?.[name.toLowerCase()] || ''
}

function requestKey(config) {
  return [
    String(config.baseURL || ''),
    axios.getUri(config),
    String(config.responseType || 'json'),
    String(config.withCredentials ?? ''),
    headerValue(config.headers, 'Authorization'),
    headerValue(config.headers, 'Accept'),
  ].join('|')
}

/**
 * Shares only identical GET requests that are in flight at the same time.
 * It deliberately does not cache completed responses, so an explicit reload
 * always reaches the server. Set `dedupe: false` on an Axios request when two
 * concurrent calls to the same URL must remain independent.
 */
export function createInflightDedupeAdapter(baseAdapter) {
  return async function inflightDedupeAdapter(config) {
    if (
      String(config.method || 'get').toLowerCase() !== 'get'
      || config.dedupe === false
      || config.signal
      || config.cancelToken
    ) {
      return baseAdapter(config)
    }

    const key = requestKey(config)
    const pending = inFlightGetRequests.get(key)
    if (pending) return pending

    const request = Promise.resolve(baseAdapter(config))
    inFlightGetRequests.set(key, request)

    try {
      return await request
    } finally {
      if (inFlightGetRequests.get(key) === request) {
        inFlightGetRequests.delete(key)
      }
    }
  }
}

export function clearInflightGetRequestsForTests() {
  inFlightGetRequests.clear()
}
