import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { buildCreateQuestionJobPayload } from '../utils/groundedQuestionUi.js'

const previousReact = globalThis.React
let CandidateCard

beforeAll(async () => {
  globalThis.React = React
  CandidateCard = (await import('./DocumentQuestionJobReviewPage.jsx')).CandidateCard
})

afterAll(() => {
  globalThis.React = previousReact
})

describe('Grounded question generation UI', () => {
  it('builds the modal payload with pipeline, difficulty and maximum count', () => {
    expect(buildCreateQuestionJobPayload({
      questionsPerChunk: 9,
      categoryId: '12',
      pipelineVersion: 'GROUNDED_V4',
      targetDifficulty: 'HARD',
    })).toEqual({
      questionsPerChunk: 5,
      categoryId: 12,
      pipelineVersion: 'GROUNDED_V4',
      targetDifficulty: 'HARD',
    })
  })

  it('shows evidence and critic state while preventing approval of rejected candidates', () => {
    const noop = vi.fn()
    render(
      <MemoryRouter>
        <CandidateCard
          candidate={{
            id: 1,
            status: 'REJECTED',
            label: 'REJECTED',
            validationGrade: 'REJECT',
            validationSource: 'RULES_AND_CRITIC',
            evidenceStatus: 'EXACT',
            criticStatus: 'FAILED',
            validationIssues: '["Đáp án chưa được nguồn hỗ trợ"]',
            stem: 'Dấu hiệu nào cần theo dõi?',
            optionA: 'Mạch nhanh',
            optionB: 'Ăn ngon',
            optionC: 'Ngủ sâu',
            optionD: 'Da ấm',
            correctAnswer: 'A',
            difficulty: 'medium',
            sourceExcerpt: 'Mạch nhanh là dấu hiệu cảnh báo.',
            answerEvidence: 'Mạch nhanh',
            knowledgePointKey: 'KP1',
            questionType: 'CLINICAL',
            pageStart: 2,
            pageEnd: 3,
            sectionPath: 'Theo dõi',
          }}
          isSelected
          isChecked={false}
          isBusy={false}
          onSelect={noop}
          onToggleSelection={noop}
          onEdit={noop}
          onApprove={noop}
          onReject={noop}
          onSave={noop}
          onViewDuplicates={noop}
          onOpenSavedQuestion={noop}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Grounding và kiểm định')).toBeInTheDocument()
    expect(screen.getByText(/Trang 2–3 · Theo dõi/)).toBeInTheDocument()
    expect(screen.getByText((_, element) => (
      element?.tagName === 'P' && element.textContent.includes('Critic: FAILED')
    ))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Duyệt/ })).toBeDisabled()
  })
})
