package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record CreateExamAssignmentRequest(
        String name,
        String description,
        Long examPaperId,
        List<Long> userIds,
        List<Long> departmentIds,
        List<Long> positionIds,
        List<Long> groupIds,
        Boolean allEmployees,
        LocalDateTime availableFrom,
        LocalDateTime dueAt,
        Integer maxAttempts,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        String resultVisibility,
        String status,
        String idempotencyKey,
        Long audienceId,
        String variantPolicy,
        String retakeVariantPolicy
) {
    public CreateExamAssignmentRequest(
            String name, String description, Long examPaperId, Long ignoredProfessionalFieldId,
            List<Long> userIds, List<Long> departmentIds, List<Long> positionIds, List<Long> groupIds,
            Boolean allEmployees, LocalDateTime availableFrom, LocalDateTime dueAt, Integer maxAttempts,
            Boolean shuffleQuestions, Boolean shuffleOptions, String resultVisibility, String status
    ) {
        this(name, description, examPaperId, userIds, departmentIds, positionIds, groupIds,
                allEmployees, availableFrom, dueAt, maxAttempts, shuffleQuestions, shuffleOptions,
                resultVisibility, status, legacyCompatibilityKey(), null, null, null);
    }

    /**
     * Compatibility constructor for Java callers compiled against the old
     * request. The field argument is intentionally ignored: assignments can no
     * longer retarget a paper to one professional field.
     */
    public CreateExamAssignmentRequest(
            String name, String description, Long examPaperId, Long ignoredProfessionalFieldId,
            List<Long> userIds, List<Long> departmentIds, List<Long> positionIds, List<Long> groupIds,
            Boolean allEmployees, LocalDateTime availableFrom, LocalDateTime dueAt, Integer maxAttempts,
            Boolean shuffleQuestions, Boolean shuffleOptions, String resultVisibility, String status,
            String idempotencyKey
    ) {
        this(name, description, examPaperId, userIds, departmentIds, positionIds, groupIds,
                allEmployees, availableFrom, dueAt, maxAttempts, shuffleQuestions, shuffleOptions,
                resultVisibility, status, idempotencyKey, null, null, null);
    }

    public CreateExamAssignmentRequest(
            String name, String description, Long examPaperId,
            List<Long> userIds, List<Long> departmentIds, List<Long> positionIds, List<Long> groupIds,
            Boolean allEmployees, LocalDateTime availableFrom, LocalDateTime dueAt, Integer maxAttempts,
            Boolean shuffleQuestions, Boolean shuffleOptions, String resultVisibility, String status,
            String idempotencyKey
    ) {
        this(name, description, examPaperId, userIds, departmentIds, positionIds, groupIds, allEmployees,
                availableFrom, dueAt, maxAttempts, shuffleQuestions, shuffleOptions, resultVisibility, status,
                idempotencyKey, null, null, null);
    }

    private static String legacyCompatibilityKey() {
        return "legacy-java-" + UUID.randomUUID();
    }
}
