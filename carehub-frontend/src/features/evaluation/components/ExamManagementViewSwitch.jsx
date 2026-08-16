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
          Kho mã đề
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
          Đợt giao & kết quả
        </button>
      )}
    </div>
  )
}

export default ExamManagementViewSwitch
