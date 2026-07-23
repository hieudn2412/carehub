package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigDistribution;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersionItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigDistributionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionRepository;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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
        private final ExamConfigDistributionRepository distributionRepository = mock(
                        ExamConfigDistributionRepository.class);
        private final QuestionSetItemRepository questionSetItemRepository = mock(QuestionSetItemRepository.class);
        private final QuestionSetVersionRepository questionSetVersionRepository = mock(
                        QuestionSetVersionRepository.class);
        private final QuestionSetVersionItemRepository questionSetVersionItemRepository = mock(
                        QuestionSetVersionItemRepository.class);
        private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
        private final AtomicLong ids = new AtomicLong(200);
        private final List<ExamPaperQuestion> savedQuestions = new ArrayList<>();
        private final List<ExamPaperQuestionSnapshot> savedSnapshots = new ArrayList<>();
        private ExamPaperService service;
        private ExamConfig activeConfig;
        private QuestionCategory category;
        private QuestionSet questionSet;

        @BeforeEach
        void setUp() {
                service = new ExamPaperService(
                                paperRepository,
                                paperQuestionRepository,
                                snapshotRepository,
                                configRepository,
                                distributionRepository,
                                questionSetItemRepository,
                                questionSetVersionRepository,
                                questionSetVersionItemRepository,
                                questionRepository);
                category = QuestionCategory.builder()
                                .id(10L)
                                .name("An toàn người bệnh")
                                .status(QuestionCategoryStatus.ACTIVE)
                                .sortOrder(1)
                                .build();
                questionSet = QuestionSet.builder()
                                .id(20L)
                                .name("Bộ câu hỏi an toàn")
                                .status(QuestionSetStatus.ACTIVE)
                                .questionCount(3)
                                .build();
                activeConfig = ExamConfig.builder()
                                .id(30L)
                                .name("Cấu hình an toàn")
                                .questionSet(questionSet)
                                .totalQuestions(2)
                                .timeLimitMinutes(30)
                                .passingScore(70)
                                .maxRetakes(3)
                                .shuffleQuestions(false)
                                .shuffleOptions(false)
                                .status(ExamConfigStatus.ACTIVE)
                                .build();
                savedQuestions.clear();
                savedSnapshots.clear();

                when(configRepository.findById(activeConfig.getId())).thenReturn(Optional.of(activeConfig));
                when(distributionRepository.findByExamConfigOrderByIdAsc(activeConfig)).thenReturn(List.of(
                                ExamConfigDistribution.builder()
                                                .id(40L)
                                                .examConfig(activeConfig)
                                                .category(category)
                                                .questionCount(2)
                                                .required(true)
                                                .build()));
                when(questionSetItemRepository.findByQuestionSetOrderByPositionAsc(questionSet))
                                .thenReturn(questionSetItems(3));
                when(questionSetVersionRepository.findByQuestionSetOrderByVersionDesc(questionSet))
                                .thenReturn(List.of());
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
                                new GenerateExamPaperRequest(activeConfig.getId(), "Đề an toàn", 1, 123L), "admin");

                assertThat(responses).hasSize(1);
                assertThat(responses.get(0).status()).isEqualTo(ExamPaperStatus.DRAFT.name());
                assertThat(responses.get(0).questions()).hasSize(2);
                assertThat(savedSnapshots).hasSize(2);
                assertThat(savedSnapshots.get(0).getStem()).contains("Câu hỏi");
        }

        @Test
        void generateUsesActiveQuestionSetVersionSnapshotWhenAvailable() {
                activeConfig.setTotalQuestions(1);
                questionSet.setActiveVersion(1);
                QuestionSetVersion version = QuestionSetVersion.builder()
                                .id(501L)
                                .questionSet(questionSet)
                                .version(1)
                                .questionCount(1)
                                .snapshotAt(java.time.LocalDateTime.now())
                                .activatedBy("admin")
                                .build();
                QuestionSetVersionItem versionItem = QuestionSetVersionItem.builder()
                                .id(502L)
                                .questionSetVersion(version)
                                .sourceQuestionId(1L)
                                .position(1)
                                .points(BigDecimal.ONE)
                                .required(true)
                                .stem("Stem snapshot active")
                                .optionA("A snapshot")
                                .optionB("B snapshot")
                                .optionC("C snapshot")
                                .optionD("D snapshot")
                                .correctAnswer("B")
                                .explanation("Giải thích snapshot")
                                .difficulty("medium")
                                .topic(category.getName())
                                .sourceDocument("Snapshot source")
                                .build();
                when(questionSetVersionRepository.findByQuestionSetOrderByVersionDesc(questionSet))
                                .thenReturn(List.of(version));
                when(questionSetVersionItemRepository.findByQuestionSetVersionOrderByPositionAsc(version))
                                .thenReturn(List.of(versionItem));
                when(questionRepository.findAllById(List.of(1L))).thenReturn(List.of(
                                question(1L, "Stem live đã đổi", QuestionBankStatus.APPROVED)));
                when(distributionRepository.findByExamConfigOrderByIdAsc(activeConfig)).thenReturn(List.of(
                                ExamConfigDistribution.builder()
                                                .id(42L)
                                                .examConfig(activeConfig)
                                                .category(category)
                                                .questionCount(1)
                                                .required(true)
                                                .build()));

                var responses = service.generate(
                                new GenerateExamPaperRequest(activeConfig.getId(), "Đề snapshot", 1, 123L), "admin");

                assertThat(responses.get(0).questions()).hasSize(1);
                assertThat(responses.get(0).questions().get(0).stem()).isEqualTo("Stem snapshot active");
                assertThat(responses.get(0).questions().get(0).optionB()).isEqualTo("B snapshot");
                assertThat(responses.get(0).questions().get(0).correctAnswer()).isEqualTo("B");
                assertThat(savedSnapshots.get(0).getStem()).isEqualTo("Stem snapshot active");
                assertThat(savedSnapshots.get(0).getStem()).doesNotContain("live");
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
                                .difficulty("MEDIUM")
                                .topic(category.getName())
                                .sourceDocument("Tài liệu")
                                .build();
                QuestionSetItem item = QuestionSetItem.builder()
                                .id(199L)
                                .questionSet(questionSet)
                                .question(question)
                                .position(1)
                                .points(BigDecimal.ONE)
                                .required(true)
                                .build();
                activeConfig.setTotalQuestions(1);
                activeConfig.setShuffleOptions(true);
                when(distributionRepository.findByExamConfigOrderByIdAsc(activeConfig)).thenReturn(List.of(
                                ExamConfigDistribution.builder()
                                                .id(41L)
                                                .examConfig(activeConfig)
                                                .category(category)
                                                .questionCount(1)
                                                .required(true)
                                                .build()));
                when(questionSetItemRepository.findByQuestionSetOrderByPositionAsc(questionSet))
                                .thenReturn(List.of(item));

                var responses = service.generate(
                                new GenerateExamPaperRequest(activeConfig.getId(), "Đề xáo đáp án", 1, 123L), "admin");

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
                                .generate(new GenerateExamPaperRequest(activeConfig.getId(), "Đề", 1, 1L), "admin"))
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
                                .questionSet(questionSet)
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
                                .question(questionSetItems(1).get(0).getQuestion())
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
                                .question(questionSetItems(1).get(0).getQuestion())
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

        private List<QuestionSetItem> questionSetItems(int count) {
                List<QuestionSetItem> items = new ArrayList<>();
                for (int index = 0; index < count; index++) {
                        QuestionBankQuestion question = QuestionBankQuestion.builder()
                                        .id((long) index + 1)
                                        .stem("Câu hỏi " + index)
                                        .optionA("A" + index)
                                        .optionB("B" + index)
                                        .optionC("C" + index)
                                        .optionD("D" + index)
                                        .correctAnswer("A")
                                        .explanation("Giải thích " + index)
                                        .difficulty("EASY")
                                        .topic(category.getName())
                                        .sourceDocument("Tài liệu")
                                        .build();
                        items.add(QuestionSetItem.builder()
                                        .id((long) index + 100)
                                        .questionSet(questionSet)
                                        .question(question)
                                        .position(index + 1)
                                        .points(BigDecimal.ONE)
                                        .required(true)
                                        .build());
                }
                return items;
        }

        private QuestionBankQuestion question(Long id, String stem, QuestionBankStatus status) {
                return QuestionBankQuestion.builder()
                                .id(id)
                                .stem(stem)
                                .optionA("A")
                                .optionB("B")
                                .optionC("C")
                                .optionD("D")
                                .correctAnswer("A")
                                .explanation("Giải thích")
                                .difficulty("EASY")
                                .topic(category.getName())
                                .sourceDocument("Tài liệu")
                                .status(status)
                                .build();
        }

        private ExamPaper paper(Long id, ExamPaperStatus status) {
                return ExamPaper.builder()
                                .id(id)
                                .code("EP-" + id)
                                .name("Đề " + id)
                                .examConfig(activeConfig)
                                .questionSet(questionSet)
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
                                .difficulty("EASY")
                                .topic(category.getName())
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
