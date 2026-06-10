import { useState } from 'react'
import ForgotAccountScreen from '../features/auth/pages/ForgotAccountScreen.jsx'
import LoginScreen from '../features/auth/pages/LoginScreen.jsx'
import OtpScreen from '../features/auth/pages/OtpScreen.jsx'
import ResetPasswordScreen from '../features/auth/pages/ResetPasswordScreen.jsx'
import '../shared/styles/auth.css'

function App() {
  const [screen, setScreen] = useState('login')

  if (screen === 'forgot') {
    return (
      <ForgotAccountScreen
        onBack={() => setScreen('login')}
        onNext={() => setScreen('otp')}
      />
    )
  }

  if (screen === 'otp') {
    return (
      <OtpScreen
        onBack={() => setScreen('forgot')}
        onNext={() => setScreen('reset')}
      />
    )
  }

  if (screen === 'reset') {
    return (
      <ResetPasswordScreen
        onBack={() => setScreen('otp')}
        onDone={() => setScreen('login')}
      />
    )
  }

  return <LoginScreen onForgotPassword={() => setScreen('forgot')} />
}

export default App
