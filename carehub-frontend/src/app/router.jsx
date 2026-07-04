import { Navigate, Route, Routes } from 'react-router-dom'
import EmailConfirmOtpScreen from '../features/auth/pages/EmailConfirmOtpScreen.jsx'
import EmailConfirmResetScreen from '../features/auth/pages/EmailConfirmResetScreen.jsx'
import EmailConfirmScreen from '../features/auth/pages/EmailConfirmScreen.jsx'
import EmailConfirmSuccessScreen from '../features/auth/pages/EmailConfirmSuccessScreen.jsx'
import ForgotAccountScreen from '../features/auth/pages/ForgotAccountScreen.jsx'
import LoginScreen from '../features/auth/pages/LoginScreen.jsx'
import ProtectedRoute from '../features/auth/components/ProtectedRoute.jsx'
import StaffDashboard from '../features/staff/pages/DashboardStaffScreen.jsx'
import OtpScreen from '../features/auth/pages/OtpScreen.jsx'
import ResetPasswordScreen from '../features/auth/pages/ResetPasswordScreen.jsx'
import ActivityTypeDetailPage from '../features/training/pages/ActivityTypeDetailPage.jsx'
import ActivityTypeFormPage from '../features/training/pages/ActivityTypeFormPage.jsx'
import ActivityTypeListPage from '../features/training/pages/ActivityTypeListPage.jsx'
import TrainingFoundationPage from '../features/training/pages/TrainingFoundationPage.jsx'
import TrainingRecordDetailPage from '../features/training/pages/TrainingRecordDetailPage.jsx'
import TrainingRecordEvidencePage from '../features/training/pages/TrainingRecordEvidencePage.jsx'
import TrainingRecordFormPage from '../features/training/pages/TrainingRecordFormPage.jsx'
import TrainingRecordListPage from '../features/training/pages/TrainingRecordListPage.jsx'
import TrainingEmployeeStatusDetailPage from '../features/training/pages/TrainingEmployeeStatusDetailPage.jsx'
import TrainingEmployeeStatusListPage from '../features/training/pages/TrainingEmployeeStatusListPage.jsx'
import TrainingLegacyImportPage from '../features/training/pages/TrainingLegacyImportPage.jsx'
import TrainingRequirementPage from '../features/training/pages/TrainingRequirementPage.jsx'
import TrainingStatusPage from '../features/training/pages/TrainingStatusPage.jsx'
import QuestionCategoryListPage from '../features/evaluation/pages/QuestionCategoryListPage.jsx'
import QuestionSetListPage from '../features/evaluation/pages/QuestionSetListPage.jsx'
import QuestionSetFormPage from '../features/evaluation/pages/QuestionSetFormPage.jsx'
import QuestionBankListPage from '../features/evaluation/pages/QuestionBankListPage.jsx'
import QuestionFormPage from '../features/evaluation/pages/QuestionFormPage.jsx'
import ClassificationRuleListPage from '../features/evaluation/pages/ClassificationRuleListPage.jsx'
import ClassificationRuleFormPage from '../features/evaluation/pages/ClassificationRuleFormPage.jsx'
import TestConfigPage from '../features/evaluation/pages/TestConfigPage.jsx'
import EvaluationDashboardPage from '../features/evaluation/pages/EvaluationDashboardPage.jsx'
import EvaluationAuditLogPage from '../features/evaluation/pages/EvaluationAuditLogPage.jsx'
import EvaluationImportHistoryPage from '../features/evaluation/pages/EvaluationImportHistoryPage.jsx'
import ExamPaperListPage from '../features/evaluation/pages/ExamPaperListPage.jsx'
import ExamPaperGeneratePage from '../features/evaluation/pages/ExamPaperGeneratePage.jsx'
import ExamPaperDetailPage from '../features/evaluation/pages/ExamPaperDetailPage.jsx'
import ExamAssignmentListPage from '../features/evaluation/pages/ExamAssignmentListPage.jsx'
import ExamAssignmentFormPage from '../features/evaluation/pages/ExamAssignmentFormPage.jsx'
import ExamAttemptListPage from '../features/evaluation/pages/ExamAttemptListPage.jsx'
import QuestionDocumentListPage from '../features/evaluation/pages/QuestionDocumentListPage.jsx'
import QuestionDocumentDetailPage from '../features/evaluation/pages/QuestionDocumentDetailPage.jsx'
import DocumentQuestionJobReviewPage from '../features/evaluation/pages/DocumentQuestionJobReviewPage.jsx'
import ParaphraseJobReviewPage from '../features/evaluation/pages/ParaphraseJobReviewPage.jsx'


