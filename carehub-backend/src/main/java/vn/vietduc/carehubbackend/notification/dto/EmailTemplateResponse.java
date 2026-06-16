package vn.vietduc.carehubbackend.notification.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;

import java.time.LocalDateTime;

@Builder
public record EmailTemplateResponse(
        Long id,
        String code,
        String subject,
        String body,
        boolean mandatory,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EmailTemplateResponse from(EmailTemplate template) {
        return EmailTemplateResponse.builder()
                .id(template.getId())
                .code(template.getCode())
                .subject(template.getSubject())
                .body(template.getBody())
                .mandatory(template.isMandatory())
                .active(template.isActive())
                .createdAt(template.getCreatedAt())
                .updatedAt(template.getUpdatedAt())
                .build();
    }
}
