/**
 * Visible Vietnamese strings the specs assert on, in one place.
 *
 * The app has no i18n layer and no data-testid anywhere, so every locator ultimately hangs off text.
 * Keeping the literals here means a wording change costs one edit instead of thirty.
 *
 * Two traps this file works around:
 *   • the same word appears with different diacritics ("Huỷ bỏ" vs "Hủy bỏ", "Xoá" vs "Xóa"),
 *   • long labels are broken across JSX lines, so the rendered text contains collapsed whitespace —
 *     always match a short fragment, never a whole sentence.
 */

export const LOGIN = {
  heading: 'Đăng nhập',
  subtitle: 'Chào mừng bạn đã quay trở lại',
  employeeCodeLabel: 'Mã nhân viên',
  passwordLabel: 'Mật khẩu',
  submit: 'Đăng nhập',
  submitting: 'Đang đăng nhập...',
  emptyFieldsError: 'Vui lòng nhập mã nhân viên và mật khẩu',
  failed: 'Đăng nhập không thành công',
  forgotPassword: 'Quên mật khẩu?',
}

export const HEADER_TITLES = {
  staffDashboard: 'Năng lực của tôi',
  managerDashboard: 'Dashboard tổng quan',
  adminDashboardBreadcrumb: 'Dashboard tổng quan',
  trainingStatus: 'Tiến độ giờ đào tạo',
  examList: 'Năng lực chuyên môn',
  examTake: 'Làm bài thi',
  examHistory: 'Lịch sử thi',
  checklistList: 'Quy trình chất lượng',
  managerEmployees: 'Nhân sự trong khoa',
  adminAccounts: 'Quản lý tài khoản',
}

export const SIDEBAR = {
  sectionHome: 'Trang chủ',
  sectionPersonal: 'Theo dõi cá nhân',
  sectionAccount: 'Tài khoản',
  trainingHours: 'Đào tạo liên tục',
  // Hai mục dưới đây chỉ MANAGER mới thấy — nhãn của staff không trùng với chúng.
  // (Nhân sự trong khoa đã chuyển vào dashboard Đào tạo liên tục nên không còn là mục menu.)
  // "Tuân thủ chung" cũng là nhãn một thẻ KPI trên /manager/dashboard, nên assertion nhắm vào
  // link trong sidebar (getByRole) chứ không dùng getByText.
  managerCompliance: 'Tuân thủ chung',
  managerResults: 'Kết quả năng lực chuyên môn',
  profile: 'Hồ sơ cá nhân',
}

export const STAFF_TRAINING = {
  listHeading: 'Giờ đào tạo liên tục',
  listSubtitle: 'Theo dõi mục tiêu 120 giờ trong 5 năm liên tục',
  addButton: 'Cập nhật giờ đào tạo',
  emptyState: 'Chưa có hồ sơ nào',
  formHeading: 'Thêm hồ sơ đào tạo',
  formEditHeading: 'Chỉnh sửa hồ sơ đào tạo',
  titlePlaceholder: 'Ví dụ: Hồi sức cấp cứu cơ bản',
  hoursPlaceholder: 'Ví dụ: 1.5, 8, 12.5',
  activityTypePlaceholder: 'Chọn hình thức',
  notePlaceholder: 'Mô tả ngắn gọn về nội dung...',
  saveDraft: 'Lưu nháp',
  saveAndSubmit: 'Lưu và nộp',
  cancel: 'Huỷ bỏ',
  submitToast: 'Nộp hồ sơ thành công!',
  draftToast: 'Lưu bản nháp thành công!',
  evidenceHeading: 'Minh chứng đào tạo',
  progressHeading: 'Tiến độ hoàn thành chuẩn đào tạo',
}

export const TRAINING_RECORDS = {
  // Shared /training/records area (not the staff-specific screens)
  newRecordPath: '/training/records/new',
  statusSubmitted: 'Đã nộp',
  statusDraft: 'Bản nháp',
  returnToDraft: 'Trả về nháp',
  returnToDraftConfirm: 'Bạn có chắc muốn trả hồ sơ này về nháp?',
}

