import AppProviders from './providers.jsx'
import AppRouter from './router.jsx'
import '../features/auth/styles/auth.css'
import '../features/evaluation/styles/EvaluationResponsive.css'

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}

export default App
