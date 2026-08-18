package vn.vietduc.carehubbackend.questiongeneration.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertExamConfigRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamBlueprintFieldPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigWorkflowStateResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigSourceFilter;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamQuestionSelectionMode;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigSourceFilterRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionDocumentRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAudience;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationAudienceRepository;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Cấu hình đề kiểm tra theo ma trận lĩnh vực chuyên môn × mức độ nhận thức.
 *
 * <p>Pipeline cũ phân bổ theo "độ khó" (easy/medium/hard) đã được gỡ bỏ hoàn toàn;
 * mọi cấu hình mới bắt buộc dùng blueprint {@code fieldBlueprints}; đối tượng nhận
 * được chốt riêng khi tạo đợt giao đề.</p>
 */
@Service
public class ExamConfigService {
    private final ExamConfigRepository examConfigRepository;
    private final QuestionCategoryRepository categoryRepository;
    private final ExamBlueprintFieldRepository blueprintFieldRepository;
    private final ExamBlueprintCellRepository blueprintCellRepository;
    private final ExamConfigSourceFilterRepository sourceFilterRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final EvaluationAudienceRepository audienceRepository;
    private final QuestionDocumentRepository documentRepository;
    private ExamPaperService examPaperService;
    private ExamAssignmentRepository assignmentRepository;

    @Autowired
    public ExamConfigService(
            ExamConfigRepository examConfigRepository,
            QuestionCategoryRepository categoryRepository,
            ExamBlueprintFieldRepository blueprintFieldRepository,
            ExamBlueprintCellRepository blueprintCellRepository,
            ExamConfigSourceFilterRepository sourceFilterRepository,
            QuestionBankQuestionRepository questionRepository,
            ProfessionalFieldRepository professionalFieldRepository,
            EvaluationAudienceRepository audienceRepository,
            QuestionDocumentRepository documentRepository
    ) {
        this.examConfigRepository = examConfigRepository;
        this.categoryRepository = categoryRepository;
        this.blueprintFieldRepository = blueprintFieldRepository;
        this.blueprintCellRepository = blueprintCellRepository;
        this.sourceFilterRepository = sourceFilterRepository;
        this.questionRepository = questionRepository;
        this.professionalFieldRepository = professionalFieldRepository;
        this.audienceRepository = audienceRepository;
        this.documentRepository = documentRepository;
    }

    @Autowired
    public void setExamPaperService(ExamPaperService examPaperService) {
        this.examPaperService = examPaperService;
    }

