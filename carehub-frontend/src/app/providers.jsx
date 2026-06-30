import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '../shared/context/ToastContext.jsx'

function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <ToastProvider>
        {children}
      </ToastProvider>
    </BrowserRouter>
  )
}

export default AppProviders
