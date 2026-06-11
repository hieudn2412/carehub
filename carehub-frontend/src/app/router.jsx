import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginScreen from '../features/auth/pages/LoginScreen.jsx'
import ForgotAccountScreen from '../features/auth/pages/ForgotAccountScreen.jsx'
import EmailConfirmScreen from '../features/auth/pages/EmailConfirmScreen.jsx'
import OtpScreen from '../features/auth/pages/OtpScreen.jsx'
import ResetPasswordScreen from '../features/auth/pages/ResetPasswordScreen.jsx'
import { AUTH_ROUTES } from '../features/auth/constants/routes.js'

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
