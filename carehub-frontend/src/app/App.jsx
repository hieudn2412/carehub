// Thứ tự nạp CSS toàn cục (global.css nạp trước đó ở main.jsx):
// ui.css + layout.css là lớp base — phải đứng TRƯỚC import router
// (router kéo theo CSS của từng trang) để trang override được base.
// EvaluationResponsive.css giữ sau cùng như trước. CSS auth được tải như một
// chunk riêng trong main.jsx để tránh nằm ở cuối bundle CSS toàn ứng dụng.
import '../shared/styles/ui.css'
import '../shared/styles/layout.css'
import { configureHttpClientAuth } from '../shared/api/httpClient.js'
import { tokenStorage } from '../shared/auth/tokenStorage.js'
import AppProviders from './providers.jsx'
import AppRouter from './router.jsx'
import PageMetadata from './PageMetadata.jsx'
import '../shared/styles/admin-tables.css'
import '../features/evaluation/styles/EvaluationResponsive.css'

configureHttpClientAuth(tokenStorage)

function App() {
  return (
    <AppProviders>
      <PageMetadata />
      <AppRouter />
    </AppProviders>
  )
}

export default App
