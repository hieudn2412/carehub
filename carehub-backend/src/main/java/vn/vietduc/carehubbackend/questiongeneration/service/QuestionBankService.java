package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionDuplicateWarningResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionImpactWarningResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseMapper;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuestionBankService {
    private final QuestionBankQuestionRepository questionRepository;
    private final ParaphraseMapper mapper;
    private final DuplicateCheckService duplicateCheckService;
    private final QuestionEmbeddingService questionEmbeddingService;
    private final QuestionClassificationRuleService classificationRuleService;
    private final QuestionSetItemRepository questionSetItemRepository;
    private final ExamPaperQuestionRepository examPaperQuestionRepository;

    @Transactional(readOnly = true)
    public List<QuestionBankQuestionResponse> list(String query, String status) {
        QuestionBankStatus bankStatus = parseStatus(status);
        String normalizedQuery = normalize(query);
        List<QuestionBankQuestion> questions = bankStatus == null
                ? questionRepository.findTop500ByOrderByIdDesc()
                : questionRepository.findTop500ByStatusOrderByIdDesc(bankStatus);
        return questions.stream()
                .filter(question -> normalizedQuery.isBlank() || matches(question, normalizedQuery))
                .map(mapper::toQuestionResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionBankQuestionResponse get(Long questionId) {
        return withWarnings(find(questionId), null, true);
    }

    @Transactional
    public QuestionBankQuestionResponse create(UpsertQuestionBankQuestionRequest request, String actor) {
        return createInternal(request, actor, true);
    }

    @Transactional
    public QuestionBankQuestionResponse createImportDraftAllowingDuplicate(UpsertQuestionBankQuestionRequest request, String actor) {
        UpsertQuestionBankQuestionRequest draftRequest = new UpsertQuestionBankQuestionRequest(
                request.stem(),
                request.optionA(),
                request.optionB(),
                request.optionC(),
                request.optionD(),
                request.correctAnswer(),
                request.explanation(),
                request.topic(),
                request.difficulty(),
                request.language(),
                request.sourceDocument(),
                "DRAFT"
        );
        return createInternal(draftRequest, actor, false);
    }

    private QuestionBankQuestionResponse createInternal(UpsertQuestionBankQuestionRequest request, String actor, boolean rejectStrongDuplicate) {
        validateRequired(request);
        QuestionBankStatus status = parseMutationStatus(request.status(), QuestionBankStatus.APPROVED);
        DuplicateCheckResult duplicate = duplicateCheckService.check(request.stem());
        if (rejectStrongDuplicate) {
            rejectStrongDuplicate(duplicate);
        }

        QuestionBankQuestion question = QuestionBankQuestion.builder()
                .stem(clean(request.stem()))
                .optionA(clean(request.optionA()))
                .optionB(clean(request.optionB()))
                .optionC(clean(request.optionC()))
                .optionD(clean(request.optionD()))
                .correctAnswer(normalizeCorrectAnswer(request.correctAnswer()))
                .explanation(trimToNull(request.explanation()))
                .topic(resolveTopic(request.topic(), request.stem(), request.explanation(), request.sourceDocument(), null, null))
                .difficulty(normalizeDifficulty(request.difficulty()))
                .language(normalizeLanguage(request.language()))
                .sourceDocument(trimToNull(request.sourceDocument()))
                .questionType(QuestionType.ORIGINAL)
                .status(status)
                .createdBy(actor)
                .reviewedBy(status == QuestionBankStatus.APPROVED ? actor : null)
                .build();
        QuestionBankQuestion saved = questionRepository.save(question);
        refreshEmbeddingIfApproved(saved);
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
        rejectStrongDuplicate(duplicate);

        String nextStem = clean(request.stem());
        boolean stemChanged = !nextStem.equals(clean(question.getStem()));
        question.setStem(nextStem);
        question.setOptionA(clean(request.optionA()));
        question.setOptionB(clean(request.optionB()));
        question.setOptionC(clean(request.optionC()));
        question.setOptionD(clean(request.optionD()));
        question.setCorrectAnswer(normalizeCorrectAnswer(request.correctAnswer()));
        question.setExplanation(trimToNull(request.explanation()));
        question.setTopic(resolveTopic(request.topic(), request.stem(), request.explanation(), request.sourceDocument(), null, null));
        question.setDifficulty(normalizeDifficulty(request.difficulty()));
        question.setLanguage(normalizeLanguage(request.language()));
        question.setSourceDocument(trimToNull(request.sourceDocument()));
        question.setStatus(status);
        if (status == QuestionBankStatus.APPROVED) {
            question.setReviewedBy(actor);
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
        rejectStrongDuplicate(duplicate);
        question.setStatus(QuestionBankStatus.APPROVED);
        question.setReviewedBy(actor);
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
        return withWarnings(questionRepository.save(question), null, true);
    }

    @Transactional
    public QuestionBankQuestionResponse archive(Long questionId) {
        QuestionBankQuestion question = find(questionId);
        QuestionImpactWarningResponse impact = buildImpactWarning(question);
        if (impact.blocksArchive()) {
            throw new BadRequestException(impact.warning());
        }
        question.setStatus(QuestionBankStatus.ARCHIVED);
        return withWarnings(questionRepository.save(question), null, true);
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
    }

    private void rejectStrongDuplicate(DuplicateCheckResult duplicate) {
        if (duplicate != null && duplicate.strongDuplicate()) {
            String message = duplicate.matchedQuestionStem() == null
                    ? "Câu hỏi bị trùng mạnh với ngân hàng câu hỏi"
                    : "Câu hỏi bị trùng mạnh với câu đã có: " + duplicate.matchedQuestionStem();
            throw new ConflictException(message);
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
                base.topic(),
                base.difficulty(),
                base.language(),
                base.sourceDocument(),
                base.questionType(),
                base.parentQuestionId(),
                base.status(),
                base.statusText(),
                warning,
                impactWarning,
                base.createdAt(),
                base.updatedAt()
        );
    }

    private QuestionImpactWarningResponse buildImpactWarning(QuestionBankQuestion question) {
        long activeSetCount = questionSetItemRepository.countDistinctQuestionSetsByQuestionAndStatus(
                question,
                QuestionSetStatus.ACTIVE
        );
        long publishedPaperCount = examPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus(
                question,
                ExamPaperStatus.PUBLISHED
        );
        boolean hasImpact = activeSetCount > 0 || publishedPaperCount > 0;
        if (!hasImpact) {
            return new QuestionImpactWarningResponse(0, 0, false, null);
        }
        String warning = "Câu hỏi đang được dùng trong "
                + activeSetCount + " bộ câu hỏi đang hoạt động và "
                + publishedPaperCount + " bộ đề đã phát hành. "
                + "Hãy tạo phiên bản/bản sao bộ câu hỏi hoặc bộ đề trước khi lưu trữ hay tạm ngưng.";
        return new QuestionImpactWarningResponse(activeSetCount, publishedPaperCount, true, warning);
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

    private String normalizeDifficulty(String value) {
        String difficulty = trimToNull(value);
        return difficulty == null ? "MEDIUM" : difficulty;
    }

    private String resolveTopic(
            String explicitTopic,
            String stem,
            String explanation,
            String sourceDocument,
            String sectionTitle,
            String sourceExcerpt
    ) {
        String topic = trimToNull(explicitTopic);
        if (topic != null) {
            return topic;
        }
        var classification = classificationRuleService.classifyQuestion(
                stem,
                explanation,
                sourceDocument,
                sectionTitle,
                sourceExcerpt
        );
        return classification.categoryId() == null ? null : classification.categoryName();
    }

    private boolean matches(QuestionBankQuestion question, String normalizedQuery) {
        return normalize(question.getStem()).contains(normalizedQuery)
                || normalize(question.getTopic()).contains(normalizedQuery)
                || normalize(question.getSourceDocument()).contains(normalizedQuery);
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
