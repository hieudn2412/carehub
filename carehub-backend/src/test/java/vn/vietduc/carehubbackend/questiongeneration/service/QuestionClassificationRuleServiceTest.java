package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.TestQuestionClassificationRuleRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionClassificationRuleRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionClassificationRule;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionClassificationRuleRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class QuestionClassificationRuleServiceTest {
    private final QuestionClassificationRuleRepository ruleRepository = mock(QuestionClassificationRuleRepository.class);
    private final QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
    private final AtomicLong ids = new AtomicLong(20);
    private QuestionClassificationRuleService service;
    private QuestionCategory category;

    @BeforeEach
    void setUp() {
        service = new QuestionClassificationRuleService(ruleRepository, categoryRepository);
        category = QuestionCategory.builder()
                .id(7L)
                .code("ATNB")
                .name("An toàn người bệnh")
                .status(QuestionCategoryStatus.ACTIVE)
                .sortOrder(1)
                .build();
        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(ruleRepository.save(any(QuestionClassificationRule.class))).thenAnswer(invocation -> {
            QuestionClassificationRule rule = invocation.getArgument(0);
            if (rule.getId() == null) {
                rule.setId(ids.incrementAndGet());
            }
            return rule;
        });
    }

    @Test
    void createStoresRuleForCategory() {
        var response = service.create(new UpsertQuestionClassificationRuleRequest(
                "Nhận diện người bệnh",
                category.getId(),
                "nhận diện, vòng tay",
                "an toàn người bệnh",
                10,
                true
        ), "admin");

        assertThat(response.id()).isNotNull();
        assertThat(response.categoryName()).isEqualTo("An toàn người bệnh");
        assertThat(response.enabled()).isTrue();
    }

    @Test
    void testReturnsBestMatchingRule() {
        QuestionClassificationRule rule = QuestionClassificationRule.builder()
                .id(11L)
                .name("Nhận diện người bệnh")
                .category(category)
                .keywords("nhận diện, vòng tay")
                .sourcePattern("an toàn người bệnh")
                .priority(10)
                .enabled(true)
                .build();
        when(ruleRepository.findByEnabledTrueOrderByPriorityDescIdAsc()).thenReturn(List.of(rule));

        var response = service.test(new TestQuestionClassificationRuleRequest(
                "Điều dưỡng cần kiểm tra vòng tay nhận diện trước khi tiêm thuốc",
                null,
                "Quy trình an toàn người bệnh",
                null,
                null
        ));

        assertThat(response.ruleId()).isEqualTo(rule.getId());
        assertThat(response.categoryName()).isEqualTo("An toàn người bệnh");
        assertThat(response.confidence()).isGreaterThan(0.5);
    }
}
