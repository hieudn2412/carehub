const MESSAGE_TRANSLATIONS = {
  'account is locked': 'Tài khoản đã bị khóa',
  'account is not active': 'Tài khoản chưa được kích hoạt',
  'email already exists': 'Email này đã được sử dụng',
  'email not found': 'Không tìm thấy tài khoản với email này',
  'employee code is required': 'Vui lòng nhập mã nhân viên',
  'first login setup is not required for this account':
    'Tài khoản này không cần thực hiện thiết lập lần đầu',
  'invalid code or password': 'Mã nhân viên hoặc mật khẩu không chính xác',
  'invalid otp': 'Mã OTP không chính xác',
  'otp already used': 'Mã OTP đã được sử dụng',
  'otp expired': 'Mã OTP đã hết hạn',
  'password is required': 'Vui lòng nhập mật khẩu',
  'please complete first login setup before resetting password':
    'Vui lòng hoàn tất thiết lập tài khoản lần đầu trước khi đặt lại mật khẩu',
  'refresh token invalid': 'Phiên đăng nhập không hợp lệ',
  'token has expired': 'Phiên đăng nhập đã hết hạn',
  'token is revoked': 'Phiên đăng nhập đã bị thu hồi',
  'user has been locked': 'Tài khoản đã bị khóa',
  'user not found': 'Không tìm thấy tài khoản',
}

const STATUS_MESSAGES = {
  401: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  403: 'Bạn không có quyền thực hiện thao tác này',
  404: 'Không tìm thấy dữ liệu yêu cầu',
  429: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau',
  500: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau',
  502: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau',
  503: 'Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau',
}

function translateMessage(message) {
  if (typeof message !== 'string' || !message.trim()) {
    return ''
  }

  const normalizedMessage = message.trim().toLowerCase()
  const translatedMessage = MESSAGE_TRANSLATIONS[normalizedMessage]

  if (translatedMessage) {
    return translatedMessage
  }

  return message.trim()
}

function getFieldErrors(responseData) {
  const details = responseData?.details ?? responseData?.data
  const fieldErrors = Array.isArray(details?.fieldErrors)
    ? details.fieldErrors
    : Array.isArray(details)
      ? details
      : []

  return fieldErrors
    .map((fieldError) => translateMessage(fieldError?.message))
    .filter(Boolean)
    .join(', ')
}

export function getApiErrorMessage(error, fallbackMessage = 'Đã xảy ra lỗi. Vui lòng thử lại') {
  const responseData = error?.response?.data
  const status = error?.response?.status

  if (!error?.response) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại'
  }

  const fieldErrorMessage = getFieldErrors(responseData)
  if (fieldErrorMessage) {
    return fieldErrorMessage
  }

  const translatedMessage = translateMessage(responseData?.message)
  if (translatedMessage) {
    return translatedMessage
  }

  return STATUS_MESSAGES[status] || fallbackMessage
}
