import { RouterProvider } from 'react-router-dom'
import { router } from './router.jsx'
import '../shared/styles/auth.css'

function App() {
  return <RouterProvider router={router} />
}

export default App
