import { CheckOutlined } from '@ant-design/icons'
import { NavLink, useLocation } from 'react-router-dom'
import './EvaluationWorkflow.css'

const STEPS = [
  { key: 'documents', label: 'Tài liệu', shortLabel: 'Tài liệu', path: '/admin/evaluation/question-documents' },
  { key: 'questions', label: 'Câu hỏi', shortLabel: 'Câu hỏi', path: '/admin/evaluation/question-bank' },
  { key: 'sets', label: 'Bộ câu hỏi', shortLabel: 'Bộ câu hỏi', path: '/admin/evaluation/question-sets' },
  { key: 'exams', label: 'Bài kiểm tra', shortLabel: 'Bài kiểm tra', path: '/admin/evaluation/exam-management' },
  { key: 'competency', label: 'Năng lực', shortLabel: 'Năng lực', path: '/admin/evaluation/competency' },
]

function getActiveIndex(pathname) {
  if (pathname.startsWith('/admin/evaluation/question-documents') || pathname.startsWith('/admin/evaluation/document-question-jobs')) return 0
  if (pathname.startsWith('/admin/evaluation/question-bank') || pathname.startsWith('/admin/evaluation/paraphrase-jobs')) return 1
  if (pathname.startsWith('/admin/evaluation/question-set')) return 2
  if (pathname.startsWith('/admin/evaluation/exam-')) return 3
  if (pathname.startsWith('/admin/evaluation/exam-management')) return 3
  if (pathname.startsWith('/admin/evaluation/competency') || pathname.startsWith('/admin/evaluation/compliance')) return 4
  return -1
}

export default function EvaluationWorkflow() {
  const { pathname } = useLocation()
  const activeIndex = getActiveIndex(pathname)
  if (activeIndex < 0) return null

  return (
    <nav className="evaluation-workflow" aria-label="Quy trình đánh giá">
      <span className="evaluation-workflow__eyebrow">QUY TRÌNH ĐÁNH GIÁ</span>
      <ol className="evaluation-workflow__steps">
        {STEPS.map((step, index) => (
          <li key={step.key} className={`evaluation-workflow__step ${index === activeIndex ? 'is-current' : ''} ${index < activeIndex ? 'is-complete' : ''}`}>
            <NavLink to={step.path} className="evaluation-workflow__link" aria-current={index === activeIndex ? 'step' : undefined}>
              <span className="evaluation-workflow__number">
                {index < activeIndex ? <CheckOutlined aria-hidden="true" /> : index + 1}
              </span>
              <span>{step.label}</span>
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  )
}
