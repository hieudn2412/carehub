import { matchPath } from 'react-router-dom'

const APPLICATION_NAME = 'Quản lý điều dưỡng Việt Đức'

const PAGE_TITLE_ROUTES = [
  // Authentication
  ['/auth/login', 'Đăng nhập'],
  ['/auth/forgot-password', 'Quên mật khẩu'],
  ['/auth/otp', 'Xác thực OTP'],
  ['/auth/reset-password', 'Đặt lại mật khẩu'],
  ['/auth/email-confirm', 'Xác nhận email'],
  ['/auth/email-confirm-otp', 'Xác thực email'],
  ['/auth/email-confirm-reset', 'Đặt lại email'],
  ['/auth/email-confirm-success', 'Xác nhận email thành công'],

  // Administration
  ['/admin/dashboard', 'Dashboard chất lượng chăm sóc'],
  ['/admin/accounts', 'Quản lý tài khoản'],
  ['/admin/system/import-logs', 'Lịch sử nhập dữ liệu'],
  ['/admin/reference/sync-history', 'Lịch sử đồng bộ'],
  ['/admin/system-settings/training', 'Cấu hình giờ đào tạo'],
  ['/admin/system-settings/compliance', 'Cấu hình giám sát tuân thủ'],
  ['/admin/system-settings/competency', 'Cấu hình năng lực chuyên môn'],
  ['/admin/system-settings', 'Cài đặt hệ thống'],
  ['/admin/reference/employees/:id', 'Chi tiết nhân viên'],
  ['/admin/reference/employees', 'Danh sách nhân viên'],
  ['/admin/reference/departments', 'Danh sách khoa phòng'],
  ['/admin/reference/import', 'Nhập dữ liệu tham chiếu'],
  ['/admin/notifications/settings', 'Cài đặt thông báo'],
  ['/admin/notifications/email-templates/:id', 'Cấu hình mẫu email'],
  ['/admin/notifications/email-templates', 'Mẫu email'],
  ['/admin/quality/checklists/new', 'Tạo bảng kiểm'],
  ['/admin/quality/checklists/:id/detail', 'Chi tiết bảng kiểm'],
  ['/admin/quality/checklists/:id/assignments', 'Phân công bảng kiểm'],
  ['/admin/quality/checklist-assignments', 'Giao bảng kiểm'],
  ['/admin/quality/checklists/:id/edit', 'Cấu hình bảng kiểm'],
  ['/admin/quality/checklists/:id/builder/:versionId', 'Thiết kế bảng kiểm'],
  ['/admin/quality/checklists/:id/preview', 'Xem trước bảng kiểm'],
  ['/admin/quality/checklists/:id/evaluate/:versionId', 'Thực hiện đánh giá'],
  ['/admin/quality/history/:id', 'Chi tiết lịch sử đánh giá'],
  ['/admin/quality/history', 'Lịch sử đánh giá'],
  ['/admin/quality/checklists', 'Quản lý bảng kiểm'],
  ['/admin/form-imports/new', 'Nhập bảng kiểm'],
  ['/admin/quality/compliance-targets', 'Cài đặt mục tiêu tuân thủ'],
  ['/admin/quality/formulas', 'Cài đặt điểm sàn quy trình kỹ thuật'],
  ['/admin/reports/training-dashboard', 'Dashboard giờ đào tạo'],
  ['/admin/reports/quality-dashboard', 'Báo cáo chất lượng'],
  ['/admin/reports/checklist-dashboard/results/:id', 'Chi tiết kết quả tuân thủ theo kỹ thuật'],
  ['/admin/reports/checklist-dashboard/results/forms/:formId/versions/:versionId', 'Kết quả tuân thủ theo kỹ thuật'],
  ['/admin/reports/checklist-dashboard', 'Tuân thủ theo kỹ thuật'],
  ['/admin/reports/competency-dashboard', 'Chất lượng chăm sóc'],
  ['/admin/reports/export-training', 'Xuất báo cáo đào tạo'],
  ['/admin/reports/export-quality', 'Xuất báo cáo chất lượng'],
  ['/admin/profile', 'Hồ sơ quản trị viên'],

  // Training administration
  ['/admin/training/activity-types/new', 'Tạo loại hoạt động đào tạo'],
  ['/admin/training/activity-types/:id/edit', 'Cập nhật loại hoạt động đào tạo'],
  ['/admin/training/activity-types/:id', 'Chi tiết loại hoạt động đào tạo'],
  ['/admin/training/activity-types', 'Loại hoạt động đào tạo'],
  ['/admin/training/professional-fields', 'Lĩnh vực chuyên môn'],
  ['/training/records/new', 'Tạo hồ sơ đào tạo'],
  ['/training/records/:id/edit', 'Cập nhật hồ sơ đào tạo'],
  ['/training/records/:id/evidence', 'Minh chứng đào tạo'],
  ['/training/records/:id', 'Chi tiết hồ sơ đào tạo'],
  ['/training/records', 'Hồ sơ đào tạo'],
  ['/training/status/:employeeId', 'Trạng thái đào tạo nhân viên'],
  ['/training/status', 'Trạng thái đào tạo'],
  ['/training/employees/:employeeId', 'Chi tiết đào tạo nhân viên'],
  ['/training/employees', 'Theo dõi đào tạo nhân viên'],
  ['/training/imports/legacy', 'Nhập dữ liệu đào tạo cũ'],
  ['/training', 'Quản lý đào tạo'],

  // Evaluation administration
  ['/admin/evaluation/question-documents/:documentId', 'Chi tiết tài liệu câu hỏi'],
  ['/admin/evaluation/question-documents', 'Tài liệu câu hỏi'],
  ['/admin/evaluation/document-question-jobs/:jobId', 'Duyệt câu hỏi từ tài liệu'],
  ['/admin/evaluation/dashboard', 'Tổng quan đánh giá năng lực'],
  ['/admin/evaluation/audit-logs', 'Nhật ký đánh giá'],
  ['/admin/evaluation/imports', 'Lịch sử nhập câu hỏi'],
  ['/admin/evaluation/categories', 'Danh mục câu hỏi'],
  ['/admin/evaluation/question-bank/new', 'Tạo câu hỏi'],
  ['/admin/evaluation/question-bank/:id/edit', 'Cập nhật câu hỏi'],
  ['/admin/evaluation/question-bank', 'Ngân hàng câu hỏi'],
  ['/admin/evaluation/classification-rules/new', 'Tạo quy tắc phân loại'],
  ['/admin/evaluation/classification-rules/:id/edit', 'Cập nhật quy tắc phân loại'],
  ['/admin/evaluation/classification-rules', 'Quy tắc phân loại'],
  ['/admin/evaluation/exam-management/new', 'Giao bài kiểm tra'],
  ['/admin/evaluation/exam-management', 'Quản lý bài kiểm tra'],
  ['/admin/evaluation/exam-assignments/new', 'Tạo phân công kiểm tra'],
  ['/admin/evaluation/competency-by-field/:employeeId', 'Chi tiết năng lực nhân viên'],
  ['/admin/evaluation/competency-by-field', 'Năng lực theo lĩnh vực'],
  ['/admin/evaluation/compliance-by-technique/:employeeId', 'Chi tiết tuân thủ chung'],
  ['/admin/evaluation/compliance-by-technique', 'Tuân thủ chung'],
  ['/admin/evaluation/competency-summary', 'Tổng hợp năng lực'],
  ['/admin/evaluation/training-groups', 'Nhóm đào tạo'],

  // Manager
  ['/manager/dashboard', 'Tổng quan quản lý'],
  ['/manager/reports/training-dashboard', 'Báo cáo đào tạo'],
  ['/manager/reports/quality-dashboard', 'Báo cáo chất lượng'],
  ['/manager/reports/checklist-dashboard/results/:id', 'Chi tiết kết quả tuân thủ theo kỹ thuật'],
  ['/manager/reports/checklist-dashboard/results/forms/:formId/versions/:versionId', 'Kết quả tuân thủ theo kỹ thuật'],
  ['/manager/reports/checklist-dashboard', 'Tuân thủ theo kỹ thuật'],
  ['/manager/reports/exam-dashboard', 'Báo cáo bài kiểm tra'],
  ['/manager/employees/:id', 'Chi tiết nhân viên'],
  ['/manager/employees', 'Quản lý nhân viên'],
  ['/manager/exam-results/detail/:id', 'Chi tiết kết quả kiểm tra'],
  ['/manager/exam-results', 'Kết quả kiểm tra'],
  ['/manager/quality/history/:id', 'Chi tiết lịch sử đánh giá'],
  ['/manager/quality/history', 'Lịch sử đánh giá'],
  ['/manager/quality/checklists/:id/evaluate', 'Thực hiện đánh giá'],
  ['/manager/quality/checklists', 'Bảng kiểm chất lượng'],
  ['/manager/competency-by-field/:employeeId', 'Chi tiết năng lực nhân viên'],
  ['/manager/competency-by-field', 'Năng lực theo lĩnh vực'],
  ['/manager/compliance-by-technique/:employeeId', 'Chi tiết tuân thủ chung'],
  ['/manager/compliance-by-technique', 'Tuân thủ chung'],
  ['/manager/competency-summary', 'Tổng hợp năng lực'],

  // Staff
  ['/staff/dashboard', 'Tổng quan cá nhân'],
  ['/staff/training/new', 'Khai báo giờ đào tạo'],
  ['/staff/training/evidences', 'Minh chứng đào tạo'],
  ['/staff/training/all', 'Danh sách giờ đào tạo'],
  ['/staff/training/:id/edit', 'Cập nhật giờ đào tạo'],
  ['/staff/training/:id/evidence', 'Bổ sung minh chứng'],
  ['/staff/training/:id', 'Chi tiết giờ đào tạo'],
  ['/staff/training', 'Tổng quan giờ đào tạo'],
  ['/staff/training-status', 'Trạng thái đào tạo'],
  ['/staff/competency/all', 'Chi tiết năng lực'],
  ['/staff/competency', 'Tuân thủ cá nhân'],
  ['/staff/reports/checklist-dashboard', 'Tổng quan bảng kiểm'],
  ['/staff/quality/history/:id', 'Chi tiết lịch sử đánh giá'],
  ['/staff/quality/history', 'Lịch sử đánh giá'],
  ['/staff/exam/take/:attemptId', 'Làm bài kiểm tra'],
  ['/staff/exam/take', 'Bài kiểm tra được giao'],
  ['/staff/exam/history', 'Lịch sử kiểm tra'],
  ['/staff/professional-competency/all', 'Danh sách đánh giá năng lực'],
  ['/staff/professional-competency', 'Năng lực chuyên môn'],
  ['/staff/checklists/:id/evaluate', 'Thực hiện đánh giá'],
  ['/staff/checklists/:id', 'Chi tiết bảng kiểm'],
  ['/staff/checklists', 'Bảng kiểm'],
  ['/staff/profile', 'Hồ sơ cá nhân'],
  ['/staff/notifications', 'Thông báo'],
]

const SECTION_FALLBACKS = [
  ['/admin/evaluation/*', 'Đánh giá năng lực'],
  ['/admin/quality/*', 'Quản lý chất lượng'],
  ['/admin/*', 'Quản trị hệ thống'],
  ['/manager/*', 'Không gian quản lý'],
  ['/staff/*', 'Không gian nhân viên'],
  ['/training/*', 'Quản lý đào tạo'],
]

function resolvePageTitle(pathname, search = '') {
  if (
    pathname === '/admin/evaluation/exam-management'
    && new URLSearchParams(search).get('view') === 'assignments'
  ) {
    return 'Phân công bài kiểm tra'
  }

  const route = PAGE_TITLE_ROUTES.find(([path]) => matchPath({ path, end: true }, pathname))
  if (route) {
    return route[1]
  }

  const section = SECTION_FALLBACKS.find(([path]) => matchPath({ path, end: true }, pathname))
  return section?.[1] ?? 'Hệ thống quản lý điều dưỡng'
}

export function getDocumentTitle(pathname, search = '') {
  return `${resolvePageTitle(pathname, search)} | ${APPLICATION_NAME}`
}
