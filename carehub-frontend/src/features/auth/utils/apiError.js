export function getApiErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data

  if (Array.isArray(responseData?.data) && responseData.data.length > 0) {
    return responseData.data.join(', ')
  }

  return responseData?.message || fallbackMessage
}
