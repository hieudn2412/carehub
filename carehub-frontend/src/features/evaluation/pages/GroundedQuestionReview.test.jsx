import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { buildCreateQuestionJobPayload } from '../utils/groundedQuestionUi.js'
import { CandidateCard } from './DocumentQuestionJobReviewPage.jsx'

describe('Grounded question generation UI', () => {
  it('builds the modal payload with the cognitive mix and maximum count', () => {
    expect(buildCreateQuestionJobPayload({
      questionsPerChunk: 9,
      categoryId: '12',
      targetCognitiveLevel: 'AUTO',
      cognitiveMix: { foundation: 20, application: 50, reasoning: 30 },
    })).toEqual({
      questionsPerChunk: 5,
      categoryId: 12,
      pipelineVersion: 'GROUNDED_V4',
      targetCognitiveLevel: 'AUTO',
      cognitiveMixFoundation: 20,
      cognitiveMixApplication: 50,
      cognitiveMixReasoning: 30,
    })
  })

  it('shows the page reference in the explanation box while preventing saving of rejected candidates', () => {
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
    // Nút Duyệt đã bị bỏ, chỉ còn Lưu vào ngân hàng câu hỏi và nút này phải bị khoá với câu đã từ chối.
    expect(screen.queryByRole('button', { name: /^Duyệt$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lưu vào ngân hàng câu hỏi/ })).toBeDisabled()
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

  it('keeps a strong duplicate visible but lets the reviewer save an approved candidate', () => {
    const noop = vi.fn()
    render(
      <MemoryRouter>
        <CandidateCard
          candidate={{
            id: 3,
            status: 'APPROVED',
            stem: 'Cần đối chiếu bao nhiêu thông tin người bệnh?',
            optionA: 'Hai thông tin',
            optionB: 'Một thông tin',
            optionC: 'Ba thông tin',
            optionD: 'Không cần',
            correctAnswer: 'A',
            cognitiveLevel: 'FOUNDATION',
            duplicateNeedsReview: true,
            strongDuplicate: true,
            duplicateMaxSimilarity: 0.98,
          }}
          isSelected
          isChecked={false}
          isBusy={false}
          onSelect={noop}
          onToggleSelection={noop}
          onEdit={noop}
          onReject={noop}
          onSave={noop}
          onViewDuplicates={noop}
          onOpenSavedQuestion={noop}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Phát hiện câu trùng mạnh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lưu vào ngân hàng câu hỏi/ })).toBeEnabled()
  })
})
