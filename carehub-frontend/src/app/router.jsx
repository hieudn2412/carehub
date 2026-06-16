import { Navigate, Route, Routes } from 'react-router-dom'
import EmailConfirmOtpScreen from '../features/auth/pages/EmailConfirmOtpScreen.jsx'
import EmailConfirmResetScreen from '../features/auth/pages/EmailConfirmResetScreen.jsx'
import EmailConfirmScreen from '../features/auth/pages/EmailConfirmScreen.jsx'
import EmailConfirmSuccessScreen from '../features/auth/pages/EmailConfirmSuccessScreen.jsx'
import ForgotAccountScreen from '../features/auth/pages/ForgotAccountScreen.jsx'
import LoginScreen from '../features/auth/pages/LoginScreen.jsx'
import OtpScreen from '../features/auth/pages/OtpScreen.jsx'
import ResetPasswordScreen from '../features/auth/pages/ResetPasswordScreen.jsx'
import TrainingFoundationPage from '../features/training/pages/TrainingFoundationPage.jsx'
import { AUTH_ROUTES } from '../features/auth/constants/authRoutes.js'

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
      <Route path="/email-confirm" element={<Navigate to={AUTH_ROUTES.emailConfirm} replace />} />
      <Route path="*" element={<Navigate to={AUTH_ROUTES.login} replace />} />
    </Routes>
  )
}

export default AppRouter
