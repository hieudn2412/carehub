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
}, 30_000)

afterAll(() => {
  globalThis.React = previousReact
})

describe('Grounded question generation UI', () => {
  it('builds the modal payload with cognitive level and maximum count', () => {
    expect(buildCreateQuestionJobPayload({
      questionsPerChunk: 9,
      categoryId: '12',
      targetCognitiveLevel: 'CLINICAL_REASONING_ANALYSIS',
    })).toEqual({
      questionsPerChunk: 5,
      categoryId: 12,
      targetCognitiveLevel: 'CLINICAL_REASONING_ANALYSIS',
    })
  })

  it('shows the page reference in the explanation box while preventing approval of rejected candidates', () => {
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
            cognitiveLevel: 'CLINICAL_APPLICATION',
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

    expect(screen.getByText('Giải thích')).toBeInTheDocument()
    expect(screen.getByText('Trang 2–3')).toBeInTheDocument()
    expect(screen.queryByText('Nguồn trích dẫn')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Duyệt/ })).toBeDisabled()
  })

  it('renders cards without explanation or page reference cleanly', () => {
    const noop = vi.fn()
    render(
      <MemoryRouter>
        <CandidateCard
          candidate={{
            id: 2,
            status: 'GENERATED',
            stem: 'Dấu hiệu nào cần theo dõi?',
            optionA: 'Mạch nhanh',
            optionB: 'Ăn ngon',
            optionC: 'Ngủ sâu',
            optionD: 'Da ấm',
            correctAnswer: 'A',
            cognitiveLevel: 'FOUNDATION',
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

    expect(screen.queryByText('Giải thích')).not.toBeInTheDocument()
    expect(screen.queryByText('Nguồn trích dẫn')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sửa/ })).toBeInTheDocument()
  })
})
