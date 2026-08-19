import AppShell from '../../../../shared/components/AppShell.jsx'
import DepartmentTrainingStaffTable from '../../../training/components/DepartmentTrainingStaffTable.jsx'
import '../../styles/ManagerPages.css'

/**
 * Danh sách nhân sự trong khoa. Bảng và bộ lọc dùng chung với dashboard đào tạo liên tục
 * của Manager, nên hai nơi luôn hiển thị cùng dữ liệu và cùng điều hướng chi tiết.
 */
function ManagerEmployeeListPage() {
  return (
    <AppShell title="Nhân sự trong khoa">
      <div className="mgr-card">
        <DepartmentTrainingStaffTable />
      </div>
    </AppShell>
  )
}

export default ManagerEmployeeListPage
