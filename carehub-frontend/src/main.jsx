import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/global.css'
import App from './app/App.jsx'
import { prepareCriticalStyles } from './app/criticalStyles.js'

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Vite phát CSS của dynamic import thành một asset riêng có hash. Chờ asset
// auth tải xong trước khi render để không có frame dùng style desktop mặc định.
void prepareCriticalStyles().then(renderApp)
