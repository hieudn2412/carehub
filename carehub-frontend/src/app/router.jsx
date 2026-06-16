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
import { AUTH_ROUTES } from '../features/auth/constants/authRoutes.js'
import ProfileStaffScreen from '../features/staff/pages/ProfileStaffScreen.jsx'

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
      <Route path="/training" element={<TrainingFoundationPage />} />
      <Route path="/admin/training/activity-types" element={<ActivityTypeListPage />} />
      <Route path="/admin/training/activity-types/new" element={<ActivityTypeFormPage />} />
      <Route path="/admin/training/activity-types/:id" element={<ActivityTypeDetailPage />} />
      <Route path="/admin/training/activity-types/:id/edit" element={<ActivityTypeFormPage />} />
      <Route path="/email-confirm" element={<Navigate to={AUTH_ROUTES.emailConfirm} replace />} />
      <Route path={AUTH_ROUTES.staffDashboard} element={<StaffDashboard />} />
      <Route path="*" element={<Navigate to={AUTH_ROUTES.login} replace />} />
      <Route path="/staff/profile" element={<ProfileStaffScreen />} />
    </Routes>
  )
}

export default AppRouter
