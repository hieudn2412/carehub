import { Outlet } from 'react-router-dom'
import Sidebar from '../features/admin/components/Sidebar'
import './AdminLayout.css'

function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-layout__main">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout