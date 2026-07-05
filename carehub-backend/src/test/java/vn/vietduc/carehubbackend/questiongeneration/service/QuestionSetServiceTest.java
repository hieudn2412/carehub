package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.PreviewQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersionItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseMapper;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionRepository;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class QuestionSetServiceTest {
    private final QuestionSetRepository setRepository = mock(QuestionSetRepository.class);
    private final QuestionSetItemRepository itemRepository = mock(QuestionSetItemRepository.class);
    private final QuestionSetItemSnapshotRepository snapshotRepository = mock(QuestionSetItemSnapshotRepository.class);
    private final QuestionSetVersionRepository versionRepository = mock(QuestionSetVersionRepository.class);
    private final QuestionSetVersionItemRepository versionItemRepository = mock(QuestionSetVersionItemRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final List<QuestionSetItem> savedItems = new ArrayList<>();
    private final List<QuestionSetVersion> savedVersions = new ArrayList<>();
    private final List<QuestionSetVersionItem> savedVersionItems = new ArrayList<>();
    private final AtomicLong ids = new AtomicLong(100);
    private QuestionSetService service;

    @BeforeEach
    void setUp() {
        savedItems.clear();
        savedVersions.clear();
        savedVersionItems.clear();
        service = new QuestionSetService(
                setRepository,
                itemRepository,
                snapshotRepository,
                versionRepository,
                versionItemRepository,
                questionRepository,
                new ParaphraseMapper()
        );
        when(setRepository.save(any(QuestionSet.class))).thenAnswer(invocation -> {
            QuestionSet questionSet = invocation.getArgument(0);
            if (questionSet.getId() == null) {
                questionSet.setId(ids.incrementAndGet());
            }
            return questionSet;
        });
        when(itemRepository.save(any(QuestionSetItem.class))).thenAnswer(invocation -> {
            QuestionSetItem item = invocation.getArgument(0);
            item.setId(ids.incrementAndGet());
            savedItems.add(item);
            return item;
        });
        when(versionRepository.save(any(QuestionSetVersion.class))).thenAnswer(invocation -> {
            QuestionSetVersion version = invocation.getArgument(0);
            if (version.getId() == null) {
                version.setId(ids.incrementAndGet());
            }
            savedVersions.add(version);
            return version;
        });
        when(versionItemRepository.save(any(QuestionSetVersionItem.class))).thenAnswer(invocation -> {
            QuestionSetVersionItem item = invocation.getArgument(0);
            if (item.getId() == null) {
                item.setId(ids.incrementAndGet());
            }
            savedVersionItems.add(item);
            return item;
        });
        when(itemRepository.findByQuestionSetOrderByPositionAsc(any(QuestionSet.class))).thenReturn(savedItems);
        when(versionRepository.findTopByQuestionSetOrderByVersionDesc(any())).thenAnswer(invocation -> savedVersions.stream()
                .filter(version -> version.getQuestionSet() == invocation.getArgument(0))
                .max(java.util.Comparator.comparing(QuestionSetVersion::getVersion)));
        when(versionRepository.findByQuestionSetOrderByVersionDesc(any())).thenAnswer(invocation -> savedVersions.stream()
                .filter(version -> version.getQuestionSet() == invocation.getArgument(0))
                .sorted(java.util.Comparator.comparing(QuestionSetVersion::getVersion).reversed())
                .toList());
        when(versionItemRepository.findByQuestionSetVersionOrderByPositionAsc(any())).thenAnswer(invocation -> savedVersionItems.stream()
                .filter(item -> item.getQuestionSetVersion() == invocation.getArgument(0))
                .sorted(java.util.Comparator.comparing(QuestionSetVersionItem::getPosition))
                .toList());
    }

    @Test
    void createPersistsApprovedQuestionsInOrder() {
        List<QuestionBankQuestion> questions = List.of(
                question(1L, "Câu 1", QuestionBankStatus.APPROVED),
                question(2L, "Câu 2", QuestionBankStatus.APPROVED),
                question(3L, "Câu 3", QuestionBankStatus.APPROVED)
        );
        when(questionRepository.findAllById(any())).thenReturn(questions);

        var response = service.create(new CreateQuestionSetRequest(
                "SET_1",
                "Bộ kiểm soát nhiễm khuẩn",
                "Mô tả",
                "Kiểm soát nhiễm khuẩn",
                "medium",
                "DRAFT",
                List.of(1L, 2L, 3L)
        ), "admin");

        assertThat(response.questionCount()).isEqualTo(3);
        assertThat(response.items()).extracting("position").containsExactly(1, 2, 3);
        assertThat(response.items()).extracting(item -> item.question().id()).containsExactly(1L, 2L, 3L);
    }

    @Test
    void createRejectsDuplicateQuestionIds() {
        assertThatThrownBy(() -> service.create(new CreateQuestionSetRequest(
                null,
                "Bộ trùng câu",
                null,
                null,
                "easy",
                "DRAFT",
                List.of(1L, 1L)
        ), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("không được trùng");
    }

    @Test
    void createRejectsUnapprovedQuestion() {
        when(questionRepository.findAllById(any())).thenReturn(List.of(
                question(1L, "Câu 1", QuestionBankStatus.APPROVED),
                question(2L, "Câu 2", QuestionBankStatus.DRAFT)
        ));

        assertThatThrownBy(() -> service.create(new CreateQuestionSetRequest(
                null,
                "Bộ có câu nháp",
                null,
                null,
                "medium",
                "DRAFT",
                List.of(1L, 2L)
        ), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã duyệt");
    }

    @Test
    void updateRejectsActiveSetBecauseSnapshotIsLocked() {
        QuestionSet questionSet = QuestionSet.builder()
                .id(11L)
                .name("Bộ đang hoạt động")
                .status(QuestionSetStatus.ACTIVE)
                .questionCount(1)
                .activeVersion(1)
                .build();
        when(setRepository.findById(questionSet.getId())).thenReturn(Optional.of(questionSet));

        assertThatThrownBy(() -> service.update(questionSet.getId(), new vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateQuestionSetRequest(
                "SET_ACTIVE",
                "Tên mới",
                null,
                null,
                "medium",
                "ACTIVE",
                List.of(1L)
        ), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("khóa snapshot");
    }

    @Test
    void activateRejectsEmptySet() {
        QuestionSet questionSet = QuestionSet.builder()
                .id(10L)
                .name("Bộ rỗng")
                .status(QuestionSetStatus.DRAFT)
                .questionCount(0)
                .build();
        when(setRepository.findById(10L)).thenReturn(Optional.of(questionSet));
        when(itemRepository.findByQuestionSetOrderByPositionAsc(questionSet)).thenReturn(List.of());

        assertThatThrownBy(() -> service.activate(10L, "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("rỗng");
    }

    @Test
    void activateCreatesImmutableVersionSnapshot() {
        QuestionSet questionSet = QuestionSet.builder()
                .id(20L)
                .name("Bộ active")
                .status(QuestionSetStatus.DRAFT)
                .questionCount(1)
                .build();
        QuestionBankQuestion question = question(1L, "Câu gốc v1", QuestionBankStatus.APPROVED);
        QuestionSetItem item = QuestionSetItem.builder()
                .id(21L)
                .questionSet(questionSet)
                .question(question)
                .position(1)
                .required(true)
                .build();
        when(setRepository.findById(questionSet.getId())).thenReturn(Optional.of(questionSet));
        when(itemRepository.findByQuestionSetOrderByPositionAsc(questionSet)).thenReturn(List.of(item));

        var first = service.activate(questionSet.getId(), "admin");
        question.setStem("Câu gốc v2 sau khi sửa live");
        var second = service.activate(questionSet.getId(), "admin");

        assertThat(first.activeVersion()).isEqualTo(1);
        assertThat(second.activeVersion()).isEqualTo(2);
        assertThat(savedVersions).extracting(QuestionSetVersion::getVersion).containsExactly(1, 2);
        assertThat(savedVersionItems).extracting(QuestionSetVersionItem::getStem)
                .containsExactly("Câu gốc v1", "Câu gốc v2 sau khi sửa live");
        assertThat(first.activeSnapshotItems()).extracting("stem").containsExactly("Câu gốc v1");
    }

    @Test
    void exportUsesActiveSnapshotWhenAvailable() throws Exception {
        QuestionSet questionSet = QuestionSet.builder()
                .id(30L)
                .code("SET-ACTIVE")
                .name("Bộ xuất file")
                .status(QuestionSetStatus.DRAFT)
                .questionCount(1)
                .build();
        QuestionBankQuestion question = question(1L, "Câu snapshot tiếng Việt", QuestionBankStatus.APPROVED);
        QuestionSetItem item = QuestionSetItem.builder()
                .id(31L)
                .questionSet(questionSet)
                .question(question)
                .position(1)
                .required(true)
                .build();
        when(setRepository.findById(questionSet.getId())).thenReturn(Optional.of(questionSet));
        when(itemRepository.findByQuestionSetOrderByPositionAsc(questionSet)).thenReturn(List.of(item));

        service.activate(questionSet.getId(), "admin");
        question.setStem("Câu live đã bị sửa");

        String csv = new String(service.export(questionSet.getId(), "csv"), StandardCharsets.UTF_8);
        assertThat(csv).contains("Câu snapshot tiếng Việt").doesNotContain("Câu live đã bị sửa");

        byte[] docx = service.export(questionSet.getId(), "docx");
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(docx))) {
            String text = document.getParagraphs().stream()
                    .map(paragraph -> paragraph.getText())
                    .reduce("", (left, right) -> left + "\n" + right);
            assertThat(text).contains("Câu snapshot tiếng Việt").doesNotContain("Câu live đã bị sửa");
        }

        byte[] xlsx = service.export(questionSet.getId(), "xlsx");
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            assertThat(workbook.getSheetAt(0).getRow(6).getCell(2).getStringCellValue())
                    .isEqualTo("Câu snapshot tiếng Việt");
        }

        byte[] pdf = service.export(questionSet.getId(), "pdf");
        assertThat(new String(Arrays.copyOf(pdf, 4), StandardCharsets.US_ASCII)).isEqualTo("%PDF");
    }

    @Test
    void previewUsesStableRandomSeed() {
        when(questionRepository.findTop500ByStatusOrderByIdAsc(QuestionBankStatus.APPROVED)).thenReturn(List.of(
                question(1L, "Câu 1", QuestionBankStatus.APPROVED),
                question(2L, "Câu 2", QuestionBankStatus.APPROVED),
                question(3L, "Câu 3", QuestionBankStatus.APPROVED),
                question(4L, "Câu 4", QuestionBankStatus.APPROVED)
        ));
        PreviewQuestionSetRequest request = new PreviewQuestionSetRequest(
                "Kiểm soát nhiễm khuẩn",
                null,
                Map.of("medium", 3),
                List.of(),
                false,
                42L
        );

        var first = service.preview(request);
        var second = service.preview(request);

        assertThat(first.questionIds()).hasSize(3);
        assertThat(second.questionIds()).containsExactlyElementsOf(first.questionIds());
    }

    @Test
    void duplicateCreatesDraftCopyWithSameItems() {
        QuestionSet source = QuestionSet.builder()
                .id(60L)
                .code("SET-SOURCE")
                .name("Bộ nguồn")
                .description("Mô tả")
                .category("An toàn")
                .difficulty("medium")
                .status(QuestionSetStatus.ACTIVE)
                .questionCount(2)
                .build();
        List<QuestionSetItem> sourceItems = List.of(
                QuestionSetItem.builder()
                        .id(61L)
                        .questionSet(source)
                        .question(question(1L, "Câu 1", QuestionBankStatus.APPROVED))
                        .position(1)
                        .required(true)
                        .build(),
                QuestionSetItem.builder()
                        .id(62L)
                        .questionSet(source)
                        .question(question(2L, "Câu 2", QuestionBankStatus.APPROVED))
                        .position(2)
                        .required(true)
                        .build()
        );
        when(setRepository.findById(source.getId())).thenReturn(Optional.of(source));
        when(setRepository.findByCode(any())).thenReturn(Optional.empty());
        when(itemRepository.findByQuestionSetOrderByPositionAsc(source)).thenReturn(sourceItems);

        var response = service.duplicate(source.getId(), "admin");

        assertThat(response.status()).isEqualTo(QuestionSetStatus.DRAFT.name());
        assertThat(response.name()).startsWith("Bản sao - ");
        assertThat(response.questionCount()).isEqualTo(2);
        assertThat(response.items()).extracting("position").containsExactly(1, 2);
    }

    @Test
    void duplicateActiveSetUsesActiveVersionSnapshotInsteadOfLiveItems() {
        QuestionSet source = QuestionSet.builder()
                .id(70L)
                .code("SET-ACTIVE")
                .name("Bộ active")
                .status(QuestionSetStatus.ACTIVE)
                .questionCount(2)
                .activeVersion(1)
                .build();
        QuestionSetVersion version = QuestionSetVersion.builder()
                .id(71L)
                .questionSet(source)
                .version(1)
                .questionCount(2)
                .snapshotAt(LocalDateTime.now())
                .activatedBy("admin")
                .build();
        savedVersions.add(version);
        savedVersionItems.add(QuestionSetVersionItem.builder()
                .id(72L)
                .questionSetVersion(version)
                .sourceQuestionId(1L)
                .position(1)
                .required(true)
                .stem("Snapshot câu 1")
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .build());
        savedVersionItems.add(QuestionSetVersionItem.builder()
                .id(73L)
                .questionSetVersion(version)
                .sourceQuestionId(2L)
                .position(2)
                .required(true)
                .stem("Snapshot câu 2")
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .build());
        when(setRepository.findById(source.getId())).thenReturn(Optional.of(source));
        when(setRepository.findByCode(any())).thenReturn(Optional.empty());
        when(itemRepository.findByQuestionSetOrderByPositionAsc(source)).thenReturn(List.of(
                QuestionSetItem.builder()
                        .questionSet(source)
                        .question(question(99L, "Live item bị lệch", QuestionBankStatus.APPROVED))
                        .position(1)
                        .required(true)
                        .build()
        ));
        when(questionRepository.findAllById(List.of(1L, 2L))).thenReturn(List.of(
                question(1L, "Câu 1 hiện tại", QuestionBankStatus.APPROVED),
                question(2L, "Câu 2 hiện tại", QuestionBankStatus.APPROVED)
        ));

        var response = service.duplicate(source.getId(), "admin");

        assertThat(response.status()).isEqualTo(QuestionSetStatus.DRAFT.name());
        assertThat(response.items()).extracting(item -> item.question().id()).containsExactly(1L, 2L);
        assertThat(response.items()).extracting("position").containsExactly(1, 2);
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
                .topic("Kiểm soát nhiễm khuẩn")
                .difficulty("medium")
                .language("vi")
                .sourceDocument("Tài liệu kiểm soát nhiễm khuẩn")
                .questionType(QuestionType.ORIGINAL)
                .status(status)
                .build();
    }
}
