import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EvaluationWorkflow from './EvaluationWorkflow.jsx'

const previousReact = globalThis.React

beforeAll(() => {
  globalThis.React = React
})

afterAll(() => {
  globalThis.React = previousReact
})

const ROUTES = [
  ['/admin/evaluation/question-documents', 'Tài liệu', 0],
  ['/admin/evaluation/question-bank', 'Câu hỏi', 1],
  ['/admin/evaluation/question-sets', 'Bộ câu hỏi', 2],
  ['/admin/evaluation/exam-management', 'Bài kiểm tra', 3],
  ['/admin/evaluation/competency', 'Năng lực', 4],
]

describe('EvaluationWorkflow', () => {
  it.each(ROUTES)(
    'marks %s as the current page without rendering ordinal numbers',
    (route, currentLabel, completedCount) => {
      const { container } = render(
        <MemoryRouter initialEntries={[route]}>
          <EvaluationWorkflow />
        </MemoryRouter>,
      )

      const workflow = screen.getByRole('navigation', { name: 'Quy trình đánh giá' })
      expect(screen.getByRole('link', { name: currentLabel })).toHaveAttribute('aria-current', 'step')
      expect(workflow).not.toHaveTextContent(/\b[1-5]\b/)
      expect(container.querySelectorAll('.evaluation-workflow__marker')).toHaveLength(completedCount)
    },
  )
})
