import { FileTextOutlined, ScheduleOutlined } from '@ant-design/icons'

function ExamManagementViewSwitch({ activeView, onChange, canViewPapers = true, canViewAssignments = true }) {
  return (
    <div className="exp-view-switch" role="tablist" aria-label="Nội dung quản lý bài kiểm tra">
      {canViewPapers && (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'papers'}
          className={activeView === 'papers' ? 'is-active' : ''}
          onClick={() => onChange('papers')}
        >
          <FileTextOutlined />
          Kho bài kiểm tra
        </button>
      )}
      {canViewAssignments && (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'assignments'}
          className={activeView === 'assignments' ? 'is-active' : ''}
          onClick={() => onChange('assignments')}
        >
          <ScheduleOutlined />
          Bài đã giao
        </button>
      )}
    </div>
  )
}

export default ExamManagementViewSwitch