export const CHECKLIST = {
  listHeading: 'Quy trình giám sát',
  emptyState: 'Chưa có quy trình được giao',
  startCta: 'Thực hiện đánh giá',
  evaluationHeading: 'Thực hiện đánh giá quy trình',
  employeeLookupPlaceholder: 'Nhập mã nhân viên, ví dụ: NV001',
  lookupButton: 'Tìm nhân viên',
  lookupResult: 'Kết quả tìm thấy',
  chooseEmployee: 'Chọn nhân viên này',
  saveDraft: 'Lưu bản nháp',
  submit: 'Nộp kết quả',
  draftSavedToast: 'Đã lưu bản nháp đánh giá.',
  submittedToast: 'Đã nộp kết quả đánh giá checklist.',
  missingEmployeeToast: 'Vui lòng tra cứu và xác nhận nhân viên cần giám sát trước.',
  conflictToast: 'Checklist này đang có bản nháp mở',
}

export const EXAM = {
  listHeading: 'Năng lực chuyên môn',
  listSubtitle: 'Theo dõi và hoàn thành các bài kiểm tra được giao',
  emptyState: 'Chưa có bài kiểm tra trong phạm vi đã chọn.',
  detailAction: 'Chi tiết',
  timerLabel: 'Thời gian còn lại',
  save: 'Lưu',
  submit: 'Nộp bài',
  submitBottom: 'Nộp bài kiểm tra',
  savedIndicator: 'Đã lưu',
  allAnswered: 'Đã trả lời tất cả câu hỏi',
  readOnly: 'Lượt làm bài đã kết thúc, bạn không thể sửa hoặc nộp thêm đáp án.',
  historyHeading: 'Lịch sử thi',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  notTaken: 'Chưa làm',
}

export const ADMIN_ACCOUNTS = {
  heading: 'Danh sách tài khoản',
  addButton: 'Thêm tài khoản',
  modalHeading: 'Thêm tài khoản nhân viên',
  employeeCodePlaceholder: 'VD: NV-00042',
  fullNamePlaceholder: 'VD: Nguyễn Văn A',
  emailPlaceholder: 'VD: email@example.com',
  departmentPlaceholder: 'Tìm hoặc chọn phòng ban...',
  save: 'Lưu thay đổi',
  cancel: 'Huỷ',
  searchPlaceholder: 'Tìm theo tên hoặc ID...',
}

export const ADMIN_CHECKLISTS = {
  listHeading: 'Danh sách biểu mẫu checklist',
  createButton: 'Tạo biểu mẫu mới',
  assignButton: 'Giao checklist',
  titleAriaLabel: 'Tiêu đề checklist',
  descriptionAriaLabel: 'Mô tả checklist',
  questionPlaceholder: 'Câu hỏi không có tiêu đề',
  saveDraft: 'Lưu bản nháp',
  versionsHeading: 'Danh sách phiên bản câu hỏi',
  createDraftVersion: 'Tạo bản nháp mới',
  publish: 'Công bố',
  publishedBadge: 'Hoạt động',
  assignmentsHeading: 'Giao người thực hiện',
  notPublishedWarning: 'Checklist này chưa có phiên bản hoạt động',
}

export const MANAGER = {
  employeesHeading: 'Nhân sự trong khoa',
  employeeSearchPlaceholder: 'Tìm nhân sự theo tên, mã NV...',
  employeeDetailHeading: 'Chi tiết nhân sự',
  employeeHoursHeading: 'Giờ đào tạo nhân viên',
  employeeHoursDetailHeading: 'Chi tiết đào tạo nhân viên',
  viewEvidenceTitle: 'Xem minh chứng',
  viewRecordTitle: 'Xem chi tiết hồ sơ',
}

/** Toast container/text — the toast auto-dismisses after 4000 ms, so assert immediately. */
export const TOAST_SELECTOR = '.toast-message'
