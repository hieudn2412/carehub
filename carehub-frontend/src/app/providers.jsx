import { BrowserRouter } from 'react-router-dom'

function AppProviders({ children }) {
  return <BrowserRouter>{children}</BrowserRouter>
}

export default AppProviders
