package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatch;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigSourceFilterRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamPaperServiceTest {
        private final ExamPaperRepository paperRepository = mock(ExamPaperRepository.class);
        private final ExamPaperQuestionRepository paperQuestionRepository = mock(ExamPaperQuestionRepository.class);
        private final ExamPaperQuestionSnapshotRepository snapshotRepository = mock(
                        ExamPaperQuestionSnapshotRepository.class);
        private final ExamConfigRepository configRepository = mock(ExamConfigRepository.class);
        private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
        private final ExamAssignmentRepository examAssignmentRepository = mock(ExamAssignmentRepository.class);
        private final ExamPaperGenerationBatchRepository generationBatchRepository = mock(ExamPaperGenerationBatchRepository.class);
        private final ExamPaperGenerationBatchCellRepository generationBatchCellRepository = mock(ExamPaperGenerationBatchCellRepository.class);
        private final ExamBlueprintFieldRepository blueprintFieldRepository = mock(ExamBlueprintFieldRepository.class);
        private final ExamBlueprintCellRepository blueprintCellRepository = mock(ExamBlueprintCellRepository.class);
        private final ExamConfigSourceFilterRepository sourceFilterRepository = mock(ExamConfigSourceFilterRepository.class);
        private final AtomicLong ids = new AtomicLong(200);
        private final List<ExamPaperQuestion> savedQuestions = new ArrayList<>();
        private final List<ExamPaperQuestionSnapshot> savedSnapshots = new ArrayList<>();
        private final List<QuestionBankQuestion> pool = new ArrayList<>();
        private ExamPaperService service;
        private ExamConfig activeConfig;
        private QuestionCategory category;
        private ProfessionalField professionalField;
        private ExamBlueprintField blueprintField;
        private ExamBlueprintCell blueprintCell;

        @BeforeEach
        void setUp() {
                service = new ExamPaperService(
                                paperRepository,
                                paperQuestionRepository,
                                snapshotRepository,
                                configRepository,
                                questionRepository,
                                examAssignmentRepository);
                service.setBlueprintRepositories(blueprintFieldRepository, blueprintCellRepository, sourceFilterRepository);
                service.setGenerationRepositories(generationBatchRepository, generationBatchCellRepository);
                category = QuestionCategory.builder()
                                .id(10L)
                                .name("An toàn người bệnh")
                                .status(QuestionCategoryStatus.ACTIVE)
                                .build();
                professionalField = ProfessionalField.builder()
                                .id(15L)
                                .code("PF-01")
                                .name("Lĩnh vực an toàn")
                                .active(true)
                                .build();
                activeConfig = ExamConfig.builder()
                                .id(30L)
                                .name("Cấu hình an toàn")
                                .totalQuestions(2)
                                .timeLimitMinutes(30)
                                .passingScore(70)
                                .maxRetakes(3)
                                .shuffleQuestions(false)
                                .shuffleOptions(false)
                                .blueprintVersion(1)
                                .status(ExamConfigStatus.ACTIVE)
                                .build();
                blueprintField = ExamBlueprintField.builder()
                                .id(60L)
                                .examConfig(activeConfig)
                                .professionalField(professionalField)
                                .percentage(BigDecimal.valueOf(100))
                                .questionCount(2)
                                .displayOrder(0)
                                .build();
                blueprintCell = ExamBlueprintCell.builder()
                                .id(61L)
                                .blueprintField(blueprintField)
                                .cognitiveLevel(CognitiveLevel.FOUNDATION)
                                .percentage(BigDecimal.valueOf(100))
                                .questionCount(2)
                                .build();
                savedQuestions.clear();
                savedSnapshots.clear();
                pool.clear();
                pool.addAll(questionPool(2));
                recomputeChecksum();

                when(configRepository.findById(activeConfig.getId())).thenReturn(Optional.of(activeConfig));
                when(configRepository.findByIdForUpdate(activeConfig.getId())).thenReturn(Optional.of(activeConfig));
                when(generationBatchRepository.findByIdempotencyKey(any())).thenReturn(Optional.empty());
                when(generationBatchRepository.save(any(ExamPaperGenerationBatch.class))).thenAnswer(invocation -> {
                        ExamPaperGenerationBatch batch = invocation.getArgument(0);
                        if (batch.getId() == null) batch.setId(ids.incrementAndGet());
                        return batch;
                });
                when(blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(activeConfig.getId()))
                                .thenReturn(List.of(blueprintField));
                when(blueprintCellRepository.findByBlueprintFieldId(blueprintField.getId()))
                                .thenReturn(List.of(blueprintCell));
                when(sourceFilterRepository.findByExamConfigOrderByIdAsc(activeConfig)).thenReturn(List.of());
                when(questionRepository.findByStatusAndProfessionalFieldIdInOrderByIdAsc(any(), any()))
                                .thenAnswer(invocation -> new ArrayList<>(pool));
                when(paperRepository.save(any(ExamPaper.class))).thenAnswer(invocation -> {
                        ExamPaper paper = invocation.getArgument(0);
                        if (paper.getId() == null) {
                                paper.setId(ids.incrementAndGet());
                        }
                        return paper;
                });
                when(paperQuestionRepository.save(any(ExamPaperQuestion.class))).thenAnswer(invocation -> {
                        ExamPaperQuestion question = invocation.getArgument(0);
                        if (question.getId() == null) {
                                question.setId(ids.incrementAndGet());
                        }
                        savedQuestions.add(question);
                        return question;
                });
                when(snapshotRepository.save(any(ExamPaperQuestionSnapshot.class))).thenAnswer(invocation -> {
                        ExamPaperQuestionSnapshot snapshot = invocation.getArgument(0);
                        if (snapshot.getId() == null) {
                                snapshot.setId(ids.incrementAndGet());
                        }
                        savedSnapshots.add(snapshot);
                        return snapshot;
                });
                when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(any())).thenReturn(savedQuestions);
                when(snapshotRepository.findByExamPaperQuestion(any())).thenAnswer(invocation -> {
                        ExamPaperQuestion question = invocation.getArgument(0);
                        return savedSnapshots.stream()
                                        .filter(snapshot -> snapshot.getExamPaperQuestion() == question)
                                        .findFirst();
                });
        }

        @Test
        void generateCreatesDraftPaperWithSnapshots() {
                var responses = service.generate(
                                new GenerateExamPaperRequest(activeConfig.getId(), "Đề an toàn", 1, 123L, "paper-create"), "admin");

                assertThat(responses).hasSize(1);
                assertThat(responses.get(0).status()).isEqualTo(ExamPaperStatus.DRAFT.name());
                assertThat(responses.get(0).questions()).hasSize(2);
                assertThat(savedSnapshots).hasSize(2);
                assertThat(savedSnapshots.get(0).getStem()).contains("Câu hỏi");
        }

        @Test
        void generateShufflesOptionsAndRemapsCorrectAnswerInSnapshot() {
                QuestionBankQuestion question = QuestionBankQuestion.builder()
                                .id(99L)
                                .stem("Câu hỏi cần xáo đáp án")
                                .optionA("A gốc")
                                .optionB("B gốc")
                                .optionC("C gốc")
                                .optionD("D gốc")
                                .correctAnswer("C")
                                .explanation("Giải thích")
                                .category(category)
                                .professionalField(professionalField)
                                .cognitiveLevel(CognitiveLevel.FOUNDATION)
                                .cognitiveVerifiedAt(LocalDateTime.now())
                                .cognitiveVerifiedBy("admin")
                                .sourceDocument("Tài liệu")
                                .build();
                activeConfig.setTotalQuestions(1);
                activeConfig.setShuffleOptions(true);
                blueprintField.setQuestionCount(1);
                blueprintCell.setQuestionCount(1);
                pool.clear();
                pool.add(question);
                recomputeChecksum();

                var responses = service.generate(
                                new GenerateExamPaperRequest(activeConfig.getId(), "Đề xáo đáp án", 1, 123L, "paper-options"), "admin");

                var generated = responses.get(0).questions().get(0);
                assertThat(List.of(generated.optionA(), generated.optionB(), generated.optionC(), generated.optionD()))
                                .containsExactlyInAnyOrder("A gốc", "B gốc", "C gốc", "D gốc");
                assertThat(optionText(generated.correctAnswer(), generated)).isEqualTo("C gốc");
                assertThat(savedQuestions.get(0).getOptionOrderJson()).isNotEqualTo("[\"A\",\"B\",\"C\",\"D\"]");
                assertThat(savedSnapshots.get(0).getCorrectAnswer()).isEqualTo(generated.correctAnswer());
        }

        @Test
        void generateRejectsInactiveConfig() {
                activeConfig.setStatus(ExamConfigStatus.DRAFT);

                assertThatThrownBy(() -> service
                                .generate(new GenerateExamPaperRequest(activeConfig.getId(), "Đề", 1, 1L, "paper-inactive"), "admin"))
                                .isInstanceOf(BadRequestException.class)
                                .hasMessageContaining("đang hoạt động");
        }

        @Test
        void publishMarksPaperPublished() {
                ExamPaper paper = ExamPaper.builder()
                                .id(50L)
                                .code("EP-1")
                                .name("Đề an toàn")
                                .examConfig(activeConfig)
                                .version(1)
                                .randomSeed(1L)
                                .status(ExamPaperStatus.DRAFT)
                                .totalQuestions(0)
                                .timeLimitMinutes(30)
                                .passingScore(70)
                                .build();
                when(paperRepository.findById(paper.getId())).thenReturn(Optional.of(paper));
                when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper)).thenReturn(List.of());

                var response = service.publish(paper.getId(), "admin");

                assertThat(response.status()).isEqualTo(ExamPaperStatus.PUBLISHED.name());
                assertThat(paper.getPublishedBy()).isEqualTo("admin");
                assertThat(paper.getPublishedAt()).isNotNull();
        }

        @Test
        void exportTextCanHideOrIncludeAnswerKey() {
                ExamPaper paper = paper(80L, ExamPaperStatus.PUBLISHED);
                ExamPaperQuestion paperQuestion = ExamPaperQuestion.builder()
                                .id(81L)
                                .examPaper(paper)
                                .question(questionPool(1).get(0))
                                .position(1)
                                .points(BigDecimal.ONE)
                                .build();
                ExamPaperQuestionSnapshot snapshot = snapshot(paperQuestion, "Câu xuất file");
                savedSnapshots.add(snapshot);
                when(paperRepository.findById(paper.getId())).thenReturn(Optional.of(paper));
                when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper))
                                .thenReturn(List.of(paperQuestion));

                String withoutAnswers = new String(service.exportText(paper.getId(), false), StandardCharsets.UTF_8);
                String withAnswers = new String(service.exportText(paper.getId(), true), StandardCharsets.UTF_8);

                assertThat(withoutAnswers).contains("Câu xuất file").doesNotContain("Đáp án đúng");
                assertThat(withAnswers).contains("Đáp án đúng: A").contains("Giải thích");
        }

        @Test
        void exportSupportsDocxXlsxAndPdfFormats() throws Exception {
                ExamPaper paper = paper(90L, ExamPaperStatus.PUBLISHED);
                ExamPaperQuestion paperQuestion = ExamPaperQuestion.builder()
                                .id(91L)
                                .examPaper(paper)
                                .question(questionPool(1).get(0))
                                .position(1)
                                .points(BigDecimal.ONE)
                                .build();
                ExamPaperQuestionSnapshot snapshot = snapshot(paperQuestion, "Câu tiếng Việt có dấu");
                savedSnapshots.add(snapshot);
                when(paperRepository.findById(paper.getId())).thenReturn(Optional.of(paper));
                when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper))
                                .thenReturn(List.of(paperQuestion));

                byte[] docx = service.export(paper.getId(), "docx", true);
                try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(docx))) {
                        String text = document.getParagraphs().stream()
                                        .map(paragraph -> paragraph.getText())
                                        .reduce("", (left, right) -> left + "\n" + right);
                        assertThat(text).contains("Câu tiếng Việt có dấu", "Đáp án đúng: A");
                }

                byte[] xlsx = service.export(paper.getId(), "xlsx", true);
                try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
                        assertThat(workbook.getSheetAt(0).getRow(7).getCell(1).getStringCellValue())
                                        .isEqualTo("Câu tiếng Việt có dấu");
                        assertThat(workbook.getSheetAt(0).getRow(7).getCell(6).getStringCellValue())
                                        .isEqualTo("A");
                }

                byte[] pdf = service.export(paper.getId(), "pdf", false);
                assertThat(new String(Arrays.copyOf(pdf, 4), StandardCharsets.US_ASCII)).isEqualTo("%PDF");
        }

        private void recomputeChecksum() {
                activeConfig.setPoolChecksum(ExamGenerationDeterminism.poolChecksum(
                                activeConfig.getBlueprintVersion(), List.of(), pool));
        }

        private List<QuestionBankQuestion> questionPool(int count) {
                List<QuestionBankQuestion> items = new ArrayList<>();
                for (int index = 0; index < count; index++) {
                        items.add(QuestionBankQuestion.builder()
                                        .id((long) index + 1)
                                        .stem("Câu hỏi " + index)
                                        .optionA("A" + index)
                                        .optionB("B" + index)
                                        .optionC("C" + index)
                                        .optionD("D" + index)
                                        .correctAnswer("A")
                                        .explanation("Giải thích " + index)
                                        .category(category)
                                        .professionalField(professionalField)
                                        .cognitiveLevel(CognitiveLevel.FOUNDATION)
                                        .cognitiveVerifiedAt(LocalDateTime.now())
                                        .cognitiveVerifiedBy("admin")
                                        .sourceDocument("Tài liệu")
                                        .status(QuestionBankStatus.APPROVED)
                                        .build());
                }
                return items;
        }

        private ExamPaper paper(Long id, ExamPaperStatus status) {
                return ExamPaper.builder()
                                .id(id)
                                .code("EP-" + id)
                                .name("Đề " + id)
                                .examConfig(activeConfig)
                                .version(1)
                                .randomSeed(1L)
                                .status(status)
                                .totalQuestions(1)
                                .timeLimitMinutes(30)
                                .passingScore(70)
                                .build();
        }

        private ExamPaperQuestionSnapshot snapshot(ExamPaperQuestion question, String stem) {
                return ExamPaperQuestionSnapshot.builder()
                                .id(ids.incrementAndGet())
                                .examPaperQuestion(question)
                                .stem(stem)
                                .optionA("A")
                                .optionB("B")
                                .optionC("C")
                                .optionD("D")
                                .correctAnswer("A")
                                .explanation("Giải thích")
                                .sourceDocument("Tài liệu")
                                .snapshotAt(java.time.LocalDateTime.now())
                                .build();
        }

        private String optionText(String label,
                        vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperQuestionResponse question) {
                return switch (label) {
                        case "A" -> question.optionA();
                        case "B" -> question.optionB();
                        case "C" -> question.optionC();
                        case "D" -> question.optionD();
                        default -> null;
                };
        }
}