import { AUTH_ROUTES } from '../features/auth/constants/authRoutes.js'
import ProfileStaffScreen from '../features/staff/pages/ProfileStaffScreen.jsx'
import NotificationsStaffScreen from '../features/staff/pages/NotificationsStaffScreen.jsx'
import TrainingHoursListScreen from '../features/staff/pages/training/TrainingHoursListScreen.jsx'
import TrainingHoursDetailScreen from '../features/staff/pages/training/TrainingHoursDetailScreen.jsx'
import TrainingHoursEvidenceScreen from '../features/staff/pages/training/TrainingHoursEvidenceScreen.jsx'
import TrainingHoursFormScreen from '../features/staff/pages/training/TrainingHoursFormScreen.jsx'
import TrainingStatusScreen from '../features/staff/pages/TrainingStatusScreen.jsx'
import ExamHistoryScreen from '../features/staff/pages/ExamHistoryScreen.jsx'
import ExamTakeListScreen from '../features/staff/pages/ExamTakeListScreen.jsx'
import ExamTakeScreen from '../features/staff/pages/ExamTakeScreen.jsx'
import AdminDashboard from '../features/admin/pages/AdminDashboard.jsx'
import AdminAccountsScreen from '../features/admin/pages/AdminAccountsScreen.jsx'
import ImportLogsListPage from '../features/admin/pages/ImportLogsListPage.jsx'
import SystemSettingsScreen from '../features/admin/pages/SystemSettingsScreen.jsx'
import ReferenceEmployeesListPage from '../features/admin/pages/ReferenceEmployeesListPage.jsx'
import ReferenceEmployeeDetailPage from '../features/admin/pages/ReferenceEmployeeDetailPage.jsx'
import ReferenceDepartmentsListPage from '../features/admin/pages/ReferenceDepartmentsListPage.jsx'
import NotificationSettingsPage from '../features/admin/pages/NotificationSettingsPage.jsx'
import EmailTemplatesListPage from '../features/admin/pages/EmailTemplatesListPage.jsx'
import EmailTemplateFormPage from '../features/admin/pages/EmailTemplateFormPage.jsx'
import ImportModal from '../features/admin/pages/ImportModal.jsx'
import ChecklistCreatePage from '../features/admin/pages/ChecklistCreatePage.jsx'
import FormListPage from '../features/admin/pages/FormListPage.jsx'
import FormMetadataFormPage from '../features/admin/pages/FormMetadataFormPage.jsx'
import FormBuilderPage from '../features/admin/pages/FormBuilderPage.jsx'
import FormPreviewPage from '../features/admin/pages/FormPreviewPage.jsx'
import FormImportWizardPage from '../features/admin/pages/FormImportWizardPage.jsx'
import ComingSoonPage from '../features/admin/pages/ComingSoonPage.jsx'

import { ADMIN_ROLES, AUTH_ROLE, EVALUATION_PERMISSIONS } from '../features/auth/utils/authNavigation.js'


function protectedElement(element, options = {}) {
  return <ProtectedRoute {...options}>{element}</ProtectedRoute>
}

function adminElement(element) {
  return protectedElement(element, { allowedRoles: ADMIN_ROLES })
}

function evaluationElement(element) {
  return protectedElement(element, {
    allowedRoles: ADMIN_ROLES,
    allowedPermissions: EVALUATION_PERMISSIONS,
  })
}


