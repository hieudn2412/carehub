package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Map;

@Builder
public record FormVersionResponse(
        Long id,
        Long formId,
        Integer versionNumber,
        FormVersionStatus status,
        String title,
        String description,
        Map<String, Object> settings,
        java.math.BigDecimal passingScore,
        String schemaHash,
        Instant publishedAt,
        UserSummary publishedBy,
        Long lockVersion,
        List<SectionResponse> sections,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    @Builder
    public record UserSummary(Long id, String employeeCode, String name) {
    }

    @Builder
    public record SectionResponse(
            Long id,
            UUID sectionKey,
            String title,
            String description,
            Integer displayOrder,
            List<ItemResponse> items
    ) {
    }

    @Builder
    public record ItemResponse(
            Long id,
            UUID itemKey,
            FormItemType itemType,
            Integer displayOrder,
            String title,
            String description,
            String mediaUrl,
            QuestionResponse question
    ) {
    }

    @Builder
    public record QuestionResponse(
            Long id,
            UUID questionKey,
            String code,
            String metricCode,
            String title,
            String helpText,
            FormFieldType fieldType,
            boolean required,
            boolean readOnly,
            boolean critical,
            boolean excludeFromScore,
            BigDecimal weight,
            Map<String, Object> validationConfig,
            Map<String, Object> displayConfig,
            List<OptionResponse> options
    ) {
    }

    @Builder
    public record OptionResponse(
            Long id,
            UUID optionKey,
            String value,
            String label,
            BigDecimal scoreValue,
            Boolean compliant,
            boolean excludeFromDenominator,
            Integer displayOrder
    ) {
    }
}
