package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationAuditLogResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAuditLog;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationAuditLogRepository;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EvaluationAuditLogService {
    private final EvaluationAuditLogRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional
    public EvaluationAuditLogResponse record(
            String action,
            String entityType,
            Long entityId,
            String actor,
            String summary
    ) {
        return record(action, entityType, entityId, actor, summary, null);
    }

    @Transactional
    public EvaluationAuditLogResponse record(
            String action,
            String entityType,
            Long entityId,
            String actor,
            String summary,
            Object detail
    ) {
        EvaluationAuditLog log = EvaluationAuditLog.builder()
                .action(clean(action, 80))
                .entityType(clean(entityType, 80))
                .entityId(entityId)
                .actor(clean(actor, 120))
                .summary(summary)
                .detailJson(toJson(detail))
                .build();
        return toResponse(repository.save(log));
    }

    @Transactional(readOnly = true)
    public List<EvaluationAuditLogResponse> list(String q, String action, String entityType, String actor) {
        String keyword = normalize(q);
        String actionFilter = normalize(action);
        String entityTypeFilter = normalize(entityType);
        String actorFilter = normalize(actor);
        return repository.findTop200ByOrderByCreatedAtDesc().stream()
                .filter(log -> matches(log, keyword, actionFilter, entityTypeFilter, actorFilter))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvaluationAuditLogResponse get(Long id) {
        return repository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy audit log"));
    }

    private boolean matches(
            EvaluationAuditLog log,
            String keyword,
            String actionFilter,
            String entityTypeFilter,
            String actorFilter
    ) {
        if (StringUtils.hasText(actionFilter) && !normalize(log.getAction()).contains(actionFilter)) {
            return false;
        }
        if (StringUtils.hasText(entityTypeFilter) && !normalize(log.getEntityType()).equals(entityTypeFilter)) {
            return false;
        }
        if (StringUtils.hasText(actorFilter) && !normalize(log.getActor()).contains(actorFilter)) {
            return false;
        }
        if (!StringUtils.hasText(keyword)) {
            return true;
        }
        return normalize(log.getAction()).contains(keyword)
                || normalize(actionText(log.getAction())).contains(keyword)
                || normalize(log.getEntityType()).contains(keyword)
                || normalize(log.getActor()).contains(keyword)
                || normalize(log.getSummary()).contains(keyword)
                || String.valueOf(log.getEntityId()).contains(keyword);
    }

    private String toJson(Object detail) {
        if (detail == null) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException ex) {
            return "{\"serializationError\":true}";
        }
    }

    private EvaluationAuditLogResponse toResponse(EvaluationAuditLog log) {
        return new EvaluationAuditLogResponse(
                log.getId(),
                log.getAction(),
                actionText(log.getAction()),
                log.getEntityType(),
                log.getEntityId(),
                log.getActor(),
                log.getSummary(),
                log.getDetailJson(),
                log.getCreatedAt()
        );
    }

    private String actionText(String action) {
        return switch (String.valueOf(action)) {
            case "QUESTION_CREATE" -> "Tạo câu hỏi";
            case "QUESTION_UPDATE" -> "Cập nhật câu hỏi";
            case "QUESTION_APPROVE" -> "Duyệt câu hỏi";
            case "QUESTION_DEACTIVATE" -> "Tạm ngưng câu hỏi";
            case "QUESTION_ARCHIVE" -> "Lưu trữ câu hỏi";
            case "QUESTION_IMPORT_COMMIT" -> "Import ngân hàng câu hỏi";
            case "QUESTION_EXPORT" -> "Export ngân hàng câu hỏi";
            case "DOCUMENT_UPLOAD" -> "Upload tài liệu";
            case "DOCUMENT_JOB_CREATE" -> "Tạo phiên sinh câu hỏi";
            case "DOCUMENT_JOB_RETRY" -> "Retry phiên sinh câu hỏi";
            case "DOCUMENT_JOB_CANCEL" -> "Hủy phiên sinh câu hỏi";
            case "DOCUMENT_CANDIDATE_UPDATE" -> "Cập nhật câu hỏi đề xuất";
            case "DOCUMENT_CANDIDATE_APPROVE" -> "Duyệt câu hỏi đề xuất";
            case "DOCUMENT_CANDIDATE_REJECT" -> "Từ chối câu hỏi đề xuất";
            case "DOCUMENT_CANDIDATE_SAVE" -> "Lưu câu hỏi đề xuất";
            case "DOCUMENT_CANDIDATE_BATCH_APPROVE" -> "Duyệt hàng loạt câu hỏi đề xuất";
            case "DOCUMENT_CANDIDATE_BATCH_REJECT" -> "Từ chối hàng loạt câu hỏi đề xuất";
            case "DOCUMENT_CANDIDATE_BATCH_SAVE" -> "Lưu hàng loạt câu hỏi đề xuất";
            case "PARAPHRASE_JOB_CREATE" -> "Tạo phiên diễn đạt lại";
            case "PARAPHRASE_JOB_BATCH_CREATE" -> "Tạo hàng loạt phiên diễn đạt lại";
            case "PARAPHRASE_CANDIDATE_UPDATE" -> "Cập nhật candidate paraphrase";
            case "PARAPHRASE_CANDIDATE_APPROVE" -> "Duyệt candidate paraphrase";
            case "PARAPHRASE_CANDIDATE_REJECT" -> "Từ chối candidate paraphrase";
            case "PARAPHRASE_CANDIDATE_SAVE" -> "Lưu candidate paraphrase";
            case "PARAPHRASE_CANDIDATE_BATCH_APPROVE" -> "Duyệt hàng loạt candidate paraphrase";
            case "PARAPHRASE_CANDIDATE_BATCH_REJECT" -> "Từ chối hàng loạt candidate paraphrase";
            case "PARAPHRASE_CANDIDATE_BATCH_SAVE" -> "Lưu hàng loạt candidate paraphrase";
            case "QUESTION_SET_CREATE" -> "Tạo bộ câu hỏi";
            case "QUESTION_SET_UPDATE" -> "Cập nhật bộ câu hỏi";
            case "QUESTION_SET_ACTIVATE" -> "Kích hoạt bộ câu hỏi";
            case "QUESTION_SET_DEACTIVATE" -> "Tạm ngưng bộ câu hỏi";
            case "QUESTION_SET_ARCHIVE" -> "Lưu trữ bộ câu hỏi";
            case "QUESTION_SET_DUPLICATE" -> "Nhân bản bộ câu hỏi";
            case "QUESTION_CATEGORY_CREATE" -> "Tạo danh mục câu hỏi";
            case "QUESTION_CATEGORY_UPDATE" -> "Cập nhật danh mục câu hỏi";
            case "QUESTION_CATEGORY_ARCHIVE" -> "Lưu trữ danh mục câu hỏi";
            case "CLASSIFICATION_RULE_CREATE" -> "Tạo quy tắc phân loại";
            case "CLASSIFICATION_RULE_UPDATE" -> "Cập nhật quy tắc phân loại";
            case "CLASSIFICATION_RULE_DISABLE" -> "Tạm ngưng quy tắc phân loại";
            case "EXAM_CONFIG_CREATE" -> "Tạo cấu hình đề";
            case "EXAM_CONFIG_UPDATE" -> "Cập nhật cấu hình đề";
            case "EXAM_CONFIG_ACTIVATE" -> "Kích hoạt cấu hình đề";
            case "EXAM_CONFIG_DEACTIVATE" -> "Tạm ngưng cấu hình đề";
            case "EXAM_CONFIG_ARCHIVE" -> "Lưu trữ cấu hình đề";
            case "EXAM_PAPER_GENERATE" -> "Sinh bộ đề";
            case "EXAM_PAPER_PUBLISH" -> "Phát hành bộ đề";
            case "EXAM_PAPER_ARCHIVE" -> "Lưu trữ bộ đề";
            case "EXAM_PAPER_DUPLICATE" -> "Nhân bản bộ đề";
            case "EXAM_PAPER_EXPORT" -> "Export bộ đề";
            case "EXAM_ASSIGNMENT_CREATE" -> "Tạo phân công kiểm tra";
            case "EXAM_ASSIGNMENT_OPEN" -> "Mở phân công kiểm tra";
            case "EXAM_ASSIGNMENT_CLOSE" -> "Đóng phân công kiểm tra";
            case "EXAM_ASSIGNMENT_ARCHIVE" -> "Lưu trữ phân công kiểm tra";
            default -> action;
        };
    }

    private String clean(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return "system";
        }
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }
}
