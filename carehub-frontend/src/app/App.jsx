import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthRoutes from '../features/auth/routes.jsx'
import { AUTH_ROUTES } from '../features/auth/constants/routes.js'
import '../shared/styles/auth.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/*" element={<AuthRoutes />} />
        <Route path="/" element={<Navigate to={AUTH_ROUTES.login} replace />} />
        <Route path="*" element={<Navigate to={AUTH_ROUTES.login} replace />} />
        <Route path="/email-confirm" element={<Navigate to={AUTH_ROUTES.emailConfirm} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
