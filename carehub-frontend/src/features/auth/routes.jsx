import { Route, Routes } from 'react-router-dom'
import EmailConfirmScreen from './pages/EmailConfirmScreen.jsx'
import ForgotAccountScreen from './pages/ForgotAccountScreen.jsx'
import LoginScreen from './pages/LoginScreen.jsx'
import OtpScreen from './pages/OtpScreen.jsx'
import ResetPasswordScreen from './pages/ResetPasswordScreen.jsx'

export default function AuthRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginScreen />} />
      <Route path="forgot-password" element={<ForgotAccountScreen />} />
      <Route path="email-confirm" element={<EmailConfirmScreen />} />
      <Route path="otp" element={<OtpScreen />} />
      <Route path="reset-password" element={<ResetPasswordScreen />} />
    </Routes>
  )
}
