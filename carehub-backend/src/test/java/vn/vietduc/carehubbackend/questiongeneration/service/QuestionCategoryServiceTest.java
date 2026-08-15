package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionCategoryRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuestionCategoryServiceTest {
    private final QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final AtomicLong ids = new AtomicLong(10);
    private QuestionCategoryService service;

    @BeforeEach
    void setUp() {
        service = new QuestionCategoryService(categoryRepository, questionRepository);
        when(categoryRepository.save(any(QuestionCategory.class))).thenAnswer(invocation -> {
            QuestionCategory category = invocation.getArgument(0);
            if (category.getId() == null) {
                category.setId(ids.incrementAndGet());
            }
            return category;
        });
        when(questionRepository.countByCategoryIdAndStatus(any(), eq(QuestionBankStatus.APPROVED))).thenReturn(3L);
    }

    @Test
    void createGeneratesCodeAndReturnsApprovedQuestionCount() {
        var response = service.create(new UpsertQuestionCategoryRequest(
                null,
                "An toàn người bệnh",
                "Nhận diện và phòng ngừa rủi ro",
                "ACTIVE"
        ), "admin");

        assertThat(response.id()).isNotNull();
        assertThat(response.code()).isEqualTo("AN_TOAN_NGUOI_BENH");
        assertThat(response.statusText()).isEqualTo("Hoạt động");
        assertThat(response.questionCount()).isEqualTo(3);
        verify(questionRepository).countByCategoryIdAndStatus(response.id(), QuestionBankStatus.APPROVED);
    }

    @Test
    void archiveMarksCategoryArchived() {
        QuestionCategory category = QuestionCategory.builder()
                .id(5L)
                .code("ATNB")
                .name("An toàn người bệnh")
                .status(QuestionCategoryStatus.ACTIVE)
                .build();
        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));

        var response = service.archive(category.getId());

        assertThat(response.status()).isEqualTo(QuestionCategoryStatus.ARCHIVED.name());
        assertThat(category.getStatus()).isEqualTo(QuestionCategoryStatus.ARCHIVED);
    }

    @Test
    void updateAllowsRenameButRejectsChangingStableCode() {
        QuestionCategory category = QuestionCategory.builder()
                .id(8L).code("BAI_1").name("Tên cũ")
                .status(QuestionCategoryStatus.ACTIVE).build();
        when(categoryRepository.findById(8L)).thenReturn(Optional.of(category));

        var renamed = service.update(8L, new UpsertQuestionCategoryRequest(
                "BAI_1", "Tên mới", null, "ACTIVE"
        ));
        assertThat(renamed.name()).isEqualTo("Tên mới");
        verify(questionRepository).countByCategoryIdAndStatus(8L, QuestionBankStatus.APPROVED);

        assertThatThrownBy(() -> service.update(8L, new UpsertQuestionCategoryRequest(
                "MA_KHAC", "Tên mới", null, "ACTIVE"
        ))).hasMessageContaining("không thể thay đổi");
    }
}
