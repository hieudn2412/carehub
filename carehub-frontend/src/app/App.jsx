// Thứ tự nạp CSS toàn cục (global.css nạp trước đó ở main.jsx):
// ui.css + layout.css là lớp base — phải đứng TRƯỚC import router
// (router kéo theo CSS của từng trang) để trang override được base.
// auth.css + EvaluationResponsive.css giữ sau cùng như trước.
import '../shared/styles/ui.css'
import '../shared/styles/layout.css'
import AppProviders from './providers.jsx'
import AppRouter from './router.jsx'
import '../shared/styles/admin-tables.css'
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
