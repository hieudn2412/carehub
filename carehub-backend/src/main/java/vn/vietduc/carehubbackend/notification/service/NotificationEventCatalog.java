package vn.vietduc.carehubbackend.notification.service;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

@Component
public class NotificationEventCatalog {
    private static final Set<String> CME_VARIABLES = Set.of(
            "recipient_name", "manager_name", "employee_name", "employee_code", "current_hours",
            "required_hours", "missing_hours", "deadline", "department"
    );
    private static final Set<String> EXAM_VARIABLES = Set.of(
            "recipient_name", "employee_name", "employee_code", "exam_name", "due_at", "max_attempts"
    );
    private static final Set<String> QUALITY_VARIABLES = Set.of(
            "recipient_name", "manager_name", "department", "compliance_rate", "target_rate", "period"
    );
    private static final Set<String> EXAM_PASSED_VARIABLES = Set.of(
            "recipient_name", "employee_name", "employee_code", "exam_name", "score",
            "classification", "compliance_percent", "department"
    );
    private static final Set<String> PERSONAL_VARIABLES = Set.of(
            "recipient_name", "employee_name", "employee_code", "form_name", "result", "score", "submitted_at"
    );

    private final Map<NotificationEventType, Definition> definitions = new EnumMap<>(NotificationEventType.class);

    public NotificationEventCatalog() {
        definitions.put(NotificationEventType.CME_HOURS_BELOW_REQUIREMENT, new Definition(
                NotificationCategory.TRAINING,
                Set.of(NotificationAudience.EMPLOYEE, NotificationAudience.MANAGER),
                NotificationCadence.WEEKLY,
                true,
                null,
                CME_VARIABLES
        ));
        definitions.put(NotificationEventType.EXAM_ASSIGNED, new Definition(
                NotificationCategory.EVALUATION,
                Set.of(NotificationAudience.EMPLOYEE),
                NotificationCadence.IMMEDIATE,
                true,
                null,
                EXAM_VARIABLES
        ));
        definitions.put(NotificationEventType.EXAM_PASSED, new Definition(
                NotificationCategory.EVALUATION,
                Set.of(NotificationAudience.EMPLOYEE),
                NotificationCadence.IMMEDIATE,
                true,
                null,
                EXAM_PASSED_VARIABLES
        ));
        definitions.put(NotificationEventType.QUALITY_COMPLIANCE_BELOW_TARGET, new Definition(
                NotificationCategory.QUALITY,
                Set.of(NotificationAudience.MANAGER),
                NotificationCadence.DAILY,
                true,
                BigDecimal.valueOf(90),
                QUALITY_VARIABLES
        ));
        definitions.put(NotificationEventType.PERSONAL_COMPLIANCE_ISSUE, new Definition(
                NotificationCategory.QUALITY,
                Set.of(NotificationAudience.EMPLOYEE),
                NotificationCadence.IMMEDIATE,
                false,
                null,
                PERSONAL_VARIABLES
        ));
    }

    public Definition definition(NotificationEventType eventType) {
        Definition definition = definitions.get(eventType);
        if (definition == null) {
            throw new UnprocessableEntityException("Unsupported notification event type: " + eventType);
        }
        return definition;
    }

    public Set<String> allowedVariables(NotificationEventType eventType, NotificationAudience audience) {
        validateAudience(eventType, audience);
        return definition(eventType).allowedVariables();
    }

    public void validateBinding(
            NotificationEventType eventType,
            NotificationAudience audience,
            NotificationCategory category
    ) {
        Definition definition = definition(eventType);
        validateAudience(eventType, audience);
        if (definition.category() != category) {
            throw new UnprocessableEntityException("Category does not match notification event type");
        }
    }

    public void validateCadence(NotificationEventType eventType, NotificationCadence cadence) {
        if (cadence == null) {
            throw new UnprocessableEntityException("Notification cadence is required");
        }
        boolean immediateEvent = eventType == NotificationEventType.EXAM_ASSIGNED
                || eventType == NotificationEventType.EXAM_PASSED
                || eventType == NotificationEventType.PERSONAL_COMPLIANCE_ISSUE;
        if (immediateEvent && cadence != NotificationCadence.IMMEDIATE) {
            throw new UnprocessableEntityException(eventType + " must use IMMEDIATE cadence");
        }
        if (!immediateEvent && cadence == NotificationCadence.IMMEDIATE) {
            throw new UnprocessableEntityException(eventType + " must use DAILY, WEEKLY or MONTHLY cadence");
        }
    }

    public String triggerLabel(NotificationEventType eventType, NotificationCadence cadence) {
        return switch (eventType) {
            case EXAM_ASSIGNED -> "Tự động · khi được giao";
            case EXAM_PASSED -> "Tự động · khi đạt bài kiểm tra";
            case PERSONAL_COMPLIANCE_ISSUE -> "Tự động · khi không tuân thủ";
            case CME_HOURS_BELOW_REQUIREMENT, QUALITY_COMPLIANCE_BELOW_TARGET -> "Tự động · " + switch (cadence) {
                case DAILY -> "hàng ngày";
                case WEEKLY -> "hàng tuần";
                case MONTHLY -> "hàng tháng";
                case IMMEDIATE -> "ngay lập tức";
            };
        };
    }

    public String displayName(NotificationEventType eventType) {
        return switch (eventType) {
            case CME_HOURS_BELOW_REQUIREMENT -> "Cảnh báo thiếu giờ CME";
            case EXAM_ASSIGNED -> "Thông báo giao bài thi";
            case EXAM_PASSED -> "Thông báo đạt bài kiểm tra";
            case QUALITY_COMPLIANCE_BELOW_TARGET -> "Cảnh báo tỷ lệ tuân thủ thấp";
            case PERSONAL_COMPLIANCE_ISSUE -> "Vấn đề tuân thủ cá nhân";
        };
    }

    private void validateAudience(NotificationEventType eventType, NotificationAudience audience) {
        if (!definition(eventType).audiences().contains(audience)) {
            throw new UnprocessableEntityException("Audience does not match notification event type");
        }
    }

    public record Definition(
            NotificationCategory category,
            Set<NotificationAudience> audiences,
            NotificationCadence defaultCadence,
            boolean defaultEnabled,
            BigDecimal defaultThresholdPercent,
            Set<String> allowedVariables
    ) {
    }
}
