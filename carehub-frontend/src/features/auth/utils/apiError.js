export function getApiErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data

  if (Array.isArray(responseData?.data) && responseData.data.length > 0) {
    return responseData.data.join(', ')
  }

  if (Array.isArray(responseData?.data?.fieldErrors) && responseData.data.fieldErrors.length > 0) {
    return responseData.data.fieldErrors
      .map((fieldError) => `${fieldError.field}: ${fieldError.message}`)
      .join(', ')
  }

  return responseData?.message || error?.message || fallbackMessage
}
