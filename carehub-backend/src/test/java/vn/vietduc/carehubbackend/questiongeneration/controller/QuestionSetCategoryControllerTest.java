package vn.vietduc.carehubbackend.questiongeneration.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionSetCategoryRequest;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionSetCategoryService;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class QuestionSetCategoryControllerTest {
    @Mock
    private QuestionSetCategoryService categoryService;

    @Mock
    private EvaluationAuditLogService auditLogService;

    @InjectMocks
    private QuestionSetCategoryController controller;

    @Test
    void productionRejectsLegacyPurposeCategoryWrites() {
        var request = new UpsertQuestionSetCategoryRequest("ON_TAP", "Ôn tập", null, "ACTIVE");

        assertThatThrownBy(() -> controller.create(
                        request, new TestingAuthenticationToken("admin", "credentials")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("mục đích kiểm tra");

        verify(categoryService, never()).create(request, "admin");
    }

    @Test
    void productionRejectsLegacyPurposeCategoryUpdateAndArchive() {
        var request = new UpsertQuestionSetCategoryRequest("ON_TAP", "Ôn tập mới", null, "ACTIVE");
        var authentication = new TestingAuthenticationToken("admin", "credentials");

        assertThatThrownBy(() -> controller.update(7L, request, authentication))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("mục đích kiểm tra");
        assertThatThrownBy(() -> controller.archive(7L, authentication))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("mục đích kiểm tra");

        verify(categoryService, never()).update(7L, request);
        verify(categoryService, never()).archive(7L);
    }
}
