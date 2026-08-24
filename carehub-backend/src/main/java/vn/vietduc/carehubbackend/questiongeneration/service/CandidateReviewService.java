package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.BatchDocumentQuestionCandidateActionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateDocumentQuestionCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.BatchCandidateActionErrorResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.BatchDocumentQuestionCandidateActionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionDuplicateMatchResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.CandidateValidationResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateMatchResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.time.LocalDateTime;

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
    private final QuestionClassificationRuleService classificationRuleService;
    private QuestionCategoryRepository questionCategoryRepository;
    private ProfessionalFieldRepository professionalFieldRepository;

    @org.springframework.beans.factory.annotation.Autowired
    void setQuestionCategoryRepository(QuestionCategoryRepository repository) {
        this.questionCategoryRepository = repository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setProfessionalFieldRepository(ProfessionalFieldRepository repository) {
        this.professionalFieldRepository = repository;
    }

    @Transactional(readOnly = true)
    public DocumentQuestionCandidateResponse get(Long candidateId) {
        return mapper.toCandidateResponse(findCandidate(candidateId));
    }

    @Transactional(readOnly = true)
    public List<QuestionDuplicateMatchResponse> potentialDuplicates(Long candidateId) {
        DocumentQuestionCandidate candidate = findCandidate(candidateId);
        return duplicateCheckService.findPotentialMatches(
                        candidate.getStem(),
                        Set.of(),
                        Set.of(candidate.getId()),
                        5
                ).stream()
                .map(this::toDuplicateMatchResponse)
                .toList();
    }

    private QuestionDuplicateMatchResponse toDuplicateMatchResponse(DuplicateMatchResult match) {
        if (match.sourceType() == DuplicateMatchResult.SourceType.QUESTION_BANK) {
            QuestionBankQuestion question = questionRepository.findById(match.sourceId()).orElse(null);
            return new QuestionDuplicateMatchResponse(
                    match.sourceType().name(),
                    match.sourceId(),
                    match.stem(),
                    question == null ? null : question.getOptionA(),
                    question == null ? null : question.getOptionB(),
                    question == null ? null : question.getOptionC(),
                    question == null ? null : question.getOptionD(),
                    question == null ? null : question.getCorrectAnswer(),
                    question == null ? null : question.getSourceDocument(),
                    question == null || question.getStatus() == null ? null : question.getStatus().name(),
                    match.similarity(),
                    match.strongDuplicate()
            );
        }
        DocumentQuestionCandidate candidate = candidateRepository.findById(match.sourceId()).orElse(null);
        return new QuestionDuplicateMatchResponse(
                match.sourceType().name(),
                match.sourceId(),
                match.stem(),
                candidate == null ? null : candidate.getOptionA(),
                candidate == null ? null : candidate.getOptionB(),
                candidate == null ? null : candidate.getOptionC(),
                candidate == null ? null : candidate.getOptionD(),
                candidate == null ? null : candidate.getCorrectAnswer(),
                candidate == null || candidate.getDocument() == null ? null : candidate.getDocument().getFilename(),
                candidate == null || candidate.getStatus() == null ? null : candidate.getStatus().name(),
                match.similarity(),
                match.strongDuplicate()
        );
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
        candidate.setTopic(trimToNull(request.topic()));
        if (request.categoryId() != null) {
            candidate.setCategory(resolveCategory(request.categoryId()));
        }
        if (request.professionalFieldId() != null) {
            candidate.setProfessionalField(resolveProfessionalField(request.professionalFieldId()));
        }
        if (request.cognitiveLevel() != null) {
            CognitiveLevel cognitiveLevel = parseCognitiveLevel(request.cognitiveLevel());
            candidate.setCognitiveLevel(cognitiveLevel);
            candidate.setCognitiveVerifiedAt(null);
            candidate.setCognitiveVerifiedBy(null);
        }
        candidate.setSourceExcerpt(request.sourceExcerpt().trim());
        candidate.setReviewerNotes(trimToNull(request.reviewerNotes()));
        revalidate(candidate);
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public DocumentQuestionCandidateResponse approve(Long candidateId, String reviewerNotes) {
        return approve(candidateId, reviewerNotes, "reviewer");
    }

    @Transactional
    public DocumentQuestionCandidateResponse approve(Long candidateId, String reviewerNotes, String actor) {
        DocumentQuestionCandidate candidate = findCandidate(candidateId);
        if (candidate.getStatus() == CandidateStatus.REJECTED) {
            throw new BadRequestException("Không thể duyệt câu hỏi đã bị từ chối bởi validation");
        }
        requireReviewedTaxonomy(candidate);
        candidate.setStatus(CandidateStatus.APPROVED);
        candidate.setLabel(CandidateLabel.GOOD);
        candidate.setCognitiveVerifiedAt(LocalDateTime.now());
        candidate.setCognitiveVerifiedBy(actor == null || actor.isBlank() ? "reviewer" : actor);
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
        if (candidate.getSourceExcerpt() == null || candidate.getSourceExcerpt().isBlank()) {
            throw new BadRequestException("Câu hỏi cần có trích dẫn nguồn trước khi lưu vào ngân hàng câu hỏi");
        }
        requireReviewedTaxonomy(candidate);
        if (isGenericDocumentReferenceStem(candidate.getStem())) {
            throw new BadRequestException("Câu hỏi cần tự đứng độc lập, không được dùng mẫu chung như 'Theo tài liệu...'");
        }
        QuestionBankQuestion question = QuestionBankQuestion.builder()
                .stem(candidate.getStem())
                .optionA(candidate.getOptionA())
                .optionB(candidate.getOptionB())
                .optionC(candidate.getOptionC())
                .optionD(candidate.getOptionD())
                .correctAnswer(candidate.getCorrectAnswer())
                .explanation(candidate.getExplanation())
                .category(candidate.getCategory() != null
                        ? candidate.getCategory()
                        : (candidate.getJob() == null ? null : candidate.getJob().getCategory()))
                .professionalField(candidate.getProfessionalField())
                .cognitiveLevel(candidate.getCognitiveLevel())
                .cognitiveVerifiedAt(candidate.getCognitiveVerifiedAt())
                .cognitiveVerifiedBy(candidate.getCognitiveVerifiedBy())
                .language("vi")
                .sourceDocument(candidate.getDocument().getFilename())
                .sourceDocumentRef(candidate.getDocument())
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

    @Transactional
    public BatchDocumentQuestionCandidateActionResponse approveBatch(
            BatchDocumentQuestionCandidateActionRequest request
    ) {
        return approveBatch(request, "reviewer");
    }

    @Transactional
    public BatchDocumentQuestionCandidateActionResponse approveBatch(
            BatchDocumentQuestionCandidateActionRequest request,
            String actor
    ) {
        return runBatch(request, candidateId -> approve(candidateId, request == null ? null : request.reviewerNotes(), actor));
    }

    @Transactional
    public BatchDocumentQuestionCandidateActionResponse rejectBatch(
            BatchDocumentQuestionCandidateActionRequest request
    ) {
        return runBatch(request, candidateId -> reject(candidateId, request == null ? null : request.reviewerNotes()));
    }

    @Transactional
    public BatchDocumentQuestionCandidateActionResponse saveBatch(
            BatchDocumentQuestionCandidateActionRequest request,
            String actor
    ) {
        return runBatch(request, candidateId -> saveAsQuestion(candidateId, actor));
    }

    private BatchDocumentQuestionCandidateActionResponse runBatch(
            BatchDocumentQuestionCandidateActionRequest request,
            CandidateAction action
    ) {
        List<Long> candidateIds = normalizedCandidateIds(request);
        List<Long> succeededIds = new ArrayList<>();
        List<BatchCandidateActionErrorResponse> errors = new ArrayList<>();
        List<DocumentQuestionCandidateResponse> candidates = new ArrayList<>();

        for (Long candidateId : candidateIds) {
            try {
                DocumentQuestionCandidateResponse response = action.apply(candidateId);
                succeededIds.add(candidateId);
                candidates.add(response);
            } catch (Exception ex) {
                errors.add(new BatchCandidateActionErrorResponse(
                        candidateId,
                        ex.getMessage() == null ? "Thao tác candidate thất bại" : ex.getMessage()
                ));
            }
        }

        return new BatchDocumentQuestionCandidateActionResponse(
                candidateIds.size(),
                succeededIds.size(),
                errors.size(),
                succeededIds,
                errors,
                candidates
        );
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
                candidate.getCognitiveLevel() == null ? null : candidate.getCognitiveLevel().name(),
                candidate.getTopic(),
                candidate.getSourceExcerpt(),
                candidate.getKnowledgePointKey(),
                candidate.getRawJson(),
                candidate.getLlmValidation(),
                candidate.getQuestionType(),
                candidate.getAnswerEvidence(),
                candidate.getDistractorRationales()
        );
        CandidateValidationResult validation = validationService.validate(
                generated,
                candidate.getChunk() == null ? null : candidate.getChunk().getText()
        );
        Set<Long> excludedQuestions = candidate.getSavedQuestionId() != null
                ? Set.of(candidate.getSavedQuestionId())
                : Set.of();
        Set<Long> excludedCandidates = candidate.getId() != null
                ? Set.of(candidate.getId())
                : Set.of();
        DuplicateCheckResult duplicate = duplicateCheckService.check(
                candidate.getStem(),
                excludedQuestions,
                excludedCandidates
        );
        List<String> warnings = new ArrayList<>(validation.warnings());
        List<String> taxonomyWarnings = taxonomyWarnings(candidate);
        warnings.addAll(taxonomyWarnings);
        if (duplicate.warning() != null && !duplicate.warning().isBlank()) {
            warnings.add(duplicate.warning());
        }
        if (validation.rejected()) {
            candidate.setStatus(CandidateStatus.REJECTED);
            candidate.setLabel(CandidateLabel.REJECTED);
        } else if (!taxonomyWarnings.isEmpty() || validation.needsReview()
                || duplicate.needsReview() || duplicate.strongDuplicate()) {
            candidate.setStatus(CandidateStatus.NEED_REVIEW);
            candidate.setLabel(CandidateLabel.NEED_REVIEW);
            if (duplicate.strongDuplicate()) {
                warnings.add("Trùng ngữ nghĩa mạnh với câu hỏi đã có; cần người duyệt quyết định");
            } else if (duplicate.needsReview()) {
                warnings.add("Có khả năng trùng ngữ nghĩa với câu hỏi đã có");
            }
        } else {
            candidate.setStatus(CandidateStatus.VALIDATED);
            candidate.setLabel(CandidateLabel.GOOD);
        }
        candidate.setQualityScore(validation.qualityScore());
        candidate.setValidationGrade(
                vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateValidationGrade
                        .valueOf(validation.validationGrade())
        );
        candidate.setValidationSource(
                vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateValidationSource
                        .valueOf(validation.validationSource())
        );
        candidate.setValidationIssues(toJson(validation.warnings()));
        candidate.setEvidenceStatus(validation.evidenceStatus());
        candidate.setCriticStatus(validation.criticStatus());
        candidate.setWarnings(toJson(warnings));
        candidate.setDuplicateMaxSimilarity(duplicate.maxSimilarity());
        candidate.setDuplicateQuestionId(duplicate.matchedQuestionId());
        candidate.setDuplicateQuestionStemSnapshot(duplicate.matchedQuestionStem());
    }

    private DocumentQuestionCandidate findCandidate(Long candidateId) {
        return candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi đề xuất"));
    }

    private List<Long> normalizedCandidateIds(BatchDocumentQuestionCandidateActionRequest request) {
        if (request == null || request.candidateIds() == null || request.candidateIds().isEmpty()) {
            throw new BadRequestException("Vui lòng chọn ít nhất một câu hỏi đề xuất");
        }
        return new ArrayList<>(new LinkedHashSet<>(request.candidateIds()));
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private QuestionCategory resolveCategory(Long categoryId) {
        if (questionCategoryRepository == null) {
            throw new BadRequestException("Không thể xác thực danh mục câu hỏi trong phiên hiện tại");
        }
        return questionCategoryRepository.findById(categoryId)
                .filter(category -> category.getStatus() == vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus.ACTIVE)
                .orElseThrow(() -> new BadRequestException("Danh mục câu hỏi không tồn tại hoặc đã ngừng hoạt động"));
    }

    private ProfessionalField resolveProfessionalField(Long fieldId) {
        if (professionalFieldRepository == null) {
            throw new BadRequestException("Không thể xác thực lĩnh vực chuyên môn trong phiên hiện tại");
        }
        return professionalFieldRepository.findById(fieldId)
                .filter(ProfessionalField::isActive)
                .orElseThrow(() -> new BadRequestException("Lĩnh vực chuyên môn không tồn tại hoặc đã ngừng hoạt động"));
    }

    private CognitiveLevel parseCognitiveLevel(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return CognitiveLevel.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Mức độ nhận thức không hợp lệ");
        }
    }

    private void requireReviewedTaxonomy(DocumentQuestionCandidate candidate) {
        // Direct construction tests and old jobs do not have the repositories/direct links.
        // Spring production always wires both repositories, so the new gate remains strict there.
        if (!strictTaxonomyEnabled()) {
            return;
        }
        if (candidate.getCategory() == null) {
            throw new BadRequestException("Câu hỏi đề xuất phải có danh mục kiến thức trước khi duyệt");
        }
        if (candidate.getProfessionalField() == null) {
            throw new BadRequestException("Câu hỏi đề xuất phải có lĩnh vực chuyên môn trước khi duyệt");
        }
        if (candidate.getCognitiveLevel() == null) {
            throw new BadRequestException("Câu hỏi đề xuất phải được phân loại mức độ nhận thức trước khi duyệt");
        }
    }

    private List<String> taxonomyWarnings(DocumentQuestionCandidate candidate) {
        if (!strictTaxonomyEnabled()) {
            return List.of();
        }
        List<String> warnings = new ArrayList<>();
        if (candidate.getCategory() == null) {
            warnings.add("Chưa có danh mục câu hỏi; reviewer cần chọn danh mục trước khi duyệt");
        }
        if (candidate.getProfessionalField() == null) {
            warnings.add("Chưa có lĩnh vực chuyên môn; reviewer cần chọn lĩnh vực trước khi duyệt");
        }
        if (candidate.getCognitiveLevel() == null) {
            warnings.add("Chưa có mức độ nhận thức; reviewer cần chọn một trong 3 mức trước khi duyệt");
        }
        return warnings;
    }

    private boolean strictTaxonomyEnabled() {
        return questionCategoryRepository != null && professionalFieldRepository != null;
    }

    private String resolveTopic(DocumentQuestionCandidate candidate) {
        String explicitTopic = trimToNull(candidate.getTopic());
        if (explicitTopic != null) {
            return explicitTopic;
        }
        var classification = classificationRuleService.classifyQuestion(
                candidate.getStem(),
                candidate.getExplanation(),
                candidate.getDocument() == null ? null : candidate.getDocument().getFilename(),
                candidate.getChunk() == null ? null : candidate.getChunk().getSectionTitle(),
                candidate.getSourceExcerpt()
        );
        return classification.categoryId() == null ? null : classification.categoryName();
    }

    private boolean isGenericDocumentReferenceStem(String stem) {
        if (stem == null || stem.isBlank()) {
            return true;
        }
        String normalized = stem.trim().toLowerCase(java.util.Locale.ROOT)
                .replaceAll("\\s+", " ");
        return normalized.startsWith("theo tài liệu")
                || normalized.startsWith("theo tai lieu")
                || normalized.startsWith("dựa vào tài liệu")
                || normalized.startsWith("dua vao tai lieu")
                || normalized.startsWith("trong tài liệu")
                || normalized.startsWith("trong tai lieu")
                || normalized.startsWith("theo nội dung")
                || normalized.startsWith("theo noi dung")
                || normalized.contains("phù hợp nhất với nội dung trong mục")
                || normalized.contains("phu hop nhat voi noi dung trong muc")
                || normalized.contains("phù hợp với nội dung trong mục")
                || normalized.contains("phu hop voi noi dung trong muc");
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    @FunctionalInterface
    private interface CandidateAction {
        DocumentQuestionCandidateResponse apply(Long candidateId);
    }
}
