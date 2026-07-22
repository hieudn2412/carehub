package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertExamConfigRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigDistribution;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigDistributionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamConfigServiceTest {
    private final ExamConfigRepository examConfigRepository = mock(ExamConfigRepository.class);
    private final ExamConfigDistributionRepository distributionRepository = mock(ExamConfigDistributionRepository.class);
    private final QuestionSetRepository questionSetRepository = mock(QuestionSetRepository.class);
    private final QuestionSetItemRepository questionSetItemRepository = mock(QuestionSetItemRepository.class);
    private final QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
    private final AtomicLong ids = new AtomicLong(100);
    private final List<ExamConfigDistribution> savedDistributions = new ArrayList<>();
    private ExamConfigService service;
    private QuestionCategory category;
    private QuestionSet questionSet;

    @BeforeEach
    void setUp() {
        service = new ExamConfigService(
                examConfigRepository,
                distributionRepository,
                questionSetRepository,
                questionSetItemRepository,
                categoryRepository
        );
        category = QuestionCategory.builder()
                .id(10L)
                .code("ATNB")
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
        savedDistributions.clear();

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(questionSetRepository.findById(questionSet.getId())).thenReturn(Optional.of(questionSet));
        when(examConfigRepository.save(any(ExamConfig.class))).thenAnswer(invocation -> {
            ExamConfig config = invocation.getArgument(0);
            if (config.getId() == null) {
                config.setId(ids.incrementAndGet());
            }
            return config;
        });
        when(distributionRepository.save(any(ExamConfigDistribution.class))).thenAnswer(invocation -> {
            ExamConfigDistribution distribution = invocation.getArgument(0);
            if (distribution.getId() == null) {
                distribution.setId(ids.incrementAndGet());
            }
            savedDistributions.add(distribution);
            return distribution;
        });
        when(distributionRepository.findByExamConfigOrderByIdAsc(any())).thenReturn(savedDistributions);
        when(questionSetItemRepository.findByQuestionSetOrderByPositionAsc(questionSet)).thenReturn(questionSetItems(3));
    }

    @Test
    void createDraftConfigPersistsDistributionsAndPreviewWarnings() {
        var response = service.create(request(3, 3, "DRAFT"), "admin");

        assertThat(response.id()).isNotNull();
        assertThat(response.status()).isEqualTo(ExamConfigStatus.DRAFT.name());
        assertThat(response.distributions()).hasSize(1);
        assertThat(response.distributions().get(0).availableQuestionCount()).isEqualTo(3);
        assertThat(response.warnings()).isEmpty();
    }

    @Test
    void previewDetectsDistributionMismatch() {
        var response = service.preview(request(5, 3, "DRAFT"));

        assertThat(response.valid()).isFalse();
        assertThat(response.warnings()).anySatisfy(warning ->
                assertThat(warning).contains("Tổng phân bổ")
        );
    }

    @Test
    void createActiveConfigUsesAllQuestionsWhenDistributionIsEmpty() {
        UpsertExamConfigRequest request = new UpsertExamConfigRequest(
                "Kiểm tra 18 câu",
                null,
                questionSet.getId(),
                3,
                45,
                70,
                0,
                true,
                true,
                "ACTIVE",
                List.of()
        );

        var response = service.create(request, "admin");

        assertThat(response.status()).isEqualTo(ExamConfigStatus.ACTIVE.name());
        assertThat(response.warnings()).isEmpty();
    }

    @Test
    void activateRejectsShortageByCategory() {
        ExamConfig config = ExamConfig.builder()
                .id(30L)
                .name("Cấu hình thiếu câu")
                .questionSet(questionSet)
                .totalQuestions(4)
                .timeLimitMinutes(45)
                .passingScore(70)
                .maxRetakes(3)
                .shuffleQuestions(true)
                .shuffleOptions(true)
                .status(ExamConfigStatus.DRAFT)
                .build();
        ExamConfigDistribution distribution = ExamConfigDistribution.builder()
                .id(31L)
                .examConfig(config)
                .category(category)
                .questionCount(4)
                .required(true)
                .build();
        when(examConfigRepository.findById(config.getId())).thenReturn(Optional.of(config));
        when(distributionRepository.findByExamConfigOrderByIdAsc(config)).thenReturn(List.of(distribution));
        when(questionSetItemRepository.findByQuestionSetOrderByPositionAsc(questionSet)).thenReturn(questionSetItems(3));

        assertThatThrownBy(() -> service.activate(config.getId(), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể kích hoạt cấu hình");
    }

    private UpsertExamConfigRequest request(int totalQuestions, int distributionQuestions, String status) {
        return new UpsertExamConfigRequest(
                "Cấu hình kiểm tra",
                "Mô tả",
                questionSet.getId(),
                totalQuestions,
                45,
                70,
                3,
                true,
                true,
                status,
                List.of(new UpsertExamConfigRequest.Distribution(
                        category.getId(),
                        category.getName(),
                        null,
                        distributionQuestions,
                        true
                ))
        );
    }

    private List<QuestionSetItem> questionSetItems(int count) {
        List<QuestionSetItem> items = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            QuestionBankQuestion question = QuestionBankQuestion.builder()
                    .id((long) index + 1)
                    .stem("Câu hỏi " + index)
                    .topic(category.getName())
                    .build();
            items.add(QuestionSetItem.builder()
                    .id((long) index + 50)
                    .questionSet(questionSet)
                    .question(question)
                    .position(index + 1)
                    .points(BigDecimal.ONE)
                    .required(true)
                    .build());
        }
        return items;
    }
}
