package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertExamConfigRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigDistributionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigDistribution;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigDistributionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetRepository;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamConfigService {
    private final ExamConfigRepository examConfigRepository;
    private final ExamConfigDistributionRepository distributionRepository;
    private final QuestionSetRepository questionSetRepository;
    private final QuestionSetItemRepository questionSetItemRepository;
    private final QuestionCategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<ExamConfigResponse> list(String query, String status) {
        String normalizedQuery = normalize(query);
        ExamConfigStatus statusFilter = parseStatusOrNull(status);
        List<ExamConfig> configs = statusFilter == null
                ? examConfigRepository.findByStatusNotOrderByUpdatedAtDesc(ExamConfigStatus.ARCHIVED)
                : examConfigRepository.findByStatusOrderByUpdatedAtDesc(statusFilter);
        return configs.stream()
                .filter(config -> normalizedQuery.isBlank()
                        || normalize(config.getName()).contains(normalizedQuery)
                        || normalize(config.getDescription()).contains(normalizedQuery)
                        || normalize(config.getQuestionSet() == null ? null : config.getQuestionSet().getName()).contains(normalizedQuery))
                .sorted(Comparator.comparing(ExamConfig::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamConfigResponse get(Long configId) {
        return toResponse(find(configId));
    }

    @Transactional
    public ExamConfigResponse create(UpsertExamConfigRequest request, String actor) {
        String name = required(request == null ? null : request.name(), "Tên cấu hình không được để trống");
        ExamConfigStatus status = parseStatus(request.status(), ExamConfigStatus.DRAFT);
        QuestionSet questionSet = resolveQuestionSet(request.questionSetId());
        validateBase(request, questionSet);

        ExamConfig config = ExamConfig.builder()
                .name(name)
                .description(trimToNull(request.description()))
                .questionSet(questionSet)
                .totalQuestions(positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0"))
                .timeLimitMinutes(positive(request.timeLimitMinutes(), "Thời gian làm bài phải lớn hơn 0"))
                .passingScore(percent(request.passingScore(), "Điểm đạt phải trong khoảng 0-100"))
                .maxRetakes(nonNegative(request.maxRetakes(), "Số lần thi lại tối đa không được âm"))
                .shuffleQuestions(request.shuffleQuestions() == null || request.shuffleQuestions())
                .shuffleOptions(request.shuffleOptions() == null || request.shuffleOptions())
                .status(status)
                .createdBy(actor)
                .reviewedBy(status == ExamConfigStatus.ACTIVE ? actor : null)
                .build();
        ExamConfig saved = examConfigRepository.save(config);
        replaceDistributions(saved, request.distributions());
        ensureCanBeActive(saved);
        return toResponse(saved);
    }

    @Transactional
    public ExamConfigResponse update(Long configId, UpsertExamConfigRequest request, String actor) {
        ExamConfig config = find(configId);
        if (config.getStatus() == ExamConfigStatus.ARCHIVED) {
            throw new BadRequestException("Không thể cập nhật cấu hình đã lưu trữ");
        }
        String name = required(request == null ? null : request.name(), "Tên cấu hình không được để trống");
        QuestionSet questionSet = resolveQuestionSet(request.questionSetId());
        validateBase(request, questionSet);

        config.setName(name);
        config.setDescription(trimToNull(request.description()));
        config.setQuestionSet(questionSet);
        config.setTotalQuestions(positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0"));
        config.setTimeLimitMinutes(positive(request.timeLimitMinutes(), "Thời gian làm bài phải lớn hơn 0"));
        config.setPassingScore(percent(request.passingScore(), "Điểm đạt phải trong khoảng 0-100"));
        config.setMaxRetakes(nonNegative(request.maxRetakes(), "Số lần thi lại tối đa không được âm"));
        config.setShuffleQuestions(request.shuffleQuestions() == null || request.shuffleQuestions());
        config.setShuffleOptions(request.shuffleOptions() == null || request.shuffleOptions());
        config.setStatus(parseStatus(request.status(), config.getStatus()));
        if (config.getStatus() == ExamConfigStatus.ACTIVE) {
            config.setReviewedBy(actor);
        }
        ExamConfig saved = examConfigRepository.save(config);
        replaceDistributions(saved, request.distributions());
        ensureCanBeActive(saved);
        return toResponse(saved);
    }

    @Transactional
    public ExamConfigResponse activate(Long configId, String actor) {
        ExamConfig config = find(configId);
        config.setStatus(ExamConfigStatus.ACTIVE);
        config.setReviewedBy(actor);
        ensureCanBeActive(config);
        return toResponse(examConfigRepository.save(config));
    }

    @Transactional
    public ExamConfigResponse deactivate(Long configId) {
        ExamConfig config = find(configId);
        if (config.getStatus() == ExamConfigStatus.ARCHIVED) {
            throw new BadRequestException("Cấu hình đã được lưu trữ");
        }
        config.setStatus(ExamConfigStatus.INACTIVE);
        return toResponse(examConfigRepository.save(config));
    }

    @Transactional
    public ExamConfigResponse archive(Long configId) {
        ExamConfig config = find(configId);
        config.setStatus(ExamConfigStatus.ARCHIVED);
        return toResponse(examConfigRepository.save(config));
    }

    @Transactional(readOnly = true)
    public ExamConfigPreviewResponse preview(UpsertExamConfigRequest request) {
        QuestionSet questionSet = resolveQuestionSet(request.questionSetId());
        int totalQuestions = positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0");
        List<DistributionDraft> drafts = normalizeDistributions(request.distributions());
        Preview preview = buildPreview(questionSet, totalQuestions, drafts);
        return new ExamConfigPreviewResponse(
                totalQuestions,
                preview.distributedQuestions(),
                preview.valid(),
                preview.distributions(),
                preview.warnings()
        );
    }

    @Transactional(readOnly = true)
    public ExamConfigPreviewResponse previewExisting(Long configId) {
        ExamConfig config = find(configId);
        List<DistributionDraft> drafts = distributionRepository.findByExamConfigOrderByIdAsc(config).stream()
                .map(distribution -> new DistributionDraft(
                        distribution.getCategory(),
                        distribution.getDifficulty(),
                        distribution.getQuestionCount(),
                        distribution.getRequired()
                ))
                .toList();
        Preview preview = buildPreview(config.getQuestionSet(), config.getTotalQuestions(), drafts);
        return new ExamConfigPreviewResponse(
                config.getTotalQuestions(),
                preview.distributedQuestions(),
                preview.valid(),
                preview.distributions(),
                preview.warnings()
        );
    }

    private void validateBase(UpsertExamConfigRequest request, QuestionSet questionSet) {
        positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0");
        positive(request.timeLimitMinutes(), "Thời gian làm bài phải lớn hơn 0");
        percent(request.passingScore(), "Điểm đạt phải trong khoảng 0-100");
        nonNegative(request.maxRetakes(), "Số lần thi lại tối đa không được âm");
        if (questionSet != null && questionSet.getStatus() != QuestionSetStatus.ACTIVE) {
            throw new BadRequestException("Chỉ được dùng bộ câu hỏi đang hoạt động");
        }
    }

    private void ensureCanBeActive(ExamConfig config) {
        if (config.getStatus() != ExamConfigStatus.ACTIVE) {
            return;
        }
        List<DistributionDraft> drafts = distributionRepository.findByExamConfigOrderByIdAsc(config).stream()
                .map(distribution -> new DistributionDraft(
                        distribution.getCategory(),
                        distribution.getDifficulty(),
                        distribution.getQuestionCount(),
                        distribution.getRequired()
                ))
                .toList();
        Preview preview = buildPreview(config.getQuestionSet(), config.getTotalQuestions(), drafts);
        if (!preview.valid()) {
            throw new BadRequestException("Không thể kích hoạt cấu hình: " + String.join("; ", preview.warnings()));
        }
    }

    private void replaceDistributions(ExamConfig config, List<UpsertExamConfigRequest.Distribution> distributions) {
        distributionRepository.deleteByExamConfig(config);
        List<DistributionDraft> drafts = normalizeDistributions(distributions);
        Set<String> uniqueKeys = new HashSet<>();
        for (DistributionDraft draft : drafts) {
            String key = (draft.category() == null ? "ALL" : draft.category().getId()) + "|" + normalize(draft.difficulty());
            if (!uniqueKeys.add(key)) {
                throw new BadRequestException("Phân bổ danh mục/độ khó bị trùng");
            }
            distributionRepository.save(ExamConfigDistribution.builder()
                    .examConfig(config)
                    .category(draft.category())
                    .difficulty(trimToNull(draft.difficulty()))
                    .questionCount(draft.questionCount())
                    .required(draft.required())
                    .build());
        }
    }

    private List<DistributionDraft> normalizeDistributions(List<UpsertExamConfigRequest.Distribution> distributions) {
        if (distributions == null || distributions.isEmpty()) {
            return List.of();
        }
        List<DistributionDraft> drafts = new ArrayList<>();
        for (UpsertExamConfigRequest.Distribution distribution : distributions) {
            int questionCount = positive(distribution.questionCount(), "Số câu hỏi phân bổ phải lớn hơn 0");
            QuestionCategory category = resolveCategory(distribution.categoryId(), distribution.categoryName());
            drafts.add(new DistributionDraft(
                    category,
                    trimToNull(distribution.difficulty()),
                    questionCount,
                    distribution.required() == null || distribution.required()
            ));
        }
        return drafts;
    }

    private Preview buildPreview(QuestionSet questionSet, int totalQuestions, List<DistributionDraft> drafts) {
        List<DistributionDraft> effectiveDrafts = drafts.isEmpty()
                ? List.of(new DistributionDraft(null, null, totalQuestions, true))
                : drafts;
        List<String> warnings = new ArrayList<>();
        int distributedQuestions = effectiveDrafts.stream().mapToInt(DistributionDraft::questionCount).sum();
        if (distributedQuestions != totalQuestions) {
            warnings.add("Tổng phân bổ " + distributedQuestions + " câu chưa khớp tổng số câu " + totalQuestions);
        }

        Map<String, Long> availableByCategory = questionSet == null
                ? Map.of()
                : questionSetItemRepository.findByQuestionSetOrderByPositionAsc(questionSet).stream()
                .map(QuestionSetItem::getQuestion)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(question -> normalize(question.getTopic()), Collectors.counting()));

        List<ExamConfigDistributionResponse> responses = new ArrayList<>();
        for (DistributionDraft draft : effectiveDrafts) {
            String categoryName = draft.category() == null ? "Tất cả danh mục" : draft.category().getName();
            Integer available = null;
            boolean shortage = false;
            if (questionSet != null && draft.category() != null) {
                available = Math.toIntExact(availableByCategory.getOrDefault(normalize(categoryName), 0L));
                shortage = available < draft.questionCount();
                if (shortage) {
                    warnings.add("Danh mục " + categoryName + " cần " + draft.questionCount() + " câu nhưng bộ câu hỏi chỉ có " + available + " câu");
                }
            }
            responses.add(new ExamConfigDistributionResponse(
                    null,
                    draft.category() == null ? null : draft.category().getId(),
                    categoryName,
                    draft.difficulty(),
                    draft.questionCount(),
                    draft.required(),
                    available,
                    shortage
            ));
        }

        if (questionSet != null && questionSet.getQuestionCount() < totalQuestions) {
            warnings.add("Bộ câu hỏi chỉ có " + questionSet.getQuestionCount() + " câu, ít hơn tổng số câu yêu cầu");
        }
        return new Preview(distributedQuestions, warnings.isEmpty(), responses, warnings);
    }

    private ExamConfigResponse toResponse(ExamConfig config) {
        List<ExamConfigDistribution> distributions = distributionRepository.findByExamConfigOrderByIdAsc(config);
        List<DistributionDraft> drafts = distributions.stream()
                .map(distribution -> new DistributionDraft(
                        distribution.getCategory(),
                        distribution.getDifficulty(),
                        distribution.getQuestionCount(),
                        distribution.getRequired()
                ))
                .toList();
        Preview preview = buildPreview(config.getQuestionSet(), config.getTotalQuestions(), drafts);
        List<ExamConfigDistributionResponse> distributionResponses = new ArrayList<>();
        for (int i = 0; i < distributions.size(); i++) {
            ExamConfigDistribution distribution = distributions.get(i);
            ExamConfigDistributionResponse previewDistribution = preview.distributions().get(i);
            distributionResponses.add(new ExamConfigDistributionResponse(
                    distribution.getId(),
                    previewDistribution.categoryId(),
                    previewDistribution.categoryName(),
                    previewDistribution.difficulty(),
                    previewDistribution.questionCount(),
                    previewDistribution.required(),
                    previewDistribution.availableQuestionCount(),
                    previewDistribution.shortage()
            ));
        }
        QuestionSet questionSet = config.getQuestionSet();
        return new ExamConfigResponse(
                config.getId(),
                config.getName(),
                config.getDescription(),
                questionSet == null ? null : questionSet.getId(),
                questionSet == null ? null : questionSet.getName(),
                questionSet == null ? null : questionSet.getQuestionCount(),
                config.getTotalQuestions(),
                config.getTimeLimitMinutes(),
                config.getPassingScore(),
                config.getMaxRetakes(),
                config.getShuffleQuestions(),
                config.getShuffleOptions(),
                config.getStatus().name(),
                QuestionGenerationLabels.examConfigStatus(config.getStatus()),
                distributionResponses,
                preview.warnings(),
                config.getCreatedAt(),
                config.getUpdatedAt()
        );
    }

    private ExamConfig find(Long configId) {
        return examConfigRepository.findById(configId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cấu hình đề kiểm tra"));
    }

    private QuestionSet resolveQuestionSet(Long questionSetId) {
        if (questionSetId == null) {
            return null;
        }
        return questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bộ câu hỏi"));
    }

    private QuestionCategory resolveCategory(Long categoryId, String categoryName) {
        if (categoryId != null) {
            return categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục câu hỏi"));
        }
        String normalizedName = normalize(categoryName);
        if (normalizedName.isBlank()) {
            return null;
        }
        return categoryRepository.findAll().stream()
                .filter(category -> normalize(category.getName()).equals(normalizedName))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục câu hỏi: " + categoryName));
    }

    private ExamConfigStatus parseStatus(String value, ExamConfigStatus fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return ExamConfigStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái cấu hình đề kiểm tra không hợp lệ");
        }
    }

    private ExamConfigStatus parseStatusOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseStatus(value, null);
    }

    private String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }

    private int positive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BadRequestException(message);
        }
        return value;
    }

    private int nonNegative(Integer value, String message) {
        if (value == null || value < 0) {
            throw new BadRequestException(message);
        }
        return value;
    }

    private int percent(Integer value, String message) {
        if (value == null || value < 0 || value > 100) {
            throw new BadRequestException(message);
        }
        return value;
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record DistributionDraft(QuestionCategory category, String difficulty, int questionCount, boolean required) {
    }

    private record Preview(
            int distributedQuestions,
            boolean valid,
            List<ExamConfigDistributionResponse> distributions,
            List<String> warnings
    ) {
    }
}
