import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ExamAssignmentListPage from './ExamAssignmentListPage.jsx'

function ExamManagementPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedView = searchParams.get('view')

  useEffect(() => {
    if (requestedView !== 'assignments') {
      navigate('/admin/evaluation/exam-management?view=assignments', { replace: true })
    }
  }, [navigate, requestedView])

  return <ExamAssignmentListPage />
}

export default ExamManagementPage
