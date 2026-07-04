package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAuditLog;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationAuditLogRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EvaluationAuditLogServiceTest {
    private final EvaluationAuditLogRepository repository = mock(EvaluationAuditLogRepository.class);
    private EvaluationAuditLogService service;

    @BeforeEach
    void setUp() {
        service = new EvaluationAuditLogService(repository, new ObjectMapper());
        when(repository.save(any(EvaluationAuditLog.class))).thenAnswer(invocation -> {
            EvaluationAuditLog log = invocation.getArgument(0);
            log.setId(10L);
            log.setCreatedAt(LocalDateTime.of(2026, 7, 2, 9, 0));
            return log;
        });
    }

    @Test
    void recordSerializesDetailAndReturnsResponse() {
        var response = service.record(
                "QUESTION_CREATE",
                "QUESTION",
                5L,
                "admin",
                "Tạo câu hỏi #5",
                Map.of("status", "APPROVED")
        );

        ArgumentCaptor<EvaluationAuditLog> captor = ArgumentCaptor.forClass(EvaluationAuditLog.class);
        org.mockito.Mockito.verify(repository).save(captor.capture());
        assertThat(captor.getValue().getDetailJson()).contains("\"status\":\"APPROVED\"");
        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.actionText()).isEqualTo("Tạo câu hỏi");
    }

    @Test
    void listFiltersByKeywordAndActor() {
        EvaluationAuditLog matching = log(1L, "QUESTION_APPROVE", "QUESTION", 7L, "reviewer", "Duyệt câu hỏi #7");
        EvaluationAuditLog other = log(2L, "EXAM_PAPER_PUBLISH", "EXAM_PAPER", 3L, "publisher", "Phát hành đề #3");
        when(repository.findTop200ByOrderByCreatedAtDesc()).thenReturn(List.of(matching, other));

        var rows = service.list("duyệt", null, null, "reviewer");

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).id()).isEqualTo(1L);
        assertThat(rows.get(0).actionText()).isEqualTo("Duyệt câu hỏi");
    }

    @Test
    void getReturnsAuditLog() {
        EvaluationAuditLog log = log(3L, "DOCUMENT_JOB_CANCEL", "DOCUMENT_QUESTION_JOB", 4L, "admin", "Hủy job #4");
        when(repository.findById(3L)).thenReturn(Optional.of(log));

        var response = service.get(3L);

        assertThat(response.entityType()).isEqualTo("DOCUMENT_QUESTION_JOB");
        assertThat(response.actionText()).isEqualTo("Hủy phiên sinh câu hỏi");
    }

    private EvaluationAuditLog log(Long id, String action, String entityType, Long entityId, String actor, String summary) {
        EvaluationAuditLog log = EvaluationAuditLog.builder()
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .actor(actor)
                .summary(summary)
                .detailJson("{}")
                .build();
        log.setId(id);
        log.setCreatedAt(LocalDateTime.of(2026, 7, 2, 9, id.intValue()));
        return log;
    }
}