function managerOrAdminElement(element) {
  return protectedElement(element, { allowedRoles: [AUTH_ROLE.admin, AUTH_ROLE.manager] })
}


function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={AUTH_ROUTES.login} replace />} />
      <Route path="/auth" element={<Navigate to={AUTH_ROUTES.login} replace />} />
      <Route path={AUTH_ROUTES.login} element={<LoginScreen />} />
      <Route path={AUTH_ROUTES.forgotPassword} element={<ForgotAccountScreen />} />
      <Route path={AUTH_ROUTES.otp} element={<OtpScreen />} />
      <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordScreen />} />
      <Route
        path={AUTH_ROUTES.emailConfirm}
        element={protectedElement(<EmailConfirmScreen />, { allowFirstLoginSetup: true })}
      />
      <Route
        path={AUTH_ROUTES.emailConfirmOtp}
        element={protectedElement(<EmailConfirmOtpScreen />, { allowFirstLoginSetup: true })}
      />
      <Route
        path={AUTH_ROUTES.emailConfirmReset}
        element={protectedElement(<EmailConfirmResetScreen />, { allowFirstLoginSetup: true })}
      />
      <Route path={AUTH_ROUTES.emailConfirmSuccess} element={<EmailConfirmSuccessScreen />} />
      
      {/* Admin / General Training routes */}

      <Route path="/admin/dashboard" element={adminElement(<AdminDashboard />)} />
      <Route path="/admin/accounts" element={adminElement(<AdminAccountsScreen />)} />
      <Route path="/admin/system-logs" element={adminElement(<ImportLogsListPage />)} />
      <Route path="/admin/system/import-logs" element={adminElement(<ImportLogsListPage />)} />
      <Route path="/admin/reference/sync-history" element={adminElement(<ImportLogsListPage />)} />
      <Route path="/admin/system-settings" element={adminElement(<SystemSettingsScreen />)} />
      <Route path="/admin/reference/employees" element={adminElement(<ReferenceEmployeesListPage />)} />
      <Route path="/admin/reference/employees/:id" element={adminElement(<ReferenceEmployeeDetailPage />)} />
      <Route path="/admin/reference/departments" element={adminElement(<ReferenceDepartmentsListPage />)} />
      <Route path="/admin/reference/import" element={adminElement(<ImportModal />)} />
      <Route path="/admin/notifications/settings" element={adminElement(<NotificationSettingsPage />)} />
      <Route path="/admin/notifications/email-templates" element={adminElement(<EmailTemplatesListPage />)} />
      <Route path="/admin/notifications/email-templates/:id" element={adminElement(<EmailTemplateFormPage />)} />
      <Route path="/admin/quality/checklists" element={adminElement(<FormListPage />)} />
      <Route path="/admin/quality/checklists/new" element={adminElement(<ChecklistCreatePage />)} />
      <Route path="/admin/quality/checklists/:id/detail" element={adminElement(<ChecklistCreatePage />)} />
      <Route path="/admin/quality/checklists/:id/edit" element={adminElement(<FormMetadataFormPage />)} />
      <Route path="/admin/quality/checklists/:id/builder/:versionId" element={adminElement(<FormBuilderPage />)} />
      <Route path="/admin/quality/checklists/:id/preview" element={adminElement(<FormPreviewPage />)} />
      <Route path="/admin/form-imports/new" element={adminElement(<FormImportWizardPage />)} />
      <Route path="/training" element={protectedElement(<TrainingFoundationPage />)} />
      <Route path="/training/records" element={protectedElement(<TrainingRecordListPage />)} />
      <Route path="/training/records/new" element={protectedElement(<TrainingRecordFormPage />)} />
      <Route path="/training/records/:id" element={protectedElement(<TrainingRecordDetailPage />)} />
      <Route path="/training/records/:id/edit" element={protectedElement(<TrainingRecordFormPage />)} />
      <Route path="/training/records/:id/evidence" element={protectedElement(<TrainingRecordEvidencePage />)} />
      <Route path="/training/status" element={protectedElement(<TrainingStatusPage />)} />
      <Route path="/training/status/:employeeId" element={protectedElement(<TrainingStatusPage />)} />
      <Route path="/training/employees" element={managerOrAdminElement(<TrainingEmployeeStatusListPage />)} />
      <Route path="/training/employees/:employeeId" element={managerOrAdminElement(<TrainingEmployeeStatusDetailPage />)} />
      <Route path="/training/imports/legacy" element={managerOrAdminElement(<TrainingLegacyImportPage />)} />
      <Route path="/admin/training/activity-types" element={adminElement(<ActivityTypeListPage />)} />
      <Route path="/admin/training/activity-types/new" element={adminElement(<ActivityTypeFormPage />)} />
      <Route path="/admin/training/activity-types/:id" element={adminElement(<ActivityTypeDetailPage />)} />
      <Route path="/admin/training/activity-types/:id/edit" element={adminElement(<ActivityTypeFormPage />)} />
      <Route path="/admin/training/requirements" element={adminElement(<TrainingRequirementPage />)} />
      <Route path="/admin/evaluation/question-documents" element={evaluationElement(<QuestionDocumentListPage />)} />
      <Route path="/admin/evaluation/dashboard" element={evaluationElement(<EvaluationDashboardPage />)} />
      <Route path="/admin/evaluation/audit-logs" element={evaluationElement(<EvaluationAuditLogPage />)} />
      <Route path="/admin/evaluation/imports" element={evaluationElement(<EvaluationImportHistoryPage />)} />
      <Route path="/admin/evaluation/question-documents/:documentId" element={evaluationElement(<QuestionDocumentDetailPage />)} />
      <Route path="/admin/evaluation/document-question-jobs/:jobId" element={evaluationElement(<DocumentQuestionJobReviewPage />)} />
      <Route path="/admin/evaluation/paraphrase-jobs/:jobId" element={evaluationElement(<ParaphraseJobReviewPage />)} />
      <Route path="/admin/evaluation/categories" element={evaluationElement(<QuestionCategoryListPage />)} />
      <Route path="/admin/evaluation/question-sets" element={evaluationElement(<QuestionSetListPage />)} />
      <Route path="/admin/evaluation/question-sets/new" element={evaluationElement(<QuestionSetFormPage />)} />
      <Route path="/admin/evaluation/question-sets/:id/edit" element={evaluationElement(<QuestionSetFormPage />)} />
      <Route path="/admin/evaluation/question-bank" element={evaluationElement(<QuestionBankListPage />)} />
      <Route path="/admin/evaluation/question-bank/new" element={evaluationElement(<QuestionFormPage />)} />
      <Route path="/admin/evaluation/question-bank/:id/edit" element={evaluationElement(<QuestionFormPage />)} />
      <Route path="/admin/evaluation/classification-rules" element={evaluationElement(<ClassificationRuleListPage />)} />
      <Route path="/admin/evaluation/classification-rules/new" element={evaluationElement(<ClassificationRuleFormPage />)} />
      <Route path="/admin/evaluation/classification-rules/:id/edit" element={evaluationElement(<ClassificationRuleFormPage />)} />
      <Route path="/admin/evaluation/configs" element={evaluationElement(<TestConfigPage />)} />
      <Route path="/admin/evaluation/exam-papers" element={evaluationElement(<ExamPaperListPage />)} />
      <Route path="/admin/evaluation/exam-papers/new" element={evaluationElement(<ExamPaperGeneratePage />)} />
      <Route path="/admin/evaluation/exam-papers/:paperId" element={evaluationElement(<ExamPaperDetailPage />)} />
      <Route path="/admin/evaluation/exam-assignments" element={evaluationElement(<ExamAssignmentListPage />)} />
      <Route path="/admin/evaluation/exam-assignments/new" element={evaluationElement(<ExamAssignmentFormPage />)} />
      <Route path="/admin/evaluation/exam-attempts" element={evaluationElement(<ExamAttemptListPage />)} />

      {/* Placeholder routes — sidebar mới có mục này nhưng trang thật chưa được code, sẽ thay bằng trang thật khi xây xong */}
      <Route
        path="/admin/training/evidence-review"
        element={adminElement(
          <ComingSoonPage
            title="Duyệt minh chứng"
            breadcrumbs={[{ label: 'Đào tạo' }, { label: 'Duyệt minh chứng' }]}
          />
        )}
      />
      <Route
        path="/admin/quality/history"
        element={adminElement(
          <ComingSoonPage
            title="Lịch sử đánh giá"
            breadcrumbs={[{ label: 'Chất lượng' }, { label: 'Lịch sử đánh giá' }]}
          />
        )}
      />
      <Route
        path="/admin/quality/formulas"
        element={adminElement(
          <ComingSoonPage
            title="Công thức chỉ số"
            breadcrumbs={[{ label: 'Chất lượng' }, { label: 'Công thức chỉ số' }]}
          />
        )}
      />
      <Route
        path="/admin/quality/targets"
        element={adminElement(
          <ComingSoonPage
            title="Mục tiêu chất lượng"
            breadcrumbs={[{ label: 'Chất lượng' }, { label: 'Mục tiêu chất lượng' }]}
          />
        )}
      />
      <Route
        path="/admin/reports/training-dashboard"
        element={adminElement(
          <ComingSoonPage
            title="Dashboard đào tạo"
            breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Dashboard đào tạo' }]}
          />
        )}
      />
      <Route
        path="/admin/reports/quality-dashboard"
        element={adminElement(
          <ComingSoonPage
            title="Dashboard chất lượng"
            breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Dashboard chất lượng' }]}
          />
        )}
      />
      <Route
        path="/admin/reports/export-training"
        element={adminElement(
          <ComingSoonPage
            title="Xuất báo cáo đào tạo"
            breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Xuất báo cáo đào tạo' }]}
          />
        )}
      />
      <Route
        path="/admin/reports/export-quality"
        element={adminElement(
          <ComingSoonPage
            title="Xuất báo cáo chất lượng"
            breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Xuất báo cáo chất lượng' }]}
          />
        )}
      />
      <Route
        path="/admin/profile"
        element={adminElement(
          <ComingSoonPage
            title="Hồ sơ cá nhân"
            breadcrumbs={[{ label: 'Tài khoản tôi' }, { label: 'Hồ sơ cá nhân' }]}
          />
        )}
      />



      
      {/* Staff CME / Training Hours routes */}
      <Route path="/staff/training" element={protectedElement(<TrainingHoursListScreen />)} />
      <Route path="/staff/training/new" element={protectedElement(<TrainingHoursFormScreen />)} />
      <Route path="/staff/training/:id" element={protectedElement(<TrainingHoursDetailScreen />)} />
      <Route path="/staff/training/:id/edit" element={protectedElement(<TrainingHoursFormScreen />)} />
      <Route path="/staff/training/:id/evidence" element={protectedElement(<TrainingHoursEvidenceScreen />)} />
      <Route path="/staff/training-status" element={protectedElement(<TrainingStatusScreen />)} />
      <Route path="/staff/exam/take" element={protectedElement(<ExamTakeListScreen />)} />
      <Route path="/staff/exam/take/:attemptId" element={protectedElement(<ExamTakeScreen />)} />
      <Route path="/staff/exam/history" element={protectedElement(<ExamHistoryScreen />)} />

      <Route path="/email-confirm" element={<Navigate to={AUTH_ROUTES.emailConfirm} replace />} />
      <Route path={AUTH_ROUTES.staffDashboard} element={protectedElement(<StaffDashboard />)} />
      <Route path="/staff/profile" element={protectedElement(<ProfileStaffScreen />)} />
      <Route path="/staff/notifications" element={protectedElement(<NotificationsStaffScreen />)} />
      <Route path="*" element={<Navigate to={AUTH_ROUTES.login} replace />} />
    </Routes>
  )
}

export default AppRouter
