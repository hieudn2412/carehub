import { Navigate, Route, Routes } from 'react-router-dom'
import EmailConfirmOtpScreen from '../features/auth/pages/EmailConfirmOtpScreen.jsx'
import EmailConfirmResetScreen from '../features/auth/pages/EmailConfirmResetScreen.jsx'
import EmailConfirmScreen from '../features/auth/pages/EmailConfirmScreen.jsx'
import EmailConfirmSuccessScreen from '../features/auth/pages/EmailConfirmSuccessScreen.jsx'
import ForgotAccountScreen from '../features/auth/pages/ForgotAccountScreen.jsx'
import LoginScreen from '../features/auth/pages/LoginScreen.jsx'
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
import { AUTH_ROUTES } from '../features/auth/constants/authRoutes.js'
import ProfileStaffScreen from '../features/staff/pages/ProfileStaffScreen.jsx'
import NotificationsStaffScreen from '../features/staff/pages/NotificationsStaffScreen.jsx'
import TrainingHoursListScreen from '../features/staff/pages/training/TrainingHoursListScreen.jsx'
import TrainingHoursDetailScreen from '../features/staff/pages/training/TrainingHoursDetailScreen.jsx'
import TrainingHoursEvidenceScreen from '../features/staff/pages/training/TrainingHoursEvidenceScreen.jsx'
import TrainingHoursFormScreen from '../features/staff/pages/training/TrainingHoursFormScreen.jsx'
import TrainingStatusScreen from '../features/staff/pages/TrainingStatusScreen.jsx'
import ExamHistoryScreen from '../features/staff/pages/ExamHistoryScreen.jsx'
import AdminDashboard from '../features/admin/pages/AdminDashboard.jsx'
import AdminAccountsScreen from '../features/admin/pages/AdminAccountsScreen.jsx'
import SystemLogsListScreen from '../features/admin/pages/SystemLogsListScreen.jsx'
import SystemLogDetailScreen from '../features/admin/pages/SystemLogDetailScreen.jsx'
import ImportLogsListPage from '../features/admin/pages/ImportLogsListPage.jsx'
import SystemSettingsScreen from '../features/admin/pages/SystemSettingsScreen.jsx'
import ReferenceEmployeesListPage from '../features/admin/pages/ReferenceEmployeesListPage.jsx'
import ReferenceEmployeeDetailPage from '../features/admin/pages/ReferenceEmployeeDetailPage.jsx'
import ReferenceDepartmentsListPage from '../features/admin/pages/ReferenceDepartmentsListPage.jsx'

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={AUTH_ROUTES.login} replace />} />
      <Route path="/auth" element={<Navigate to={AUTH_ROUTES.login} replace />} />
      <Route path={AUTH_ROUTES.login} element={<LoginScreen />} />
      <Route path={AUTH_ROUTES.forgotPassword} element={<ForgotAccountScreen />} />
      <Route path={AUTH_ROUTES.otp} element={<OtpScreen />} />
      <Route path={AUTH_ROUTES.resetPassword} element={<ResetPasswordScreen />} />
      <Route path={AUTH_ROUTES.emailConfirm} element={<EmailConfirmScreen />} />
      <Route path={AUTH_ROUTES.emailConfirmOtp} element={<EmailConfirmOtpScreen />} />
      <Route path={AUTH_ROUTES.emailConfirmReset} element={<EmailConfirmResetScreen />} />
      <Route path={AUTH_ROUTES.emailConfirmSuccess} element={<EmailConfirmSuccessScreen />} />
      
      {/* Admin / General Training routes */}
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/accounts" element={<AdminAccountsScreen />} />
      <Route path="/admin/system-logs" element={<SystemLogsListScreen />} />
      <Route path="/admin/system-logs/:id" element={<SystemLogDetailScreen />} />
      <Route path="/admin/system/import-logs" element={<ImportLogsListPage />} />
      <Route path="/admin/system-settings" element= {<SystemSettingsScreen />} />
      <Route path="/admin/reference/employees" element={<ReferenceEmployeesListPage />} />
      <Route path="/admin/reference/employees/:id" element={<ReferenceEmployeeDetailPage />} />
      <Route path="/admin/reference/departments" element={<ReferenceDepartmentsListPage />} />
      <Route path="/training" element={<TrainingFoundationPage />} />
      <Route path="/training/records" element={<TrainingRecordListPage />} />
      <Route path="/training/records/new" element={<TrainingRecordFormPage />} />
      <Route path="/training/records/:id" element={<TrainingRecordDetailPage />} />
      <Route path="/training/records/:id/edit" element={<TrainingRecordFormPage />} />
      <Route path="/training/records/:id/evidence" element={<TrainingRecordEvidencePage />} />
      <Route path="/admin/training/activity-types" element={<ActivityTypeListPage />} />
      <Route path="/admin/training/activity-types/new" element={<ActivityTypeFormPage />} />
      <Route path="/admin/training/activity-types/:id" element={<ActivityTypeDetailPage />} />
      <Route path="/admin/training/activity-types/:id/edit" element={<ActivityTypeFormPage />} />
      
      {/* Staff CME / Training Hours routes */}
      <Route path="/staff/training" element={<TrainingHoursListScreen />} />
      <Route path="/staff/training/new" element={<TrainingHoursFormScreen />} />
      <Route path="/staff/training/:id" element={<TrainingHoursDetailScreen />} />
      <Route path="/staff/training/:id/edit" element={<TrainingHoursFormScreen />} />
      <Route path="/staff/training/:id/evidence" element={<TrainingHoursEvidenceScreen />} />
      <Route path="/staff/training-status" element={<TrainingStatusScreen />} />
      <Route path="/staff/exam/history" element={<ExamHistoryScreen />} />

      <Route path="/email-confirm" element={<Navigate to={AUTH_ROUTES.emailConfirm} replace />} />
      <Route path={AUTH_ROUTES.staffDashboard} element={<StaffDashboard />} />
      <Route path="/staff/profile" element={<ProfileStaffScreen />} />
      <Route path="/staff/notifications" element={<NotificationsStaffScreen />} />
      <Route path="*" element={<Navigate to={AUTH_ROUTES.login} replace />} />
    </Routes>
  )
}

export default AppRouter