    @Autowired
    public void setAssignmentRepository(ExamAssignmentRepository assignmentRepository) {
        this.assignmentRepository = assignmentRepository;
    }

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
                        || normalize(config.getDescription()).contains(normalizedQuery))
                .sorted(Comparator.comparing(ExamConfig::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamConfigResponse get(Long configId) {
        return toResponse(find(configId));
    }

    @Transactional(readOnly = true)
    public ExamConfigWorkflowStateResponse workflowState(Long configId) {
        ExamConfig config = find(configId);
        List<vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperResponse> papers = examPaperService == null
                ? List.of()
                : examPaperService.list(null, null).stream()
                .filter(paper -> Objects.equals(paper.examConfigId(), configId))
                .toList();
        long publishedPaperCount = papers.stream()
                .filter(paper -> ExamPaperStatus.PUBLISHED.name().equals(paper.status()))
                .count();
        long assignmentCount = 0;
        if (assignmentRepository != null) {
            for (vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperResponse paper : papers) {
                assignmentCount += assignmentRepository.countByExamPaperIdAndStatus(paper.id(), ExamAssignmentStatus.OPEN);
                assignmentCount += assignmentRepository.countByExamPaperIdAndStatus(paper.id(), ExamAssignmentStatus.CLOSED);
            }
        }
        String nextStep = config.getStatus() != ExamConfigStatus.ACTIVE ? "CONFIGURATION"
                : papers.isEmpty() ? "GENERATE_PAPERS"
                : publishedPaperCount < papers.size() ? "PUBLISH_PAPERS" : assignmentCount == 0 ? "ASSIGN" : "DONE";
        return new ExamConfigWorkflowStateResponse(toResponse(config), papers, publishedPaperCount, assignmentCount, nextStep);
    }

    @Transactional
    public ExamConfigResponse create(UpsertExamConfigRequest request, String actor) {
        requireBlueprintRequest(request);
        return createBlueprint(request, actor);
    }

    @Transactional
    public ExamConfigResponse update(Long configId, UpsertExamConfigRequest request, String actor) {
        ExamConfig config = findLocked(configId);
        requireBlueprintRequest(request);
        return updateBlueprint(config, request, actor);
    }

    @Transactional
    public ExamConfigResponse activate(Long configId, String actor) {
        ExamConfig config = findLocked(configId);
        config.setStatus(ExamConfigStatus.ACTIVE);
        config.setReviewedBy(actor);
        ensureBlueprintCanBeActive(config);
        return toResponse(examConfigRepository.save(config));
    }

    @Transactional
    public ExamConfigResponse deactivate(Long configId) {
        ExamConfig config = findLocked(configId);
        if (config.getStatus() == ExamConfigStatus.ARCHIVED) {
            throw new BadRequestException("Cấu hình đã được lưu trữ");
        }
        config.setStatus(ExamConfigStatus.INACTIVE);
        return toResponse(examConfigRepository.save(config));
    }

    @Transactional
    public ExamConfigResponse archive(Long configId) {
        ExamConfig config = findLocked(configId);
        config.setStatus(ExamConfigStatus.ARCHIVED);
        return toResponse(examConfigRepository.save(config));
    }

    @Transactional(readOnly = true)
    public ExamConfigPreviewResponse preview(UpsertExamConfigRequest request) {
        return preview(request, 1, false);
    }

    @Transactional(readOnly = true)
    public ExamConfigPreviewResponse preview(UpsertExamConfigRequest request, int variantCount, boolean zeroOverlap) {
        requireBlueprintRequest(request);
        int total = positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0");
        validateBlueprintInput(request, total);
        BlueprintPreview preview = buildBlueprintPreview(request, variantCount, zeroOverlap);
        List<QuestionBankQuestion> pool = directPool(request.sourceFilters(), request.fieldBlueprints().stream()
                .map(UpsertExamConfigRequest.FieldBlueprint::professionalFieldId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return new ExamConfigPreviewResponse(
                request.totalQuestions(), preview.distributedQuestions(), preview.valid(),
                preview.warnings(), preview.fields(),
                ExamGenerationDeterminism.poolChecksum(1, requestFilters(request.sourceFilters()), pool), 1);
    }

    @Transactional
    public ExamConfigPreviewResponse previewExisting(Long configId) {
        return previewExisting(configId, 1, false);
    }

    @Transactional
    public ExamConfigPreviewResponse previewExisting(Long configId, int variantCount, boolean zeroOverlap) {
        ExamConfig config = findLocked(configId);
        requireBlueprintConfig(config);
        List<QuestionBankQuestion> pool = directPool(config);
        List<ExamConfigSourceFilter> filters = sourceFilterRepository.findByExamConfigOrderByIdAsc(config);
        String checksum = ExamGenerationDeterminism.poolChecksum(
                config.getBlueprintVersion() == null ? 1 : config.getBlueprintVersion(), filters, pool);
        config.setPoolChecksum(checksum);
        examConfigRepository.save(config);
        BlueprintPreview preview = buildBlueprintPreview(config, variantCount, zeroOverlap);
        return new ExamConfigPreviewResponse(
                config.getTotalQuestions(), preview.distributedQuestions(), preview.valid(),
                preview.warnings(), preview.fields(), checksum, config.getBlueprintVersion());
    }

    private ExamConfigResponse toResponse(ExamConfig config) {
        BlueprintPreview blueprint = isBlueprintConfig(config)
                ? buildBlueprintPreview(config, 1, false)
                : new BlueprintPreview(0, false, List.of(),
                List.of("Cấu hình này thuộc pipeline độ khó cũ đã ngừng hỗ trợ, vui lòng cấu hình lại theo ma trận mức độ nhận thức"));
        return new ExamConfigResponse(
                config.getId(),
                config.getName(),
                config.getDescription(),
                config.getTotalQuestions(),
                config.getTimeLimitMinutes(),
                config.getPassingScore(),
                config.getMaxRetakes(),
                config.getShuffleQuestions(),
                config.getShuffleOptions(),
                config.getBackfillNearestCognitiveLevel(),
                selectionMode(config).name(),
                config.getStatus().name(),
                QuestionGenerationLabels.examConfigStatus(config.getStatus()),
                blueprint.warnings(),
                config.getCreatedAt(),
                config.getUpdatedAt(),
                config.getAudience() == null ? null : config.getAudience().getId(),
                config.getSourceScope(),
                config.getBlueprintVersion(),
                blueprint.fields(),
                config.getPoolChecksum()
        );
    }

    private ExamConfig find(Long configId) {
        return examConfigRepository.findById(configId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cấu hình đề kiểm tra"));
    }

    private ExamConfig findLocked(Long configId) {
        return examConfigRepository.findByIdForUpdate(configId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cấu hình đề kiểm tra"));
    }

    private void ensureBlueprintCanBeActive(ExamConfig config) {
        requireBlueprintConfig(config);
        BlueprintPreview preview = buildBlueprintPreview(config, 1, false);
        if (!preview.valid()) throw new BadRequestException("Không thể kích hoạt cấu hình: " + String.join("; ", preview.warnings()));
    }

    private BlueprintPreview buildBlueprintPreview(ExamConfig config, int variantCount, boolean zeroOverlap) {
        List<ExamBlueprintField> fields = blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId());
        List<QuestionBankQuestion> pool = directPool(config);
        List<ExamBlueprintFieldPreviewResponse> responses = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String currentChecksum = ExamGenerationDeterminism.poolChecksum(
                config.getBlueprintVersion() == null ? 1 : config.getBlueprintVersion(),
                sourceFilterRepository.findByExamConfigOrderByIdAsc(config), pool);
        if (config.getPoolChecksum() != null && !config.getPoolChecksum().equals(currentChecksum)) {
            warnings.add("Ngân hàng câu hỏi đã thay đổi sau lần lưu ma trận; cần xem preview lại");
        }
        boolean backfill = Boolean.TRUE.equals(config.getBackfillNearestCognitiveLevel());
        int distributed = 0;
        for (ExamBlueprintField field : fields) {
            List<ExamBlueprintCell> cells = new ArrayList<>(blueprintCellRepository.findByBlueprintFieldId(field.getId()));
            cells.sort(Comparator.comparingInt(cell -> CognitiveBackfillAllocator.order(cell.getCognitiveLevel())));
            List<CognitiveBackfillAllocator.CellDemand> demands = new ArrayList<>();
            for (ExamBlueprintCell cell : cells) {
                int available = Math.toIntExact(pool.stream()
                        .filter(q -> Objects.equals(q.getProfessionalField().getId(), field.getProfessionalField().getId())
                                && q.getCognitiveLevel() == cell.getCognitiveLevel())
                        .mapToLong(ExamGenerationDeterminism::familyId)
                        .distinct()
                        .count());
                int required = zeroOverlap ? cell.getQuestionCount() * variantCount : cell.getQuestionCount();
                demands.add(new CognitiveBackfillAllocator.CellDemand(cell.getCognitiveLevel(), required, available));
            }
            List<CognitiveBackfillAllocator.CellOutcome> outcomes = CognitiveBackfillAllocator.allocate(demands, backfill);
            List<ExamBlueprintFieldPreviewResponse.ExamBlueprintCellPreviewResponse> cellResponses = new ArrayList<>();
            int availableField = 0;
            int backfilledField = 0;
            for (int i = 0; i < cells.size(); i++) {
                ExamBlueprintCell cell = cells.get(i);
                CognitiveBackfillAllocator.CellOutcome outcome = outcomes.get(i);
                availableField += outcome.rawAvailable();
                backfilledField += outcome.backfilled();
                if (outcome.shortage() > 0) warnings.add(field.getProfessionalField().getName() + " / " + cell.getCognitiveLevel().name() + " thiếu " + outcome.shortage() + " câu");
                cellResponses.add(new ExamBlueprintFieldPreviewResponse.ExamBlueprintCellPreviewResponse(cell.getCognitiveLevel().name(), cell.getPercentage(), cell.getQuestionCount(), outcome.rawAvailable(), outcome.shortage(), outcome.backfilled()));
            }
            int fieldShortage = Math.max(0, field.getQuestionCount() - availableField);
            if (fieldShortage > 0 && cells.isEmpty()) warnings.add(field.getProfessionalField().getName() + " thiếu nguồn câu hỏi");
            distributed += field.getQuestionCount();
            responses.add(new ExamBlueprintFieldPreviewResponse(field.getProfessionalField().getId(), field.getProfessionalField().getCode(), field.getProfessionalField().getName(), field.getPercentage(), field.getQuestionCount(), availableField, fieldShortage, backfilledField, field.getDisplayOrder(), cellResponses));
        }
        if (distributed != config.getTotalQuestions()) warnings.add("Tổng blueprint " + distributed + " câu chưa khớp tổng đề " + config.getTotalQuestions());
        return new BlueprintPreview(distributed, warnings.isEmpty(), responses, warnings);
    }

    private BlueprintPreview buildBlueprintPreview(UpsertExamConfigRequest request, int variantCount, boolean zeroOverlap) {
        List<String> warnings = new ArrayList<>();
        int total = positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0");
        List<UpsertExamConfigRequest.FieldBlueprint> fields = request.fieldBlueprints() == null ? List.of() : request.fieldBlueprints();
        List<Integer> fieldCounts = fields.isEmpty() ? List.of() : allocateCounts(fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::percentage).toList(), fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::questionCount).toList(), total);
        List<QuestionBankQuestion> pool = directPool(request.sourceFilters(), fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::professionalFieldId).filter(Objects::nonNull).collect(Collectors.toSet()));
        boolean backfill = Boolean.TRUE.equals(request.backfillNearestCognitiveLevel());
        List<ExamBlueprintFieldPreviewResponse> responses = new ArrayList<>();
        for (int i = 0; i < fields.size(); i++) {
            UpsertExamConfigRequest.FieldBlueprint draft = fields.get(i);
            ProfessionalField field = professionalFieldRepository == null ? null : professionalFieldRepository.findById(draft.professionalFieldId()).orElse(null);
            int fieldCount = i < fieldCounts.size() ? fieldCounts.get(i) : 0;
            List<Integer> cellCounts = allocateCounts(draft.cognitive().stream().map(UpsertExamConfigRequest.CognitiveDistribution::percentage).toList(), draft.cognitive().stream().map(UpsertExamConfigRequest.CognitiveDistribution::questionCount).toList(), fieldCount);
            ProfessionalField cellField = field;
            record IndexedCell(UpsertExamConfigRequest.CognitiveDistribution cell, CognitiveLevel level, int baseRequired) { }
            List<IndexedCell> orderedCognitive = new ArrayList<>();
            for (int c = 0; c < draft.cognitive().size(); c++) {
                var cell = draft.cognitive().get(c);
                orderedCognitive.add(new IndexedCell(cell, parseCognitive(cell.cognitiveLevel()), cellCounts.get(c)));
            }
            orderedCognitive.sort(Comparator.comparingInt(ic -> CognitiveBackfillAllocator.order(ic.level())));
            List<CognitiveBackfillAllocator.CellDemand> demands = new ArrayList<>();
            for (IndexedCell ic : orderedCognitive) {
                int available = cellField == null ? 0 : Math.toIntExact(pool.stream().filter(q -> Objects.equals(q.getProfessionalField().getId(), cellField.getId()) && q.getCognitiveLevel() == ic.level()).mapToLong(ExamGenerationDeterminism::familyId).distinct().count());
                int required = zeroOverlap ? ic.baseRequired() * variantCount : ic.baseRequired();
                demands.add(new CognitiveBackfillAllocator.CellDemand(ic.level(), required, available));
            }
            List<CognitiveBackfillAllocator.CellOutcome> outcomes = CognitiveBackfillAllocator.allocate(demands, backfill);
            List<ExamBlueprintFieldPreviewResponse.ExamBlueprintCellPreviewResponse> cells = new ArrayList<>();
            int availableField = 0;
            int backfilledField = 0;
            for (int c = 0; c < orderedCognitive.size(); c++) {
                IndexedCell ic = orderedCognitive.get(c);
                CognitiveBackfillAllocator.CellOutcome outcome = outcomes.get(c);
                availableField += outcome.rawAvailable();
                backfilledField += outcome.backfilled();
                if (outcome.shortage() > 0) warnings.add((field == null ? "Lĩnh vực #" + draft.professionalFieldId() : field.getName()) + " / " + ic.level().name() + " thiếu " + outcome.shortage() + " câu");
                cells.add(new ExamBlueprintFieldPreviewResponse.ExamBlueprintCellPreviewResponse(ic.level() == null ? ic.cell().cognitiveLevel() : ic.level().name(), ic.cell().percentage(), outcome.required(), outcome.rawAvailable(), outcome.shortage(), outcome.backfilled()));
            }
            String code = field == null ? null : field.getCode(); String name = field == null ? null : field.getName();
            responses.add(new ExamBlueprintFieldPreviewResponse(draft.professionalFieldId(), code, name, draft.percentage(), fieldCount, availableField, Math.max(0, fieldCount - availableField), backfilledField, draft.displayOrder() == null ? i : draft.displayOrder(), cells));
        }
        return new BlueprintPreview(fieldCounts.stream().mapToInt(Integer::intValue).sum(), warnings.isEmpty(), responses, warnings);
    }

    private List<QuestionBankQuestion> directPool(ExamConfig config) {
        Set<Long> fields = blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId()).stream().map(f -> f.getProfessionalField().getId()).collect(Collectors.toSet());
        return directPool(sourceFilterRepository.findByExamConfigOrderByIdAsc(config), fields);
    }
    private List<QuestionBankQuestion> directPool(UpsertExamConfigRequest.SourceFilters filters, Set<Long> fields) {
        List<QuestionBankQuestion> pool = questionRepository.findByStatusAndProfessionalFieldIdInOrderByIdAsc(QuestionBankStatus.APPROVED, fields).stream()
                .filter(q -> q.getCategory() != null && q.getCategory().getStatus() == QuestionCategoryStatus.ACTIVE)
                .filter(q -> q.getProfessionalField() != null && q.getProfessionalField().isActive())
                .filter(q -> q.getCognitiveLevel() != null && q.getCognitiveVerifiedAt() != null && q.getCognitiveVerifiedBy() != null)
                .sorted(Comparator.comparing(QuestionBankQuestion::getId))
                .toList();
        if (filters == null) return pool;
        Set<Long> includeCategories = set(filters.includedCategoryIds()); Set<Long> excludeCategories = set(filters.excludedCategoryIds()); Set<Long> includeDocuments = set(filters.includedDocumentIds()); Set<Long> excludeDocuments = set(filters.excludedDocumentIds());
        return pool.stream().filter(q -> includeCategories.isEmpty() || (q.getCategory() != null && includeCategories.contains(q.getCategory().getId()))).filter(q -> q.getCategory() == null || !excludeCategories.contains(q.getCategory().getId())).filter(q -> includeDocuments.isEmpty() || (q.getSourceDocumentRef() != null && includeDocuments.contains(q.getSourceDocumentRef().getId()))).filter(q -> q.getSourceDocumentRef() == null || !excludeDocuments.contains(q.getSourceDocumentRef().getId())).toList();
    }
    private List<QuestionBankQuestion> directPool(List<ExamConfigSourceFilter> filters, Set<Long> fields) {
        return directPool(new UpsertExamConfigRequest.SourceFilters(idsByType(filters, ExamConfigSourceFilter.FilterType.INCLUDE_CATEGORY), idsByType(filters, ExamConfigSourceFilter.FilterType.EXCLUDE_CATEGORY), idsByType(filters, ExamConfigSourceFilter.FilterType.INCLUDE_DOCUMENT), idsByType(filters, ExamConfigSourceFilter.FilterType.EXCLUDE_DOCUMENT)), fields);
    }
    private List<Long> idsByType(List<ExamConfigSourceFilter> filters, ExamConfigSourceFilter.FilterType type) { return filters.stream().filter(f -> f.getFilterType() == type).map(ExamConfigSourceFilter::getReferenceId).toList(); }
    private Set<Long> set(List<Long> ids) { return ids == null ? Set.of() : ids.stream().filter(Objects::nonNull).collect(Collectors.toSet()); }
    private List<ExamConfigSourceFilter> requestFilters(UpsertExamConfigRequest.SourceFilters filters) {
        if (filters == null) return List.of();
        List<ExamConfigSourceFilter> result = new ArrayList<>();
        addRequestFilters(result, ExamConfigSourceFilter.FilterType.INCLUDE_CATEGORY, filters.includedCategoryIds());
        addRequestFilters(result, ExamConfigSourceFilter.FilterType.EXCLUDE_CATEGORY, filters.excludedCategoryIds());
        addRequestFilters(result, ExamConfigSourceFilter.FilterType.INCLUDE_DOCUMENT, filters.includedDocumentIds());
        addRequestFilters(result, ExamConfigSourceFilter.FilterType.EXCLUDE_DOCUMENT, filters.excludedDocumentIds());
        return result;
    }
    private void addRequestFilters(List<ExamConfigSourceFilter> target, ExamConfigSourceFilter.FilterType type, List<Long> ids) {
        if (ids == null) return;
        ids.stream().filter(Objects::nonNull).distinct().forEach(id -> target.add(
                ExamConfigSourceFilter.builder().filterType(type).referenceId(id).build()));
    }
    private java.math.BigDecimal sum(List<java.math.BigDecimal> values) { return values.stream().reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add); }
    private List<Integer> allocateCounts(List<java.math.BigDecimal> percentages, List<Integer> supplied, int total) {
        return ExamBlueprintAllocator.allocate(percentages, supplied, total);
    }
    private CognitiveLevel parseCognitive(String value) { try { return value == null ? null : CognitiveLevel.valueOf(value.trim().toUpperCase(Locale.ROOT)); } catch (Exception ex) { return null; } }

    private boolean isBlueprintRequest(UpsertExamConfigRequest request) {
        return request != null && (request.audienceId() != null
                || (request.fieldBlueprints() != null && !request.fieldBlueprints().isEmpty()));
    }

    private void requireBlueprintRequest(UpsertExamConfigRequest request) {
        if (!isBlueprintRequest(request)) {
            throw new BadRequestException(
                    "Cấu hình đề kiểm tra phải khai báo ma trận lĩnh vực × mức độ nhận thức");
        }
    }

    private boolean isBlueprintConfig(ExamConfig config) {
        return blueprintFieldRepository != null
                && !blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId()).isEmpty();
    }

    private void requireBlueprintConfig(ExamConfig config) {
        if (!isBlueprintConfig(config)) {
            throw new BadRequestException(
                    "Cấu hình này chưa có ma trận lĩnh vực × mức độ nhận thức, vui lòng cấu hình lại");
        }
    }

    private ExamConfigResponse createBlueprint(UpsertExamConfigRequest request, String actor) {
        String name = required(request.name(), "Tên cấu hình không được để trống");
        int total = positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0");
        int duration = positive(request.timeLimitMinutes(), "Thời gian làm bài phải lớn hơn 0");
        int passing = percent(request.passingScore(), "Điểm đạt phải trong khoảng 0-10");
        validateBlueprintInput(request, total);
        EvaluationAudience audience = resolveOptionalAudience(request.audienceId());
        ExamConfig config = examConfigRepository.save(ExamConfig.builder()
                .name(name).description(trimToNull(request.description())).audience(audience)
                .sourceScope("QUESTION_BANK").blueprintVersion(1).totalQuestions(total).timeLimitMinutes(duration)
                .passingScore(passing).maxRetakes(nonNegative(request.maxRetakes(), "Số lần thi lại tối đa không được âm"))
                .shuffleQuestions(request.shuffleQuestions() == null || request.shuffleQuestions())
                .shuffleOptions(request.shuffleOptions() == null || request.shuffleOptions())
                .backfillNearestCognitiveLevel(Boolean.TRUE.equals(request.backfillNearestCognitiveLevel()))
                .questionSelectionMode(parseSelectionMode(request.questionSelectionMode()))
                .status(parseStatus(request.status(), ExamConfigStatus.DRAFT)).createdBy(actor)
                .reviewedBy("ACTIVE".equalsIgnoreCase(request.status()) ? actor : null).build());
        persistBlueprint(config, request, total);
        config.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(
                config.getBlueprintVersion(), sourceFilterRepository.findByExamConfigOrderByIdAsc(config), directPool(config)));
        examConfigRepository.save(config);
        if (config.getStatus() == ExamConfigStatus.ACTIVE) ensureBlueprintCanBeActive(config);
        return toResponse(config);
    }

    private ExamConfigResponse updateBlueprint(ExamConfig config, UpsertExamConfigRequest request, String actor) {
        if (config.getStatus() == ExamConfigStatus.ARCHIVED) throw new BadRequestException("Không thể cập nhật cấu hình đã lưu trữ");
        int total = positive(request.totalQuestions(), "Tổng số câu hỏi phải lớn hơn 0");
        validateBlueprintInput(request, total);
        EvaluationAudience audience = resolveOptionalAudience(request.audienceId());
        config.setName(required(request.name(), "Tên cấu hình không được để trống"));
        config.setDescription(trimToNull(request.description())); config.setAudience(audience);
        config.setSourceScope("QUESTION_BANK"); config.setTotalQuestions(total);
        config.setTimeLimitMinutes(positive(request.timeLimitMinutes(), "Thời gian làm bài phải lớn hơn 0"));
        config.setPassingScore(percent(request.passingScore(), "Điểm đạt phải trong khoảng 0-10"));
        config.setMaxRetakes(nonNegative(request.maxRetakes(), "Số lần thi lại tối đa không được âm"));
        config.setShuffleQuestions(request.shuffleQuestions() == null || request.shuffleQuestions());
        config.setShuffleOptions(request.shuffleOptions() == null || request.shuffleOptions());
        config.setBackfillNearestCognitiveLevel(Boolean.TRUE.equals(request.backfillNearestCognitiveLevel()));
        config.setQuestionSelectionMode(parseSelectionMode(request.questionSelectionMode()));
        config.setStatus(parseStatus(request.status(), config.getStatus()));
        if (config.getStatus() == ExamConfigStatus.ACTIVE) config.setReviewedBy(actor);
        examConfigRepository.save(config); persistBlueprint(config, request, total);
        config.setBlueprintVersion((config.getBlueprintVersion() == null ? 1 : config.getBlueprintVersion()) + 1);
        config.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(
                config.getBlueprintVersion(), sourceFilterRepository.findByExamConfigOrderByIdAsc(config), directPool(config)));
        examConfigRepository.save(config);
        if (config.getStatus() == ExamConfigStatus.ACTIVE) ensureBlueprintCanBeActive(config);
        return toResponse(config);
    }

    private void validateBlueprintInput(UpsertExamConfigRequest request, int total) {
        if (parseSelectionMode(request.questionSelectionMode()) != ExamQuestionSelectionMode.FIXED_PAPER) throw new BadRequestException("Blueprint đa lĩnh vực hiện chỉ hỗ trợ FIXED_PAPER");
        List<UpsertExamConfigRequest.FieldBlueprint> fields = request.fieldBlueprints();
        if (fields == null || fields.isEmpty()) throw new BadRequestException("Phải chọn ít nhất một lĩnh vực chuyên môn");
        boolean usingPercent = fields.stream().allMatch(f -> f.percentage() != null);
        boolean usingCount = fields.stream().allMatch(f -> f.questionCount() != null);
        if (!usingPercent && !usingCount) throw new BadRequestException("Mỗi lĩnh vực phải nhập tỷ lệ hoặc số câu đầy đủ");
        if (usingPercent && fields.stream().anyMatch(f -> f.questionCount() != null)) throw new BadRequestException("Không trộn tỷ lệ và số câu ở cấp lĩnh vực");
        if (usingPercent && sum(fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::percentage).toList()).compareTo(java.math.BigDecimal.valueOf(100)) != 0) throw new BadRequestException("Tổng tỷ lệ lĩnh vực phải bằng 100%");
        if (usingCount && fields.stream().mapToInt(f -> f.questionCount() == null ? 0 : f.questionCount()).sum() != total) throw new BadRequestException("Tổng số câu các lĩnh vực phải bằng tổng đề");
        if (fields.stream().anyMatch(f -> f.percentage() != null && (f.percentage().signum() < 0 || f.percentage().compareTo(java.math.BigDecimal.valueOf(100)) > 0))) throw new BadRequestException("Tỷ lệ lĩnh vực phải trong khoảng 0-100%");
        List<Integer> allocatedFieldCounts = allocateCounts(
                fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::percentage).toList(),
                fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::questionCount).toList(), total);
        Set<Long> ids = new HashSet<>();
        for (int fieldIndex = 0; fieldIndex < fields.size(); fieldIndex++) {
            UpsertExamConfigRequest.FieldBlueprint field = fields.get(fieldIndex);
            if (field.professionalFieldId() == null || !ids.add(field.professionalFieldId())) throw new BadRequestException("Lĩnh vực bị thiếu hoặc trùng");
            if (field.cognitive() == null || field.cognitive().size() != 3) throw new BadRequestException("Mỗi lĩnh vực phải có đúng 3 mức nhận thức");
            if (field.cognitive().stream().map(UpsertExamConfigRequest.CognitiveDistribution::cognitiveLevel).distinct().count() != 3) throw new BadRequestException("Ba mức nhận thức không được trùng");
            if (field.cognitive().stream().anyMatch(c -> parseCognitive(c.cognitiveLevel()) == null)) throw new BadRequestException("Mức nhận thức không hợp lệ");
            boolean cognitivePercent = field.cognitive().stream().allMatch(c -> c.percentage() != null);
            boolean cognitiveCount = field.cognitive().stream().allMatch(c -> c.questionCount() != null);
            if (!cognitivePercent && !cognitiveCount) throw new BadRequestException("Mỗi mức nhận thức phải nhập tỷ lệ hoặc số câu");
            if (field.cognitive().stream().anyMatch(c -> c.percentage() != null && c.percentage().signum() < 0)) throw new BadRequestException("Tỷ lệ nhận thức không được âm");
            if (field.cognitive().stream().anyMatch(c -> c.questionCount() != null && c.questionCount() < 0)) throw new BadRequestException("Số câu nhận thức không được âm");
            if (cognitivePercent && sum(field.cognitive().stream().map(UpsertExamConfigRequest.CognitiveDistribution::percentage).toList()).compareTo(java.math.BigDecimal.valueOf(100)) != 0) throw new BadRequestException("Tổng tỷ lệ nhận thức trong mỗi lĩnh vực phải bằng 100%");
            if (cognitiveCount && field.cognitive().stream().mapToInt(c -> c.questionCount() == null ? 0 : c.questionCount()).sum() != allocatedFieldCounts.get(fieldIndex)) throw new BadRequestException("Tổng cell phải bằng số câu của lĩnh vực");
        }
        if (professionalFieldRepository != null && professionalFieldRepository.findAllById(ids).size() != ids.size()) throw new BadRequestException("Lĩnh vực chuyên môn không hợp lệ");
        validateSourceFilters(request.sourceFilters());
    }

    private EvaluationAudience resolveOptionalAudience(Long audienceId) {
        if (audienceId == null) return null;
        EvaluationAudience audience = audienceRepository.findById(audienceId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đối tượng thi"));
        if (audience.getStatus() != vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationAudienceStatus.ACTIVE) {
            throw new BadRequestException("Chỉ được dùng đối tượng thi đang hoạt động");
        }
        return audience;
    }

    private void validateSourceFilters(UpsertExamConfigRequest.SourceFilters filters) {
        if (filters == null) return;
        Set<Long> categoryIds = new HashSet<>();
        addIds(categoryIds, filters.includedCategoryIds());
        addIds(categoryIds, filters.excludedCategoryIds());
        if (categoryRepository != null && categoryRepository.findAllById(categoryIds).size() != categoryIds.size()) {
            throw new BadRequestException("Bộ lọc chứa danh mục không tồn tại");
        }
        Set<Long> documentIds = new HashSet<>();
        addIds(documentIds, filters.includedDocumentIds());
        addIds(documentIds, filters.excludedDocumentIds());
        if (documentRepository != null && documentRepository.findAllById(documentIds).size() != documentIds.size()) {
            throw new BadRequestException("Bộ lọc chứa tài liệu không tồn tại");
        }
    }

    private void addIds(Set<Long> target, List<Long> ids) {
        if (ids != null) ids.stream().filter(Objects::nonNull).forEach(target::add);
    }

    private void persistBlueprint(ExamConfig config, UpsertExamConfigRequest request, int total) {
        if (blueprintFieldRepository == null) throw new BadRequestException("Blueprint repository chưa được cấu hình");
        blueprintFieldRepository.deleteByExamConfig(config);
        sourceFilterRepository.deleteByExamConfig(config);
        List<UpsertExamConfigRequest.FieldBlueprint> fields = request.fieldBlueprints();
        List<Integer> fieldCounts = allocateCounts(fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::percentage).toList(), fields.stream().map(UpsertExamConfigRequest.FieldBlueprint::questionCount).toList(), total);
        for (int i = 0; i < fields.size(); i++) {
            UpsertExamConfigRequest.FieldBlueprint draft = fields.get(i);
            ProfessionalField field = professionalFieldRepository.findById(draft.professionalFieldId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lĩnh vực chuyên môn"));
            int fieldCount = fieldCounts.get(i);
            java.math.BigDecimal fieldPercentage = draft.percentage() == null ? java.math.BigDecimal.valueOf(fieldCount * 100.0 / total).setScale(2, java.math.RoundingMode.HALF_UP) : draft.percentage();
            ExamBlueprintField saved = blueprintFieldRepository.save(ExamBlueprintField.builder().examConfig(config).professionalField(field).percentage(fieldPercentage).questionCount(fieldCount).displayOrder(draft.displayOrder() == null ? i : draft.displayOrder()).passingThreshold(draft.passingThreshold()).build());
            List<Integer> cellCounts = allocateCounts(draft.cognitive().stream().map(UpsertExamConfigRequest.CognitiveDistribution::percentage).toList(), draft.cognitive().stream().map(UpsertExamConfigRequest.CognitiveDistribution::questionCount).toList(), fieldCount);
            for (int c = 0; c < draft.cognitive().size(); c++) {
                UpsertExamConfigRequest.CognitiveDistribution cell = draft.cognitive().get(c);
                int count = cellCounts.get(c);
                java.math.BigDecimal percentage = cell.percentage() == null ? java.math.BigDecimal.valueOf(count * 100.0 / Math.max(1, fieldCount)).setScale(2, java.math.RoundingMode.HALF_UP) : cell.percentage();
                blueprintCellRepository.save(ExamBlueprintCell.builder().blueprintField(saved).cognitiveLevel(parseCognitive(cell.cognitiveLevel())).percentage(percentage).questionCount(count).build());
            }
        }
        persistSourceFilters(config, request.sourceFilters());
    }

    private void persistSourceFilters(ExamConfig config, UpsertExamConfigRequest.SourceFilters filters) {
        if (filters == null) return;
        saveFilters(config, ExamConfigSourceFilter.FilterType.INCLUDE_CATEGORY, filters.includedCategoryIds());
        saveFilters(config, ExamConfigSourceFilter.FilterType.EXCLUDE_CATEGORY, filters.excludedCategoryIds());
        saveFilters(config, ExamConfigSourceFilter.FilterType.INCLUDE_DOCUMENT, filters.includedDocumentIds());
        saveFilters(config, ExamConfigSourceFilter.FilterType.EXCLUDE_DOCUMENT, filters.excludedDocumentIds());
    }
    private void saveFilters(ExamConfig config, ExamConfigSourceFilter.FilterType type, List<Long> ids) { if (ids != null) ids.stream().filter(Objects::nonNull).distinct().forEach(id -> sourceFilterRepository.save(ExamConfigSourceFilter.builder().examConfig(config).filterType(type).referenceId(id).build())); }

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

    private ExamQuestionSelectionMode parseSelectionMode(String value) {
        if (value == null || value.isBlank()) {
            return ExamQuestionSelectionMode.FIXED_PAPER;
        }
        try {
            return ExamQuestionSelectionMode.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Chế độ chọn câu hỏi không hợp lệ");
        }
    }

    private ExamQuestionSelectionMode selectionMode(ExamConfig config) {
        return config.getQuestionSelectionMode() == null
                ? ExamQuestionSelectionMode.FIXED_PAPER
                : config.getQuestionSelectionMode();
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
        if (value == null || value < 0 || value > 10) {
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

    private record BlueprintPreview(
            int distributedQuestions,
            boolean valid,
            List<ExamBlueprintFieldPreviewResponse> fields,
            List<String> warnings
    ) { }
}
