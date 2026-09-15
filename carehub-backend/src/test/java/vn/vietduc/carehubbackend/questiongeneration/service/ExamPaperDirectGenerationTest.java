package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.common.response.ErrorResponse;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatch;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatchCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigSourceFilterRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamPaperDirectGenerationTest {
    private final ExamPaperRepository paperRepository = mock(ExamPaperRepository.class);
    private final ExamPaperQuestionRepository paperQuestionRepository = mock(ExamPaperQuestionRepository.class);
    private final ExamPaperQuestionSnapshotRepository snapshotRepository = mock(ExamPaperQuestionSnapshotRepository.class);
    private final ExamConfigRepository configRepository = mock(ExamConfigRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final ExamAssignmentRepository assignmentRepository = mock(ExamAssignmentRepository.class);
    private final ExamBlueprintFieldRepository blueprintFieldRepository = mock(ExamBlueprintFieldRepository.class);
    private final ExamBlueprintCellRepository blueprintCellRepository = mock(ExamBlueprintCellRepository.class);
    private final ExamConfigSourceFilterRepository sourceFilterRepository = mock(ExamConfigSourceFilterRepository.class);
    private final ExamPaperGenerationBatchRepository batchRepository = mock(ExamPaperGenerationBatchRepository.class);
    private final ExamPaperGenerationBatchCellRepository batchCellRepository = mock(ExamPaperGenerationBatchCellRepository.class);

    private final AtomicLong ids = new AtomicLong(1000);
    private final Map<String, ExamPaperGenerationBatch> batchesByKey = new HashMap<>();
    private final Map<ExamPaperGenerationBatch, List<ExamPaper>> papersByBatch = new HashMap<>();
    private final Map<ExamPaper, List<ExamPaperQuestion>> questionsByPaper = new HashMap<>();
    private final Map<ExamPaperQuestion, ExamPaperQuestionSnapshot> snapshots = new HashMap<>();
    private final Map<ExamPaperGenerationBatch, List<ExamPaperGenerationBatchCell>> cellsByBatch = new HashMap<>();

    private ExamPaperService service;
    private ExamConfig config;
    private ProfessionalField emergency;
    private ProfessionalField surgery;
    private List<ExamBlueprintField> fields;
    private Map<Long, List<ExamBlueprintCell>> cells;
    private List<QuestionBankQuestion> pool;

    @BeforeEach
    void setUp() {
        service = new ExamPaperService(
                paperRepository, paperQuestionRepository, snapshotRepository, configRepository,
                questionRepository, assignmentRepository);
        service.setBlueprintRepositories(blueprintFieldRepository, blueprintCellRepository, sourceFilterRepository);
        service.setGenerationRepositories(batchRepository, batchCellRepository);

        emergency = field(1L, "CC", "Hồi sức – Cấp cứu");
        surgery = field(2L, "NGOAI", "Chăm sóc ngoại khoa");
        config = ExamConfig.builder()
                .id(50L).name("Kiểm tra đa lĩnh vực").blueprintVersion(4)
                .totalQuestions(2).timeLimitMinutes(30).passingScore(7).maxRetakes(0)
                .shuffleQuestions(true).shuffleOptions(true).status(ExamConfigStatus.ACTIVE)
                .build();
        fields = List.of(blueprintField(101L, emergency, 0), blueprintField(102L, surgery, 1));
        cells = Map.of(
                101L, cognitiveCells(fields.get(0), 201L, 1),
                102L, cognitiveCells(fields.get(1), 211L, 1)
        );
        pool = List.of(
                question(1L, emergency, category(11L, "CC-A", "Cấp cứu"), document(21L, "cap-cuu.pdf")),
                question(2L, emergency, category(12L, "CC-B", "Chấn thương"), document(22L, "chan-thuong.pdf")),
                question(3L, surgery, category(13L, "NG-A", "Ngoại khoa"), document(23L, "ngoai-khoa.pdf")),
                question(4L, surgery, category(14L, "NG-B", "Gãy xương"), document(24L, "gay-xuong.pdf"))
        );

        when(configRepository.findByIdForUpdate(config.getId())).thenReturn(Optional.of(config));
        when(blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId())).thenAnswer(invocation -> fields);
        when(blueprintCellRepository.findByBlueprintFieldId(anyLong())).thenAnswer(invocation -> cells.get(invocation.getArgument(0)));
        when(sourceFilterRepository.findByExamConfigOrderByIdAsc(config)).thenReturn(List.of());
        when(questionRepository.findByStatusAndProfessionalFieldIdInOrderByIdAsc(any(), anySet())).thenAnswer(invocation -> pool);
        config.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(config.getBlueprintVersion(), List.of(), pool));

        when(batchRepository.findByIdempotencyKey(any())).thenAnswer(invocation -> Optional.ofNullable(batchesByKey.get(invocation.getArgument(0))));
        when(batchRepository.save(any())).thenAnswer(invocation -> {
            ExamPaperGenerationBatch batch = invocation.getArgument(0);
            if (batch.getId() == null) batch.setId(ids.incrementAndGet());
            batchesByKey.put(batch.getIdempotencyKey(), batch);
            return batch;
        });
        when(batchCellRepository.save(any())).thenAnswer(invocation -> {
            ExamPaperGenerationBatchCell cell = invocation.getArgument(0);
            if (cell.getId() == null) cell.setId(ids.incrementAndGet());
            cellsByBatch.computeIfAbsent(cell.getGenerationBatch(), key -> new ArrayList<>()).add(cell);
            return cell;
        });
        when(batchCellRepository.findByGenerationBatchOrderByDisplayOrderAscCognitiveLevelAsc(any()))
                .thenAnswer(invocation -> cellsByBatch.getOrDefault(invocation.getArgument(0), List.of()));
        when(paperRepository.save(any())).thenAnswer(invocation -> {
            ExamPaper paper = invocation.getArgument(0);
            if (paper.getId() == null) paper.setId(ids.incrementAndGet());
            papersByBatch.computeIfAbsent(paper.getGenerationBatch(), key -> new ArrayList<>()).add(paper);
            return paper;
        });
        when(paperRepository.findByGenerationBatchOrderByVariantIndexAsc(any()))
                .thenAnswer(invocation -> papersByBatch.getOrDefault(invocation.getArgument(0), List.of()));
        when(paperRepository.findById(anyLong())).thenAnswer(invocation -> {
            Long paperId = invocation.getArgument(0);
            return papersByBatch.values().stream()
                    .flatMap(List::stream)
                    .filter(paper -> paperId.equals(paper.getId()))
                    .findFirst();
        });
        when(paperQuestionRepository.save(any())).thenAnswer(invocation -> {
            ExamPaperQuestion question = invocation.getArgument(0);
            if (question.getId() == null) question.setId(ids.incrementAndGet());
            questionsByPaper.computeIfAbsent(question.getExamPaper(), key -> new ArrayList<>()).add(question);
            return question;
        });
        when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(any()))
                .thenAnswer(invocation -> questionsByPaper.getOrDefault(invocation.getArgument(0), List.of()));
        when(snapshotRepository.save(any())).thenAnswer(invocation -> {
            ExamPaperQuestionSnapshot snapshot = invocation.getArgument(0);
            if (snapshot.getId() == null) snapshot.setId(ids.incrementAndGet());
            snapshots.put(snapshot.getExamPaperQuestion(), snapshot);
            return snapshot;
        });
        when(snapshotRepository.findByExamPaperQuestion(any()))
                .thenAnswer(invocation -> Optional.ofNullable(snapshots.get(invocation.getArgument(0))));
    }

    @Test
    void generatesDirectlyFromBankWithStableSnapshotCoverage() {
        var papers = service.generate(request("direct-1", 2, 991L, false), "publisher");

        assertThat(papers).hasSize(2);
        assertThat(papers.get(0).coverage()).hasSize(6).allMatch(cell -> cell.matchesBlueprint());
        assertThat(papers.get(0).questions()).extracting(question -> question.professionalFieldId())
                .containsExactlyInAnyOrder(1L, 2L);
        assertThat(papers.get(0).questions()).extracting(question -> question.categoryId())
                .doesNotHaveDuplicates();
        assertThat(papers.get(0).questions()).extracting(question -> question.sourceDocumentId())
                .doesNotHaveDuplicates();
        assertThat(snapshots.values()).allSatisfy(snapshot -> {
            assertThat(snapshot.getQuestionPosition()).isPositive();
            assertThat(snapshot.getOptionOrderJson()).isNotBlank();
        });
        assertThat(papers.get(0).generationAlgorithmVersion()).isEqualTo(ExamGenerationDeterminism.ALGORITHM_VERSION);
        assertThat(papers.get(0).configVersion()).isEqualTo(4);
        verify(questionRepository).findByStatusAndProfessionalFieldIdInOrderByIdAsc(any(), anySet());
    }

    @Test
    void sameMasterSeedReproducesQuestionOrderAcrossBatches() {
        var first = service.generate(request("stable-1", 1, 42L, false), "publisher").get(0);
        var second = service.generate(request("stable-2", 1, 42L, false), "publisher").get(0);

        assertThat(second.randomSeed()).isEqualTo(first.randomSeed());
        assertThat(second.questions()).extracting(question -> question.questionId())
                .containsExactlyElementsOf(first.questions().stream().map(question -> question.questionId()).toList());
        assertThat(second.questions()).extracting(
                        question -> List.of(question.optionA(), question.optionB(), question.optionC(), question.optionD(), question.correctAnswer()))
                .containsExactlyElementsOf(first.questions().stream()
                        .map(question -> List.of(question.optionA(), question.optionB(), question.optionC(), question.optionD(), question.correctAnswer()))
                        .toList());
    }

    @Test
    void sameIdempotencyKeyReturnsOldBatchAndDifferentPayloadConflicts() {
        var first = service.generate(request("same-key", 1, 42L, false), "publisher");
        var retried = service.generate(request("same-key", 1, 42L, false), "publisher");

        assertThat(retried).extracting(paper -> paper.id())
                .containsExactlyElementsOf(first.stream().map(paper -> paper.id()).toList());
        assertThatThrownBy(() -> service.generate(request("same-key", 2, 42L, false), "publisher"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("payload");
    }

    @Test
    void idempotentReplayUsesStoredVersionEvenAfterConfigChanges() {
        var first = service.generate(request("version-replay", 1, 42L, false), "publisher");
        config.setBlueprintVersion(5);
        config.setStatus(ExamConfigStatus.INACTIVE);

        var retried = service.generate(request("version-replay", 1, 42L, false), "publisher");

        assertThat(retried).extracting(paper -> paper.id())
                .containsExactlyElementsOf(first.stream().map(paper -> paper.id()).toList());
        assertThat(retried.get(0).configVersion()).isEqualTo(4);
    }

    @Test
    void changedPoolAfterPreviewReturnsConflictWithoutCreatingPaper() {
        config.setPoolChecksum("stale-checksum");

        assertThatThrownBy(() -> service.generate(request("stale-pool", 1, 42L, false), "publisher"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("preview lại");
        assertThat(papersByBatch.values()).allMatch(List::isEmpty);
    }

    @Test
    void excludesParaphrasesFromTheSameFamilyInsideOnePaper() {
        ExamBlueprintField field = blueprintField(301L, emergency, 0);
        fields = List.of(field);
        cells = Map.of(301L, cognitiveCells(field, 401L, 2));
        config.setTotalQuestions(2);
        QuestionBankQuestion root = question(31L, emergency, category(41L, "FAM", "Gia đình câu"), document(51L, "family.pdf"));
        QuestionBankQuestion paraphrase = question(32L, emergency, root.getCategory(), root.getSourceDocumentRef());
        paraphrase.setParentQuestion(root);
        QuestionBankQuestion independent = question(33L, emergency, root.getCategory(), root.getSourceDocumentRef());
        pool = List.of(root, paraphrase, independent);
        config.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(config.getBlueprintVersion(), List.of(), pool));

        var paper = service.generate(request("family", 1, 9L, false), "publisher").get(0);

        assertThat(paper.questions()).extracting(question -> question.questionFamilyId()).doesNotHaveDuplicates();
        assertThat(paper.questions()).extracting(question -> question.questionId()).contains(33L);
    }

    @Test
    void backfillKeepsFamiliesUniqueAndAllowsPublishing() {
        ExamBlueprintField field = blueprintField(351L, emergency, 0);
        field.setQuestionCount(3);
        fields = List.of(field);
        cells = Map.of(351L, List.of(
                cell(451L, field, CognitiveLevel.FOUNDATION, 2),
                cell(452L, field, CognitiveLevel.CLINICAL_APPLICATION, 1),
                cell(453L, field, CognitiveLevel.CLINICAL_REASONING_ANALYSIS, 0)
        ));
        config.setTotalQuestions(3);
        config.setBackfillNearestCognitiveLevel(true);
        QuestionBankQuestion foundation = question(61L, emergency, category(71L, "F", "Nền tảng"), document(81L, "foundation.pdf"));
        QuestionBankQuestion applicationOne = question(62L, emergency, category(72L, "A1", "Áp dụng 1"), document(82L, "application-1.pdf"));
        QuestionBankQuestion applicationTwo = question(63L, emergency, category(73L, "A2", "Áp dụng 2"), document(83L, "application-2.pdf"));
        applicationOne.setCognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION);
        applicationTwo.setCognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION);
        pool = List.of(foundation, applicationOne, applicationTwo);
        config.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(config.getBlueprintVersion(), List.of(), pool));

        var generated = service.generate(request("backfill", 1, 15L, false), "publisher").get(0);
        var published = service.publish(generated.id(), "publisher");

        assertThat(generated.questions()).extracting(question -> question.questionFamilyId()).doesNotHaveDuplicates();
        assertThat(generated.coverage()).anyMatch(cell -> !cell.matchesBlueprint());
        assertThat(published.status()).isEqualTo("PUBLISHED");
    }

    @Test
    void zeroOverlapUsesDistinctQuestionsAcrossVariants() {
        config.setTotalQuestions(2);
        var papers = service.generate(request("zero-overlap", 2, 77L, true), "publisher");

        Set<Long> firstIds = papers.get(0).questions().stream().map(question -> question.questionId()).collect(java.util.stream.Collectors.toSet());
        Set<Long> secondIds = papers.get(1).questions().stream().map(question -> question.questionId()).collect(java.util.stream.Collectors.toSet());
        assertThat(firstIds).doesNotContainAnyElementsOf(secondIds);
        assertThat(papers.get(0).overlapQuestionCount()).isZero();
        assertThat(papers.get(0).overlapPercentage()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void insufficientBlueprintPoolReportsAllShortagesAtOnce() {
        ExamBlueprintField emergencyField = blueprintField(501L, emergency, 0);
        ExamBlueprintField surgeryField = blueprintField(502L, surgery, 1);
        fields = List.of(emergencyField, surgeryField);
        cells = Map.of(
                501L, cognitiveCells(emergencyField, 601L, 3),
                502L, cognitiveCells(surgeryField, 611L, 3)
        );
        config.setTotalQuestions(6);
        QuestionBankQuestion emergencyApplication = question(41L, emergency, category(43L, "CC-C", "Cấp cứu nâng cao"), document(53L, "cc-nang-cao.pdf"));
        emergencyApplication.setCognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION);
        QuestionBankQuestion surgeryApplication = question(42L, surgery, category(44L, "NG-C", "Ngoại nâng cao"), document(54L, "ngoai-nang-cao.pdf"));
        surgeryApplication.setCognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION);
        pool = List.of(pool.get(0), pool.get(1), pool.get(2), pool.get(3), emergencyApplication, surgeryApplication);
        config.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(config.getBlueprintVersion(), List.of(), pool));

        assertThatThrownBy(() -> service.generate(request("shortage", 1, 5L, false), "publisher"))
                .isInstanceOfSatisfying(ValidationException.class, validation -> {
                    assertThat(validation.getFieldErrors()).hasSize(2);
                    assertThat(validation.getFieldErrors())
                            .extracting(ErrorResponse.FieldErrorDetail::message)
                            .allMatch(message -> message.contains("cần 3") && message.contains("hiện có 2"));
                });
        assertThat(papersByBatch.values()).allMatch(List::isEmpty);
    }

    @Test
    void zeroOverlapShortageAccountsForVariantMultiplier() {
        config.setTotalQuestions(2);

        assertThatThrownBy(() -> service.generate(request("zero-overlap-shortage", 3, 5L, true), "publisher"))
                .isInstanceOfSatisfying(ValidationException.class, validation -> {
                    assertThat(validation.getFieldErrors()).hasSize(2);
                    assertThat(validation.getFieldErrors())
                            .extracting(ErrorResponse.FieldErrorDetail::message)
                            .allMatch(message -> message.contains("cần 3") && message.contains("hiện có 2"));
                });
        assertThat(papersByBatch.values()).allMatch(List::isEmpty);
    }

    @Test
    void taxonomyAndDocumentRenameDoNotChangeGeneratedSnapshot() {
        var generated = service.generate(request("snapshot-rename", 1, 19L, false), "publisher").get(0);
        var originalQuestions = generated.questions();

        emergency.setName("Tên lĩnh vực mới");
        surgery.setName("Tên ngoại khoa mới");
        pool.forEach(question -> {
            question.getCategory().setName("Danh mục đổi tên " + question.getCategory().getId());
            question.getSourceDocumentRef().setFilename("tai-lieu-doi-ten-" + question.getId() + ".pdf");
        });

        var reloaded = service.get(generated.id(), true);

        assertThat(reloaded.questions()).extracting(question -> question.professionalFieldName())
                .containsExactlyElementsOf(originalQuestions.stream().map(question -> question.professionalFieldName()).toList());
        assertThat(reloaded.questions()).extracting(question -> question.categoryName())
                .containsExactlyElementsOf(originalQuestions.stream().map(question -> question.categoryName()).toList());
        assertThat(reloaded.questions()).extracting(question -> question.sourceDocumentFilename())
                .containsExactlyElementsOf(originalQuestions.stream().map(question -> question.sourceDocumentFilename()).toList());
    }

    private GenerateExamPaperRequest request(String key, int variants, Long seed, boolean zeroOverlap) {
        return new GenerateExamPaperRequest(config.getId(), "Đề đa lĩnh vực", variants, seed, key, zeroOverlap);
    }

    private ProfessionalField field(Long id, String code, String name) {
        return ProfessionalField.builder().id(id).code(code).name(name).active(true).build();
    }

    private ExamBlueprintField blueprintField(Long id, ProfessionalField field, int order) {
        return ExamBlueprintField.builder().id(id).examConfig(config).professionalField(field)
                .percentage(BigDecimal.valueOf(50)).questionCount(1).displayOrder(order).build();
    }

    private List<ExamBlueprintCell> cognitiveCells(ExamBlueprintField field, long firstId, int foundationCount) {
        return List.of(
                cell(firstId, field, CognitiveLevel.FOUNDATION, foundationCount),
                cell(firstId + 1, field, CognitiveLevel.CLINICAL_APPLICATION, 0),
                cell(firstId + 2, field, CognitiveLevel.CLINICAL_REASONING_ANALYSIS, 0)
        );
    }

    private ExamBlueprintCell cell(Long id, ExamBlueprintField field, CognitiveLevel level, int count) {
        return ExamBlueprintCell.builder().id(id).blueprintField(field).cognitiveLevel(level)
                .percentage(count == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(100))
                .questionCount(count).build();
    }

    private QuestionBankQuestion question(
            Long id,
            ProfessionalField field,
            QuestionCategory category,
            QuestionDocument document
    ) {
        QuestionBankQuestion question = QuestionBankQuestion.builder()
                .id(id).stem("Câu " + id).optionA("A").optionB("B").optionC("C").optionD("D")
                .correctAnswer("A").language("vi")
                .category(category).professionalField(field).cognitiveLevel(CognitiveLevel.FOUNDATION)
                .cognitiveVerifiedAt(LocalDateTime.of(2026, 8, 13, 8, 0)).cognitiveVerifiedBy("reviewer")
                .sourceDocumentRef(document).sourceDocument(document.getFilename())
                .status(QuestionBankStatus.APPROVED).build();
        question.setUpdatedAt(LocalDateTime.of(2026, 8, 13, 8, id.intValue() % 59));
        return question;
    }

    private QuestionCategory category(Long id, String code, String name) {
        return QuestionCategory.builder().id(id).code(code).name(name).status(QuestionCategoryStatus.ACTIVE).build();
    }

    private QuestionDocument document(Long id, String filename) {
        return QuestionDocument.builder().id(id).filename(filename).contentHash("hash-" + id)
                .status(DocumentStatus.READY).pageCount(1).chunkCount(1).build();
    }
}
