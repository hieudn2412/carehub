import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EVALUATION_PERMISSION, getCurrentEvaluationAccess } from '../utils/evaluationPermissions.js'
import ExamAssignmentListPage from './ExamAssignmentListPage.jsx'
import ExamPaperListPage from './ExamPaperListPage.jsx'

const PAPER_PERMISSIONS = [
  EVALUATION_PERMISSION.examConfigManager,
  EVALUATION_PERMISSION.examPublisher,
]

function ExamManagementPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const access = getCurrentEvaluationAccess()
  const canViewPapers = access.hasAny(PAPER_PERMISSIONS)
  const canViewAssignments = access.hasAny([EVALUATION_PERMISSION.assignmentManager])
  const requestedView = searchParams.get('view')
  const activeView = requestedView === 'assignments' && canViewAssignments
    ? 'assignments'
    : canViewPapers
      ? 'papers'
      : 'assignments'

  useEffect(() => {
    if (requestedView !== activeView) {
      navigate(`/admin/evaluation/exam-management?view=${activeView}`, { replace: true })
    }
  }, [activeView, navigate, requestedView])

  function changeView(view) {
    navigate(`/admin/evaluation/exam-management?view=${view}`)
  }

  const viewProps = {
    activeView,
    canViewPapers,
    canViewAssignments,
    onViewChange: changeView,
  }

  return activeView === 'assignments'
    ? <ExamAssignmentListPage {...viewProps} />
    : <ExamPaperListPage {...viewProps} />
}

export default ExamManagementPage
