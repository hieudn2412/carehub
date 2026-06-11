import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginScreen from '../features/auth/pages/LoginScreen.jsx'
import ForgotAccountScreen from '../features/auth/pages/ForgotAccountScreen.jsx'
import EmailConfirmScreen from '../features/auth/pages/EmailConfirmScreen.jsx'
import EmailConfirmOtpScreen from '../features/auth/pages/EmailConfirmOtpScreen.jsx'
import EmailConfirmResetScreen from '../features/auth/pages/EmailConfirmResetScreen.jsx'
import EmailConfirmSuccessScreen from '../features/auth/pages/EmailConfirmSuccessScreen.jsx'
import OtpScreen from '../features/auth/pages/OtpScreen.jsx'
import ResetPasswordScreen from '../features/auth/pages/ResetPasswordScreen.jsx'

export const AUTH_ROUTES = {
  login: '/auth/login',
  forgotPassword: '/auth/forgot-password',
  emailConfirm: '/auth/email-confirm',
  emailConfirmOtp: '/auth/email-confirm-otp',
  emailConfirmReset: '/auth/email-confirm-reset',
  emailConfirmSuccess: '/auth/email-confirm-success',
  otp: '/auth/otp',
  resetPassword: '/auth/reset-password',
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to={AUTH_ROUTES.login} replace />,
  },
  {
    path: '/auth',
    children: [
      {
        path: '',
        element: <Navigate to={AUTH_ROUTES.login} replace />,
      },
      {
        path: 'login',
        element: <LoginScreen />,
      },
      {
        path: 'forgot-password',
        element: <ForgotAccountScreen />,
      },
      {
        path: 'email-confirm',
        element: <EmailConfirmScreen />,
      },
      {
        path: 'email-confirm-otp',
        element: <EmailConfirmOtpScreen />,
      },
      {
        path: 'email-confirm-reset',
        element: <EmailConfirmResetScreen />,
      },
      {
        path: 'email-confirm-success',
        element: <EmailConfirmSuccessScreen />,
      },
      {
        path: 'otp',
        element: <OtpScreen />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordScreen />,
      },
    ],
  },
  {
    path: '/email-confirm',
    element: <Navigate to={AUTH_ROUTES.emailConfirm} replace />,
  },
  {
    path: '*',
    element: <Navigate to={AUTH_ROUTES.login} replace />,
  },
])
