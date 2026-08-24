package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankAvailabilityResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionDuplicateWarningResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionImpactWarningResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseMapper;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionDocumentRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.Comparator;
import java.util.Map;
import java.util.Objects;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionBankService {
    private final QuestionBankQuestionRepository questionRepository;
    private final ParaphraseMapper mapper;
    private final DuplicateCheckService duplicateCheckService;
    private final QuestionEmbeddingService questionEmbeddingService;
    private final QuestionClassificationRuleService classificationRuleService;
    private final ExamPaperQuestionRepository examPaperQuestionRepository;
    private QuestionCategoryRepository questionCategoryRepository;
    private ProfessionalFieldRepository professionalFieldRepository;
    private QuestionDocumentRepository questionDocumentRepository;

    @Autowired
    void setQuestionCategoryRepository(QuestionCategoryRepository questionCategoryRepository) {
        this.questionCategoryRepository = questionCategoryRepository;
    }

    @Autowired
    void setProfessionalFieldRepository(ProfessionalFieldRepository professionalFieldRepository) {
        this.professionalFieldRepository = professionalFieldRepository;
    }

    @Autowired
    void setQuestionDocumentRepository(QuestionDocumentRepository questionDocumentRepository) {
        this.questionDocumentRepository = questionDocumentRepository;
    }

    @Transactional(readOnly = true)
    public List<QuestionBankQuestionResponse> list(String query, String status) {
        return list(query, status, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<QuestionBankQuestionResponse> list(
            String query,
            String status,
            Long categoryId,
            Long professionalFieldId,
            String cognitiveLevel,
            Long sourceDocumentId,
            Boolean verified
    ) {
        QuestionBankStatus bankStatus = parseStatus(status);
        String normalizedQuery = normalize(query);
        CognitiveLevel cognitive = parseCognitiveLevelNullable(cognitiveLevel);
        List<QuestionBankQuestion> questions = bankStatus == null
                ? questionRepository.findTop500ByOrderByIdDesc()
                : questionRepository.findTop500ByStatusOrderByIdDesc(bankStatus);
        return questions.stream()
                .filter(question -> normalizedQuery.isBlank() || matches(question, normalizedQuery))
                .filter(question -> categoryId == null || (question.getCategory() != null && categoryId.equals(question.getCategory().getId())))
                .filter(question -> professionalFieldId == null || (question.getProfessionalField() != null && professionalFieldId.equals(question.getProfessionalField().getId())))
                .filter(question -> cognitive == null || cognitive == question.getCognitiveLevel())
                .filter(question -> sourceDocumentId == null || (question.getSourceDocumentRef() != null && sourceDocumentId.equals(question.getSourceDocumentRef().getId())))
                .filter(question -> verified == null || verified.equals(question.getCognitiveVerifiedAt() != null && question.getCognitiveVerifiedBy() != null))
                .map(mapper::toQuestionResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<QuestionBankAvailabilityResponse> availability() {
        List<QuestionBankQuestion> approvedQuestions = questionRepository.findByStatusOrderByIdDesc(QuestionBankStatus.APPROVED);
        Map<String, Long> counts = approvedQuestions.stream()
                .filter(question -> question.getCategory() != null && question.getCategory().getStatus() == vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus.ACTIVE)
                .filter(question -> question.getProfessionalField() != null && question.getProfessionalField().isActive())
                .filter(question -> question.getCognitiveLevel() != null && question.getCognitiveVerifiedAt() != null && question.getCognitiveVerifiedBy() != null)
                .collect(Collectors.groupingBy(question -> question.getProfessionalField().getId() + ":" + question.getCognitiveLevel().name(), Collectors.counting()));
        return approvedQuestions.stream()
                .filter(question -> question.getCategory() != null && question.getCategory().getStatus() == vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus.ACTIVE)
                .filter(question -> question.getProfessionalField() != null && question.getProfessionalField().isActive())
                .filter(question -> question.getCognitiveLevel() != null && question.getCognitiveVerifiedAt() != null && question.getCognitiveVerifiedBy() != null)
                .filter(question -> counts.containsKey(question.getProfessionalField().getId() + ":" + question.getCognitiveLevel().name()))
                .map(question -> new QuestionBankAvailabilityResponse(
                        question.getProfessionalField().getId(),
                        question.getProfessionalField().getCode(),
                        question.getProfessionalField().getName(),
                        question.getCognitiveLevel().name(),
                        counts.get(question.getProfessionalField().getId() + ":" + question.getCognitiveLevel().name())
                ))
                .collect(Collectors.toMap(
                        item -> item.professionalFieldId() + ":" + item.cognitiveLevel(),
                        item -> item,
                        (left, right) -> left,
                        java.util.LinkedHashMap::new
                )).values().stream()
                .sorted(Comparator.comparing(QuestionBankAvailabilityResponse::professionalFieldCode)
                        .thenComparing(QuestionBankAvailabilityResponse::cognitiveLevel))
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionBankQuestionResponse get(Long questionId) {
        return withWarnings(find(questionId), null, true);
    }

    @Transactional
    public QuestionBankQuestionResponse create(UpsertQuestionBankQuestionRequest request, String actor) {
        return createInternal(request, actor, false);
    }

    /**
     * Dùng cho import theo lô: mỗi dòng chạy trong transaction riêng nên một dòng lỗi
     * không đánh dấu rollback-only cho cả lô.
     * Chỉ có tác dụng khi được gọi từ bean khác (qua proxy Spring).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public QuestionBankQuestionResponse createInNewTransaction(UpsertQuestionBankQuestionRequest request, String actor) {
        return createInternal(request, actor, true);
    }

    private QuestionBankQuestionResponse createInternal(
            UpsertQuestionBankQuestionRequest request,
            String actor,
            boolean importStrongDuplicateAsDraft
    ) {
        validateRequired(request);
        QuestionBankStatus status = parseMutationStatus(request.status(), QuestionBankStatus.APPROVED);
        DuplicateCheckResult duplicate = duplicateCheckService.check(request.stem());
        if (importStrongDuplicateAsDraft && duplicate.strongDuplicate()) {
            status = QuestionBankStatus.DRAFT;
        }

        QuestionCategory category = resolveCategory(request.categoryId(), request.stem(), request.explanation(), request.sourceDocument());
        ProfessionalField professionalField = resolveProfessionalField(request.professionalFieldId(), null);
        CognitiveLevel cognitiveLevel = parseCognitiveLevel(request.cognitiveLevel());
        requireCognitiveForNewApprovedQuestion(status, request.professionalFieldId(), cognitiveLevel);
        QuestionDocument sourceDocumentRef = resolveSourceDocument(request.sourceDocumentId());
        QuestionBankQuestion question = QuestionBankQuestion.builder()
                .stem(clean(request.stem()))
                .category(category)
                .professionalField(professionalField)
                .cognitiveLevel(cognitiveLevel)
                .cognitiveVerifiedAt(status == QuestionBankStatus.APPROVED && cognitiveLevel != null
                        ? LocalDateTime.now() : null)
                .cognitiveVerifiedBy(status == QuestionBankStatus.APPROVED && cognitiveLevel != null ? actor : null)
                .optionA(clean(request.optionA()))
                .optionB(clean(request.optionB()))
                .optionC(clean(request.optionC()))
                .optionD(clean(request.optionD()))
                .correctAnswer(normalizeCorrectAnswer(request.correctAnswer()))
                .explanation(trimToNull(request.explanation()))
                .language(normalizeLanguage(request.language()))
                .sourceDocument(trimToNull(request.sourceDocument()))
                .sourceDocumentRef(sourceDocumentRef)
                .questionType(QuestionType.ORIGINAL)
                .status(status)
                .createdBy(actor)
                .reviewedBy(status == QuestionBankStatus.APPROVED ? actor : null)
                .build();
        QuestionBankQuestion saved = questionRepository.save(question);
        // Câu mới thì không có vector cũ để xoá, nên dùng đường save (chỉ THÊM vào cache) thay vì
        // refresh (xoá sạch cache). Import hàng trăm dòng đi qua đây, mỗi dòng một transaction.
        saveEmbeddingIfApproved(saved);
        return withWarnings(saved, duplicate, false);
    }

    @Transactional
    public QuestionBankQuestionResponse update(Long questionId, UpsertQuestionBankQuestionRequest request, String actor) {
        validateRequired(request);
        QuestionBankQuestion question = find(questionId);
        if (question.getStatus() == QuestionBankStatus.ARCHIVED) {
            throw new BadRequestException("Không thể cập nhật câu hỏi đã lưu trữ");
        }

        QuestionBankStatus status = parseMutationStatus(request.status(), question.getStatus());
        if (status == QuestionBankStatus.ARCHIVED) {
            throw new BadRequestException("Vui lòng dùng thao tác lưu trữ riêng cho câu hỏi");
        }
        if (question.getStatus() == QuestionBankStatus.APPROVED && status != QuestionBankStatus.APPROVED) {
            QuestionImpactWarningResponse impact = buildImpactWarning(question);
            if (impact.blocksArchive()) {
                throw new BadRequestException(impact.warning());
            }
        }
        DuplicateCheckResult duplicate = duplicateCheckService.check(request.stem(), Set.of(question.getId()));

        String nextStem = clean(request.stem());
        boolean stemChanged = !nextStem.equals(clean(question.getStem()));
        question.setStem(nextStem);
        question.setOptionA(clean(request.optionA()));
        question.setOptionB(clean(request.optionB()));
        question.setOptionC(clean(request.optionC()));
        question.setOptionD(clean(request.optionD()));
        question.setCorrectAnswer(normalizeCorrectAnswer(request.correctAnswer()));
        question.setExplanation(trimToNull(request.explanation()));
        QuestionCategory category = resolveCategory(request.categoryId(), request.stem(), request.explanation(), request.sourceDocument());
        question.setCategory(category);
        question.setProfessionalField(resolveProfessionalField(
                request.professionalFieldId(), question.getProfessionalField()));
        question.setCognitiveLevel(parseCognitiveLevel(request.cognitiveLevel()));
        // Any classification edit invalidates the previous review evidence.
        question.setCognitiveVerifiedAt(null);
        question.setCognitiveVerifiedBy(null);
        question.setLanguage(normalizeLanguage(request.language()));
        question.setSourceDocument(trimToNull(request.sourceDocument()));
        if (request.sourceDocumentId() != null) {
            question.setSourceDocumentRef(resolveSourceDocument(request.sourceDocumentId()));
        }
        question.setStatus(status);
        if (status == QuestionBankStatus.APPROVED) {
            if (question.getCognitiveLevel() == null && professionalFieldRepository != null) {
                throw new BadRequestException("Vui lòng phân loại mức độ nhận thức trước khi duyệt câu hỏi");
            }
            question.setReviewedBy(actor);
            if (question.getCognitiveLevel() != null) {
                question.setCognitiveVerifiedAt(LocalDateTime.now());
                question.setCognitiveVerifiedBy(actor);
            }
        }

        QuestionBankQuestion saved = questionRepository.save(question);
        if (stemChanged || status == QuestionBankStatus.APPROVED) {
            refreshEmbeddingIfApproved(saved);
        }
        return withWarnings(saved, duplicate, true);
    }

    @Transactional
    public QuestionBankQuestionResponse approve(Long questionId, String actor) {
        QuestionBankQuestion question = find(questionId);
        if (question.getStatus() == QuestionBankStatus.ARCHIVED) {
            throw new BadRequestException("Không thể duyệt câu hỏi đã lưu trữ");
        }
        DuplicateCheckResult duplicate = duplicateCheckService.check(question.getStem(), Set.of(question.getId()));
        if (question.getProfessionalField() == null) {
            throw new BadRequestException("Vui lòng chọn lĩnh vực chuyên môn trước khi duyệt câu hỏi");
        }
        if (question.getCognitiveLevel() == null) {
            throw new BadRequestException("Vui lòng phân loại mức độ nhận thức trước khi duyệt câu hỏi");
        }
        question.setStatus(QuestionBankStatus.APPROVED);
        question.setReviewedBy(actor);
        question.setCognitiveVerifiedAt(LocalDateTime.now());
        question.setCognitiveVerifiedBy(actor);
        QuestionBankQuestion saved = questionRepository.save(question);
        refreshEmbeddingIfApproved(saved);
        return withWarnings(saved, duplicate, true);
    }

    @Transactional
    public QuestionBankQuestionResponse deactivate(Long questionId) {
        QuestionBankQuestion question = find(questionId);
        if (question.getStatus() == QuestionBankStatus.ARCHIVED) {
            throw new BadRequestException("Câu hỏi đã được lưu trữ");
        }
        QuestionImpactWarningResponse impact = buildImpactWarning(question);
        if (impact.blocksArchive()) {
            throw new BadRequestException(impact.warning());
        }
        question.setStatus(QuestionBankStatus.DRAFT);
        QuestionBankQuestion saved = questionRepository.save(question);
        // Câu vừa rời khỏi tập APPROVED nên không được tham gia so trùng nữa.
        questionEmbeddingService.invalidateApprovedSetCache();
        return withWarnings(saved, null, true);
    }

    @Transactional
    public QuestionBankQuestionResponse archive(Long questionId) {
        QuestionBankQuestion question = find(questionId);
        QuestionImpactWarningResponse impact = buildImpactWarning(question);
        if (impact.blocksArchive()) {
            throw new BadRequestException(impact.warning());
        }
        question.setStatus(QuestionBankStatus.ARCHIVED);
        QuestionBankQuestion saved = questionRepository.save(question);
        // Xem ghi chú ở deactivate(): tập APPROVED đổi thì cache và chỉ mục ANN phải biết.
        questionEmbeddingService.invalidateApprovedSetCache();
        return withWarnings(saved, null, true);
    }

    public QuestionBankQuestion find(Long questionId) {
        return questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi"));
    }

    private QuestionBankStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return QuestionBankStatus.APPROVED;
        }
        if ("ALL".equalsIgnoreCase(status.trim())) {
            return null;
        }
        try {
            return QuestionBankStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            return QuestionBankStatus.APPROVED;
        }
    }

    private QuestionBankStatus parseMutationStatus(String status, QuestionBankStatus fallback) {
        if (status == null || status.isBlank()) {
            return fallback;
        }
        try {
            return QuestionBankStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái câu hỏi không hợp lệ");
        }
    }

    private void validateRequired(UpsertQuestionBankQuestionRequest request) {
        if (isBlank(request.stem())) {
            throw new BadRequestException("Vui lòng nhập nội dung câu hỏi");
        }
        if (isBlank(request.optionA()) || isBlank(request.optionB()) || isBlank(request.optionC()) || isBlank(request.optionD())) {
            throw new BadRequestException("Vui lòng nhập đủ 4 phương án trả lời");
        }
        normalizeCorrectAnswer(request.correctAnswer());
        if (isBlank(request.cognitiveLevel())) {
            throw new BadRequestException("Vui lòng chọn mức độ nhận thức cho câu hỏi");
        }
    }

    /**
     * Cho câu hỏi VỪA TẠO. Dùng cho câu đã tồn tại sẽ để lại vector cũ trong bảng: nội dung đổi
     * làm hash đổi, bản ghi cũ không bị ghi đè mà thành bản ghi thứ hai cho cùng câu hỏi.
     */
    private void saveEmbeddingIfApproved(QuestionBankQuestion question) {
        if (question.getStatus() == QuestionBankStatus.APPROVED) {
            questionEmbeddingService.saveStemEmbedding(question);
        }
    }

    private void refreshEmbeddingIfApproved(QuestionBankQuestion question) {
        if (question.getStatus() == QuestionBankStatus.APPROVED) {
            questionEmbeddingService.refreshStemEmbedding(question);
        }
    }

    private QuestionBankQuestionResponse withWarnings(QuestionBankQuestion question, DuplicateCheckResult duplicate, boolean includeImpact) {
        QuestionDuplicateWarningResponse warning = null;
        if (duplicate != null && duplicate.needsReview()) {
            warning = new QuestionDuplicateWarningResponse(
                    duplicate.maxSimilarity(),
                    duplicate.matchedQuestionId(),
                    duplicate.matchedQuestionStem(),
                    duplicate.needsReview(),
                    duplicate.warning(),
                    duplicate.checker()
            );
        }
        QuestionImpactWarningResponse impactWarning = includeImpact ? buildImpactWarning(question) : null;
        QuestionBankQuestionResponse base = mapper.toQuestionResponse(question);
        return new QuestionBankQuestionResponse(
                base.id(),
                base.stem(),
                base.optionA(),
                base.optionB(),
                base.optionC(),
                base.optionD(),
                base.correctAnswer(),
                base.explanation(),
                base.language(),
                base.sourceDocument(),
                base.questionType(),
                base.parentQuestionId(),
                base.status(),
                base.statusText(),
                warning,
                impactWarning,
                base.createdAt(),
                base.updatedAt(),
                base.categoryId(),
                base.categoryCode(),
                base.categoryName(),
                base.professionalFieldId(),
                base.professionalFieldCode(),
                base.professionalFieldName(),
                base.cognitiveLevel(),
                base.cognitiveVerifiedAt(),
                base.cognitiveVerifiedBy(),
                base.sourceDocumentId(),
                base.sourceDocumentFilename(),
                base.sourceDocumentContentHash()
        );
    }

    private QuestionImpactWarningResponse buildImpactWarning(QuestionBankQuestion question) {
        long publishedPaperCount = examPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus(
                question,
                ExamPaperStatus.PUBLISHED
        );
        if (publishedPaperCount == 0) {
            return new QuestionImpactWarningResponse(0, false, null);
        }
        String warning = "Câu hỏi đang được dùng trong "
                + publishedPaperCount + " bộ đề đã phát hành. "
                + "Hãy tạo phiên bản/bản sao bộ đề trước khi lưu trữ hay tạm ngưng.";
        return new QuestionImpactWarningResponse(publishedPaperCount, true, warning);
    }

    private String normalizeCorrectAnswer(String value) {
        if (isBlank(value)) {
            throw new BadRequestException("Vui lòng chọn đáp án đúng");
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C", "D").contains(normalized)) {
            throw new BadRequestException("Đáp án đúng phải là A, B, C hoặc D");
        }
        return normalized;
    }

    private String normalizeLanguage(String value) {
        String language = trimToNull(value);
        return language == null ? "vi" : language.toLowerCase(Locale.ROOT);
    }

    private QuestionCategory resolveCategory(Long categoryId, String stem, String explanation, String sourceDocument) {
        if (questionCategoryRepository == null) {
            return null;
        }
        if (categoryId != null) {
            return questionCategoryRepository.findById(categoryId)
                    .filter(category -> category.getStatus() != vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus.ARCHIVED)
                    .orElseThrow(() -> new BadRequestException("Danh mục câu hỏi không hợp lệ hoặc đã lưu trữ"));
        }
        var classification = classificationRuleService.classifyQuestion(stem, explanation, sourceDocument, null, null);
        if (classification.categoryId() == null) {
            throw new BadRequestException("Vui lòng chọn danh mục kiến thức cho câu hỏi");
        }
        return questionCategoryRepository.findById(classification.categoryId())
                .orElseThrow(() -> new BadRequestException("Danh mục câu hỏi được phân loại không còn tồn tại"));
    }

    private ProfessionalField resolveProfessionalField(
            Long professionalFieldId,
            ProfessionalField current
    ) {
        if (professionalFieldId != null) {
            if (professionalFieldRepository == null) {
                return current;
            }
            return professionalFieldRepository.findById(professionalFieldId)
                    .filter(ProfessionalField::isActive)
                    .orElseThrow(() -> new BadRequestException(
                            "Lĩnh vực chuyên môn không hợp lệ hoặc đã ngừng sử dụng"));
        }
        if (current != null) {
            return current;
        }
        if (professionalFieldRepository != null) {
            throw new BadRequestException("Vui lòng chọn lĩnh vực chuyên môn cho câu hỏi");
        }
        return null;
    }

    private CognitiveLevel parseCognitiveLevel(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return CognitiveLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Mức độ nhận thức không hợp lệ");
        }
    }

    private void requireCognitiveForNewApprovedQuestion(
            QuestionBankStatus status,
            Long requestedFieldId,
            CognitiveLevel cognitiveLevel
    ) {
        if (professionalFieldRepository != null && status == QuestionBankStatus.APPROVED && cognitiveLevel == null) {
            throw new BadRequestException("Vui lòng phân loại mức độ nhận thức trước khi duyệt câu hỏi");
        }
    }

    private QuestionDocument resolveSourceDocument(Long sourceDocumentId) {
        if (sourceDocumentId == null) {
            return null;
        }
        if (questionDocumentRepository == null) {
            throw new BadRequestException("Không thể xác minh tài liệu nguồn");
        }
        return questionDocumentRepository.findById(sourceDocumentId)
                .orElseThrow(() -> new BadRequestException("Tài liệu nguồn không tồn tại"));
    }

    private boolean matches(QuestionBankQuestion question, String normalizedQuery) {
        return normalize(question.getStem()).contains(normalizedQuery)
                || normalize(question.getCategory() == null ? null : question.getCategory().getName()).contains(normalizedQuery)
                || normalize(question.getCategory() == null ? null : question.getCategory().getCode()).contains(normalizedQuery)
                || normalize(question.getProfessionalField() == null ? null : question.getProfessionalField().getName()).contains(normalizedQuery)
                || normalize(question.getProfessionalField() == null ? null : question.getProfessionalField().getCode()).contains(normalizedQuery)
                || normalize(question.getSourceDocument()).contains(normalizedQuery);
    }

    private CognitiveLevel parseCognitiveLevelNullable(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value.trim())) {
            return null;
        }
        try {
            return CognitiveLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Mức độ nhận thức không hợp lệ");
        }
    }

    private String normalize(String value) {
        String withoutMarks = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutMarks
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
