import { Outlet } from 'react-router-dom'
import Sidebar from '../features/staff/components/Sidebar'
import './StaffLayout.css'

function StaffLayout() {
  return (
    <div className="staff-layout">
      <Sidebar />
      <main className="staff-layout__main">
        <Outlet />
      </main>
    </div>
  )
}

export default StaffLayout