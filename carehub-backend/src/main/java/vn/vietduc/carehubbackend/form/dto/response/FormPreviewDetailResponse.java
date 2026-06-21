package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;

@Builder
public record FormPreviewDetailResponse(
        FormResponse form,
        FormVersionResponse version
) {
}
