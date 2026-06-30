package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateDocumentQuestionCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.CandidateValidationResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CandidateReviewService {
    private final DocumentQuestionCandidateRepository candidateRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final QuestionCandidateValidationService validationService;
    private final DuplicateCheckService duplicateCheckService;
    private final QuestionEmbeddingService questionEmbeddingService;
    private final DocumentQuestionMapper mapper;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public DocumentQuestionCandidateResponse get(Long candidateId) {
        return mapper.toCandidateResponse(findCandidate(candidateId));
    }

    @Transactional
    public DocumentQuestionCandidateResponse update(Long candidateId, UpdateDocumentQuestionCandidateRequest request) {
        DocumentQuestionCandidate candidate = findCandidate(candidateId);
        candidate.setStem(request.stem().trim());
        candidate.setOptionA(request.optionA().trim());
        candidate.setOptionB(request.optionB().trim());
        candidate.setOptionC(request.optionC().trim());
        candidate.setOptionD(request.optionD().trim());
        candidate.setCorrectAnswer(request.correctAnswer().trim().toUpperCase());
        candidate.setExplanation(trimToNull(request.explanation()));
        candidate.setDifficulty(trimToNull(request.difficulty()));
        candidate.setTopic(trimToNull(request.topic()));
        candidate.setSourceExcerpt(request.sourceExcerpt().trim());
        candidate.setReviewerNotes(trimToNull(request.reviewerNotes()));
        revalidate(candidate);
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public DocumentQuestionCandidateResponse approve(Long candidateId, String reviewerNotes) {
        DocumentQuestionCandidate candidate = findCandidate(candidateId);
        if (candidate.getStatus() == CandidateStatus.REJECTED) {
            throw new BadRequestException("Không thể duyệt câu hỏi đã bị từ chối bởi validation");
        }
        candidate.setStatus(CandidateStatus.APPROVED);
        candidate.setLabel(CandidateLabel.GOOD);
        if (reviewerNotes != null && !reviewerNotes.isBlank()) {
            candidate.setReviewerNotes(reviewerNotes.trim());
        }
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public DocumentQuestionCandidateResponse reject(Long candidateId, String reviewerNotes) {
        DocumentQuestionCandidate candidate = findCandidate(candidateId);
        candidate.setStatus(CandidateStatus.REJECTED);
        candidate.setLabel(CandidateLabel.REJECTED);
        if (reviewerNotes != null && !reviewerNotes.isBlank()) {
            candidate.setReviewerNotes(reviewerNotes.trim());
        }
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public DocumentQuestionCandidateResponse saveAsQuestion(Long candidateId, String actor) {
        DocumentQuestionCandidate candidate = findCandidate(candidateId);
        if (candidate.getStatus() != CandidateStatus.APPROVED) {
            throw new BadRequestException("Chỉ có thể lưu câu hỏi đã được duyệt vào ngân hàng câu hỏi");
        }
        QuestionBankQuestion question = QuestionBankQuestion.builder()
                .stem(candidate.getStem())
                .optionA(candidate.getOptionA())
                .optionB(candidate.getOptionB())
                .optionC(candidate.getOptionC())
                .optionD(candidate.getOptionD())
                .correctAnswer(candidate.getCorrectAnswer())
                .explanation(candidate.getExplanation())
                .topic(candidate.getTopic())
                .difficulty(candidate.getDifficulty())
                .language("vi")
                .sourceDocument(candidate.getDocument().getFilename())
                .questionType(QuestionType.ORIGINAL)
                .status(QuestionBankStatus.APPROVED)
                .createdBy(actor)
                .reviewedBy(actor)
                .build();
        QuestionBankQuestion saved = questionRepository.save(question);
        questionEmbeddingService.saveStemEmbedding(saved);
        candidate.setSavedQuestionId(saved.getId());
        candidate.setStatus(CandidateStatus.SAVED);
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    private void revalidate(DocumentQuestionCandidate candidate) {
        GeneratedQuestion generated = new GeneratedQuestion(
                candidate.getStem(),
                candidate.getOptionA(),
                candidate.getOptionB(),
                candidate.getOptionC(),
                candidate.getOptionD(),
                candidate.getCorrectAnswer(),
                candidate.getExplanation(),
                candidate.getDifficulty(),
                candidate.getTopic(),
                candidate.getSourceExcerpt(),
                candidate.getKnowledgePointKey(),
                candidate.getRawJson(),
                candidate.getLlmValidation()
        );
        CandidateValidationResult validation = validationService.validate(generated, candidate.getChunk().getText());
        DuplicateCheckResult duplicate = duplicateCheckService.check(candidate.getStem());
        List<String> warnings = new ArrayList<>(validation.warnings());
        if (duplicate.warning() != null && !duplicate.warning().isBlank()) {
            warnings.add(duplicate.warning());
        }
        if (validation.rejected()) {
            candidate.setStatus(CandidateStatus.REJECTED);
            candidate.setLabel(CandidateLabel.REJECTED);
        } else if (duplicate.strongDuplicate()) {
            candidate.setStatus(CandidateStatus.REJECTED);
            candidate.setLabel(CandidateLabel.REJECTED);
            warnings.add("Trùng ngữ nghĩa mạnh với câu hỏi đã có");
        } else if (validation.needsReview() || duplicate.needsReview()) {
            candidate.setStatus(CandidateStatus.NEED_REVIEW);
            candidate.setLabel(CandidateLabel.NEED_REVIEW);
            if (duplicate.needsReview()) {
                warnings.add("Có khả năng trùng ngữ nghĩa với câu hỏi đã có");
            }
        } else {
            candidate.setStatus(CandidateStatus.VALIDATED);
            candidate.setLabel(CandidateLabel.GOOD);
        }
        candidate.setQualityScore(validation.qualityScore());
        candidate.setWarnings(toJson(warnings));
        candidate.setDuplicateMaxSimilarity(duplicate.maxSimilarity());
        candidate.setDuplicateQuestionId(duplicate.matchedQuestionId());
        candidate.setDuplicateQuestionStemSnapshot(duplicate.matchedQuestionStem());
    }

    private DocumentQuestionCandidate findCandidate(Long candidateId) {
        return candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi đề xuất"));
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }
}
