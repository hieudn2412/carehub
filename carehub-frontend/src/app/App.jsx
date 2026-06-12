import AppProviders from './providers.jsx'
import AppRouter from './router.jsx'
import '../features/auth/styles/auth.css'

function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}

export default App
